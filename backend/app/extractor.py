import asyncio
import os
import re
import urllib.parse
from pathlib import Path
from typing import Dict, Any, List, Optional
import httpx
import yt_dlp

from app.config import (
    REQUEST_TIMEOUT_SECONDS, get_yt_dlp_js_runtimes
)
from app.models import VideoMetadata, VideoFormatInfo
from app.security import validate_url_security, sanitize_filename
from app.sniffer import sniff_page_media, USER_AGENT


def classify_extractor_error(err_str: str) -> str:
    """Classify raw error strings into helpful, user-friendly messages."""
    err_lower = err_str.lower()
    if "private video" in err_lower:
        return "This video is private or restricted by the uploader."
    if "sign in" in err_lower or "login" in err_lower:
        return "This video requires login or authentication."
    if "geolocation" in err_lower or "not available in your country" in err_lower:
        return "This video is restricted by geographical region."
    if "copyright" in err_lower or "takedown" in err_lower:
        return "This video has been taken down due to copyright restrictions."
    if "unsupported url" in err_lower or "not a valid url" in err_lower:
        return "The URL or source website is not currently supported for video extraction."
    if "404" in err_lower or "not found" in err_lower:
        return "The requested video was not found (HTTP 404)."
    if "timeout" in err_lower or "timed out" in err_lower:
        return "Connection timed out while attempting to contact video host."
    return f"Extraction failed: {err_str[:120]}"


def is_direct_file_url(url: str) -> bool:
    """Check if URL points directly to a known media file extension."""
    path = urllib.parse.urlsplit(url).path.lower().split("?")[0].rstrip("/")
    return any(path.endswith(ext) for ext in [
        ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".mp3", ".m4a", ".wav"
    ])


async def probe_direct_file(url: str, referer: Optional[str] = None) -> Optional[VideoMetadata]:
    """Inspect headers of direct media URLs."""
    headers = {"User-Agent": USER_AGENT}
    if referer:
        headers["Referer"] = referer

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, headers=headers) as client:
            resp = await client.head(url)
            if resp.status_code not in (200, 206):
                resp = await client.get(url, headers={"Range": "bytes=0-1024"})
                if resp.status_code not in (200, 206):
                    return None

            content_type = resp.headers.get("content-type", "").lower()
            is_video = "video/" in content_type or is_direct_file_url(url)
            is_audio = "audio/" in content_type

            if not (is_video or is_audio):
                return None

            parsed = urllib.parse.urlsplit(url)
            clean_path = parsed.path.rstrip("/")
            filename = Path(clean_path).name or "direct_media"
            
            content_length = resp.headers.get("content-length")
            filesize = int(content_length) if content_length and content_length.isdigit() else None

            ext = Path(filename).suffix.lstrip(".").lower() or ("mp4" if is_video else "mp3")
            title = Path(filename).stem or "Direct Media"
            
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
        pass

    # Resilient curl HEAD probe fallback (bypasses TLS handshake / WinError 10054)
    try:
        loop = asyncio.get_running_loop()
        curl_bin = shutil.which("curl") or "curl.exe"
        cmd = [
            curl_bin,
            "-s",
            "-I",
            "--ssl-no-revoke",
            "-L",
            "-A", USER_AGENT,
            "--max-time", "12",
            url
        ]
        if referer:
            cmd.extend(["-e", referer])
        
        p = await loop.run_in_executor(None, lambda: subprocess.run(cmd, capture_output=True, timeout=15))
        if p.returncode == 0 and p.stdout:
            header_text = p.stdout.decode("utf-8", errors="ignore")
            content_type = ""
            filesize = None
            for line in header_text.splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    k_lower = k.strip().lower()
                    if k_lower == "content-type":
                        content_type = v.strip().lower()
                    elif k_lower == "content-length" and v.strip().isdigit():
                        filesize = int(v.strip())

            is_video = "video/" in content_type or is_direct_file_url(url)
            is_audio = "audio/" in content_type

            if is_video or is_audio:
                parsed = urllib.parse.urlsplit(url)
                clean_path = parsed.path.rstrip("/")
                filename = Path(clean_path).name or "direct_media"
                ext = Path(filename).suffix.lstrip(".").lower() or ("mp4" if is_video else "mp3")
                title = Path(filename).stem or "Direct Media"

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
        pass

    return None


