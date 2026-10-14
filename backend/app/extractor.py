import asyncio
import urllib.parse
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
import httpx
import yt_dlp

from app.config import REQUEST_TIMEOUT_SECONDS
from app.models import VideoMetadata, VideoFormatInfo
from app.security import sanitize_filename, validate_url_security


def classify_extractor_error(error_str: str) -> str:
    """Classify extractor error message into user-friendly explanation."""
    err_lower = error_str.lower()
    if "drm" in err_lower or "encrypted" in err_lower:
        return "This video is protected by DRM or access controls and cannot be downloaded."
    if "login" in err_lower or "sign in" in err_lower or "private" in err_lower:
        return "This video requires login credentials or private access permissions."
    if "geo" in err_lower or "country" in err_lower:
        return "This video is restricted to specific geographic regions."
    if "not found" in err_lower or "404" in err_lower or "does not exist" in err_lower:
        return "The requested video was not found or has been removed."
    if "unsupported url" in err_lower or "no suitable extractor" in err_lower:
        return "The URL or source website is not currently supported for video extraction."
    if "rate limit" in err_lower or "429" in err_lower or "too many requests" in err_lower:
        return "The source website is rate-limiting requests. Please wait before retrying."
    if "timeout" in err_lower or "timed out" in err_lower:
        return "Connection to the source website timed out."
    return f"Unable to extract video information: {error_str}"


def is_direct_file_url(url: str) -> bool:
    """Check if the URL directly points to a media file by extension."""
    parsed = urllib.parse.urlsplit(url)
    path = parsed.path.lower()
    return any(path.endswith(ext) for ext in [
        ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".m4v", ".mp3", ".m4a", ".wav", ".ogg"
    ])


async def probe_direct_file(url: str) -> Optional[VideoMetadata]:
    """
    Attempt to inspect a direct video file URL via HTTP HEAD / Range request.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.head(url)
            content_type = resp.headers.get("content-type", "").lower()
            
            # If server doesn't support HEAD or returns 405, try GET with Range
            if resp.status_code in (405, 501):
                resp = await client.get(url, headers={"Range": "bytes=0-1024"})
                content_type = resp.headers.get("content-type", "").lower()

            if resp.status_code not in (200, 206):
                return None

            is_video = "video/" in content_type or is_direct_file_url(url)
            is_audio = "audio/" in content_type

            if not (is_video or is_audio):
                return None

            # Get filename from Content-Disposition or URL path
            parsed = urllib.parse.urlsplit(url)
            filename = Path(parsed.path).name or "direct_media"
            
            content_length = resp.headers.get("content-length")
            filesize = int(content_length) if content_length and content_length.isdigit() else None

            ext = Path(filename).suffix.lstrip(".").lower() or ("mp4" if is_video else "mp3")
            title = sanitize_filename(Path(filename).stem, fallback="Direct Media")
            
            formats = [
                VideoFormatInfo(
                    format_id="direct",
                    resolution="Source Quality",
                    ext=ext,
                    vcodec="native" if is_video else "none",
                    acodec="native",
                    filesize=filesize,
                    is_video=is_video,
                    is_audio=True,
                    is_muxed=is_video
                )
            ]

            return VideoMetadata(
                url=url,
                title=title,
                source_host=parsed.netloc,
                thumbnail=None,
                duration=None,
                uploader=parsed.netloc,
                available_resolutions=["best", "Source Quality"],
                available_codecs=["native"],
                available_containers=[ext],
                estimated_size_bytes=filesize,
                is_direct_file=True,
                formats=formats
            )
    except Exception:
        return None


def _extract_sync(url: str, allow_playlist: bool = False) -> Dict[str, Any]:
    """Synchronous extraction via yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': not allow_playlist,
        'socket_timeout': REQUEST_TIMEOUT_SECONDS,
        'retries': 2,
        'skip_download': True,
        'cachedir': False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