def _extract_sync(url: str, allow_playlist: bool = False, referer: Optional[str] = None) -> Dict[str, Any]:
    """Synchronous extraction via yt-dlp."""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'noplaylist': not allow_playlist,
        'playlist_items': '1' if not allow_playlist else None,
        'socket_timeout': REQUEST_TIMEOUT_SECONDS,
        'retries': 2,
        'skip_download': True,
        'cachedir': False,
        'user_agent': USER_AGENT,
    }
    if referer:
        ydl_opts['http_headers'] = {'Referer': referer, 'User-Agent': USER_AGENT}

    js_r = get_yt_dlp_js_runtimes()
    if js_r:
        ydl_opts['js_runtimes'] = js_r
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        return ydl.extract_info(url, download=False)


async def extract_metadata(url: str, allow_playlist: bool = False) -> VideoMetadata:
    """
    Extract metadata and available formats for a given URL with Universal Sniffer fallback.
    """
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

    # 1. Direct file check
    if is_direct_file_url(url):
        direct_meta = await probe_direct_file(url)
        if direct_meta:
            return direct_meta

    loop = asyncio.get_running_loop()
    info_dict = None

    # 2. Primary yt-dlp extraction
    try:
        info_dict = await loop.run_in_executor(None, _extract_sync, url, allow_playlist, None)
    except Exception:
        pass

    # 3. Universal Sniffer fallback if primary fails
    if not info_dict:
        sniff_res = await loop.run_in_executor(None, sniff_page_media, url)
        if sniff_res and sniff_res.get("stream_url"):
            stream_url = sniff_res["stream_url"]
            ref = sniff_res.get("referer") or url

            # Probe the resolved stream
            direct_meta = await probe_direct_file(stream_url, referer=ref)
            if direct_meta:
                direct_meta.url = stream_url
                direct_meta.title = sniff_res.get("title") or direct_meta.title
                direct_meta.thumbnail = sniff_res.get("thumbnail") or direct_meta.thumbnail
                direct_meta.source_host = source_host
                return direct_meta

            # Or extract via yt-dlp with referer
            try:
                info_dict = await loop.run_in_executor(None, _extract_sync, stream_url, False, ref)
            except Exception:
                pass

            if not info_dict:
                return VideoMetadata(
                    url=stream_url,
                    title=sniff_res.get("title") or "Web Video",
                    source_host=source_host,
                    thumbnail=sniff_res.get("thumbnail"),
                    available_resolutions=["best"],
                    available_containers=["mp4"],
                    is_direct_file=True,
                    formats=[]
                )

    if not info_dict:
        return VideoMetadata(
            url=url,
            title="Unavailable",
            source_host=source_host,
            extraction_error="The URL or source website is not currently supported for video extraction."
        )

    # Process yt-dlp formats
    raw_formats = info_dict.get('formats', [])
    processed_formats: List[VideoFormatInfo] = []
    resolutions_set = set()
    codecs_set = set()
    containers_set = set()

    for f in raw_formats:
        vcodec = f.get('vcodec') or 'none'
        acodec = f.get('acodec') or 'none'
        is_video = vcodec != 'none'
        is_audio = acodec != 'none'
        ext = f.get('ext') or 'mp4'

        height = f.get('height')
        resolution = f"{height}p" if height else f.get('resolution')

        if resolution and is_video:
            resolutions_set.add(resolution)
        if is_video and vcodec != 'none':
            codecs_set.add(vcodec.split('.')[0])
        containers_set.add(ext)

        fmt_info = VideoFormatInfo(
            format_id=str(f.get('format_id')),
            resolution=resolution,
            height=height,
            width=f.get('width'),
            ext=ext,
            vcodec=vcodec,
            acodec=acodec,
            filesize=f.get('filesize'),
            filesize_approx=f.get('filesize_approx'),
            tbr=f.get('tbr'),
            fps=f.get('fps'),
            is_video=is_video,
            is_audio=is_audio,
            is_muxed=is_video and is_audio,
            note=f.get('format_note')
        )
        processed_formats.append(fmt_info)

    res_list = sorted(
        list(resolutions_set),
        key=lambda x: int(x[:-1]) if x.endswith('p') and x[:-1].isdigit() else 0,
        reverse=True
    )

    return VideoMetadata(
        url=url,
        title=info_dict.get('title') or "Untitled Video",
        source_host=source_host,
        thumbnail=info_dict.get('thumbnail'),
        duration=info_dict.get('duration'),
        uploader=info_dict.get('uploader') or info_dict.get('channel'),
        available_resolutions=res_list,
        available_codecs=list(codecs_set),
        available_containers=list(containers_set),
        estimated_size_bytes=info_dict.get('filesize') or info_dict.get('filesize_approx'),
        is_direct_file=False,
        formats=processed_formats
    )