async def extract_metadata(url: str, allow_playlist: bool = False) -> VideoMetadata:
    """
    Extract metadata and available formats for a given URL.
    Safely handles SSRF, direct file URLs, and yt-dlp extractors.
    """
    # 1. First validate SSRF security
    is_safe, error_msg = validate_url_security(url, check_dns=True)
    if not is_safe:
        parsed = urllib.parse.urlsplit(url)
        return VideoMetadata(
            url=url,
            title="Access Restricted",
            source_host=parsed.netloc or "Unknown",
            extraction_error=error_msg or "URL is not permitted"
        )

    parsed = urllib.parse.urlsplit(url)
    source_host = parsed.netloc

    # 2. Check if it's a direct media file
    if is_direct_file_url(url):
        direct_meta = await probe_direct_file(url)
        if direct_meta:
            return direct_meta

    # 3. Use yt-dlp extractor in thread pool to avoid blocking async loop
    loop = asyncio.get_running_loop()
    try:
        info_dict = await loop.run_in_executor(None, _extract_sync, url, allow_playlist)
    except Exception as e:
        # Check direct media fallback
        direct_meta = await probe_direct_file(url)
        if direct_meta:
            return direct_meta
            
        err_msg = classify_extractor_error(str(e))
        return VideoMetadata(
            url=url,
            title="Unavailable",
            source_host=source_host,
            extraction_error=err_msg
        )

    if not info_dict:
        return VideoMetadata(
            url=url,
            title="Unavailable",
            source_host=source_host,
            extraction_error="No media streams could be located for this URL."
        )

    # If it resolved to a playlist, take the first entry if not allow_playlist
    if 'entries' in info_dict:
        entries = [e for e in info_dict['entries'] if e]
        if entries:
            info_dict = entries[0]
        else:
            return VideoMetadata(
                url=url,
                title="Empty Playlist",
                source_host=source_host,
                extraction_error="The requested playlist does not contain any accessible videos."
            )

    raw_title = info_dict.get('title') or "Untitled Video"
    title = sanitize_filename(raw_title, fallback="video")
    thumbnail = info_dict.get('thumbnail')
    duration = info_dict.get('duration')
    uploader = info_dict.get('uploader') or info_dict.get('channel') or info_dict.get('creator')

    # Format parsing
    formats_list: List[VideoFormatInfo] = []
    resolutions_set = set()
    codecs_set = set()
    containers_set = set()
    max_filesize: Optional[int] = None

    raw_formats = info_dict.get('formats') or []
    
    # If no formats array but direct url/protocol
    if not raw_formats and info_dict.get('url'):
        ext = info_dict.get('ext') or 'mp4'
        formats_list.append(
            VideoFormatInfo(
                format_id="best",
                resolution="Source Quality",
                ext=ext,
                is_video=True,
                is_audio=True,
                is_muxed=True
            )
        )
        resolutions_set.add("best")
        containers_set.add(ext)

    for fmt in raw_formats:
        fmt_id = str(fmt.get('format_id', ''))
        vcodec = fmt.get('vcodec') or 'none'
        acodec = fmt.get('acodec') or 'none'
        ext = fmt.get('ext') or 'mp4'
        height = fmt.get('height')
        width = fmt.get('width')
        filesize = fmt.get('filesize')
        filesize_approx = fmt.get('filesize_approx')
        tbr = fmt.get('tbr')
        fps = fmt.get('fps')
        note = fmt.get('format_note')

        is_video = vcodec != 'none'
        is_audio = acodec != 'none'
        is_muxed = is_video and is_audio

        if not is_video and not is_audio:
            continue

        res_label = None
        if height:
            res_label = f"{height}p"
            resolutions_set.add(res_label)
        elif not is_video and is_audio:
            res_label = "Audio only"
            resolutions_set.add("audio_only")

        if is_video and vcodec != 'none':
            codecs_set.add(vcodec.split('.')[0])
        if is_audio and acodec != 'none':
            codecs_set.add(acodec.split('.')[0])

        if ext:
            containers_set.add(ext)

        effective_size = filesize or filesize_approx
        if effective_size and (max_filesize is None or effective_size > max_filesize):
            max_filesize = effective_size

        formats_list.append(VideoFormatInfo(
            format_id=fmt_id,
            resolution=res_label,
            height=height,
            width=width,
            ext=ext,
            vcodec=vcodec,
            acodec=acodec,
            filesize=filesize,
            filesize_approx=filesize_approx,
            tbr=tbr,
            fps=fps,
            is_video=is_video,
            is_audio=is_audio,
            is_muxed=is_muxed,
            note=note
        ))

    # Sort resolutions numerically descending
    def res_key(r: str) -> int:
        if r.endswith('p') and r[:-1].isdigit():
            return int(r[:-1])
        if r == "best":
            return 99999
        if r == "audio_only":
            return 0
        return -1

    sorted_resolutions = sorted(list(resolutions_set), key=res_key, reverse=True)
    if "best" not in sorted_resolutions:
        sorted_resolutions.insert(0, "best")

    return VideoMetadata(
        url=url,
        title=title,
        source_host=source_host,
        thumbnail=thumbnail,
        duration=float(duration) if duration else None,
        uploader=uploader,
        available_resolutions=sorted_resolutions,
        available_codecs=sorted(list(codecs_set)),
        available_containers=sorted(list(containers_set)),
        estimated_size_bytes=max_filesize,
        is_direct_file=False,
        formats=formats_list,
        extraction_error=None
    )
