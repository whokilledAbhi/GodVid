import os
import time
import shutil
import logging
import asyncio
import urllib.parse
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, Callable
import httpx
import yt_dlp

from app.config import (
    DOWNLOAD_DIR, TEMP_DIR, FFMPEG_BINARY, FFPROBE_BINARY,
    REQUEST_TIMEOUT_SECONDS, get_yt_dlp_js_runtimes, ARIA2_BINARY
)
from app.models import DownloadJob, JobProgress
from app.security import sanitize_filename, ensure_path_within_dir
from app.sniffer import sniff_page_media, USER_AGENT

logger = logging.getLogger("downloader")


def build_format_selector(quality: str, container: str) -> str:
    """
    Build yt-dlp format selector string prioritizing best streams, resolution constraints, and audio encoding.
    """
    q = (quality or "best").lower().strip()
    
    if q == "audio_only":
        return "bestaudio/best"

    if q.endswith("p") and q[:-1].isdigit():
        height = int(q[:-1])
        return f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/bestvideo+bestaudio/best"

    return "bestvideo+bestaudio/best"


def resolve_filename_collision(target_path: Path) -> Path:
    """
    If file already exists, create unique name like title_1.mp4.
    """
    if not target_path.exists():
        return target_path

    directory = target_path.parent
    stem = target_path.stem
    suffix = target_path.suffix
    counter = 1
    
    while True:
        new_path = directory / f"{stem}_{counter}{suffix}"
        if not new_path.exists():
            return new_path
        counter += 1


def verify_media_file(filepath: Path) -> Tuple[bool, Optional[str], Optional[str], Optional[int]]:
    """
    Verify the downloaded file using ffprobe.
    Returns: (is_valid, actual_resolution, actual_container, size_bytes)
    """
    if not filepath.exists() or not filepath.is_file():
        return False, None, None, 0

    size_bytes = filepath.stat().st_size
    if size_bytes < 512:
        return False, None, None, size_bytes

    actual_container = filepath.suffix.lstrip(".").lower()
    actual_res = None

    if FFPROBE_BINARY and shutil.which(FFPROBE_BINARY):
        try:
            cmd = [
                FFPROBE_BINARY,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                str(filepath)
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            if res.returncode == 0 and res.stdout.strip():
                dim = res.stdout.strip().split("\n")[0]
                if "x" in dim:
                    w, h = dim.split("x")
                    # For vertical videos, min(w, h) is typically standard quality identifier, or h
                    actual_res = f"{h}p"
        except Exception:
            pass

    return True, actual_res, actual_container, size_bytes


async def download_direct_file(
    job: DownloadJob,
    progress_callback: Callable[[JobProgress], None],
    cancel_event: asyncio.Event,
    referer: Optional[str] = None
) -> Path:
    """
    Direct file streaming download for native media URLs.
    Prioritizes ultra-fast 16-connection parallel segmented aria2c downloading.
    Falls back to high-throughput buffered async streaming and curl.
    """
    url_path = urllib.parse.urlsplit(job.url).path.rstrip("/")
    ext = Path(url_path).suffix or ".mp4"
    if not ext.startswith("."):
        ext = f".{ext}"

    if job.title:
        clean_stem = sanitize_filename(job.title, fallback=f"video_{job.id}")
        safe_name = f"{clean_stem}{ext}"
    else:
        safe_name = sanitize_filename(job.output_filename or f"video_{job.id}{ext}", fallback=f"video_{job.id}{ext}")

    target_path = resolve_filename_collision(DOWNLOAD_DIR / safe_name)
    temp_path = TEMP_DIR / f"{job.id}_{safe_name}.part"
    aria2_ctrl = TEMP_DIR / f"{job.id}_{safe_name}.part.aria2"

    start_time = time.time()
    last_update_time = start_time
    downloaded_bytes = 0

    progress_callback(JobProgress(
        percentage=0.0,
        downloaded_bytes=0,
        total_bytes=None,
        speed_bytes_sec=0.0,
        eta_seconds=None,
        elapsed_seconds=0.0,
        current_step="Connecting to media stream"
    ))

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "*/*",
    }
    if referer:
        headers["Referer"] = referer

    # Pre-resolve HTTP 301/302 redirects to extract final CDN endpoint and exact content size
    target_url = job.url
    total_bytes = None
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True, headers=headers) as head_c:
            hr = await head_c.head(job.url)
            if hr.status_code in (200, 206) and str(hr.url) != job.url:
                target_url = str(hr.url)
                logger.info(f"Pre-resolved direct CDN stream: {target_url}")
            cl = hr.headers.get("content-length")
            if cl and cl.isdigit():
                total_bytes = int(cl)
            cd = hr.headers.get("content-disposition", "")
            if cd and "filename=" in cd and (not job.title or job.title.startswith("video_")):
                m_cd = re.search(r'filename\*?=(?:UTF-8\'\')?["\']?([^"\';]+)["\']?', cd, re.I)
                if m_cd:
                    cd_clean = Path(urllib.parse.unquote(m_cd.group(1)).strip()).stem
                    if cd_clean:
                        job.title = cd_clean
    except Exception as head_err:
        logger.debug(f"Pre-resolve HEAD skipped ({head_err})")

    # 1. Ultra-fast multi-threaded aria2c turbo engine (16 concurrent chunks)
    if ARIA2_BINARY and Path(ARIA2_BINARY).exists():
        try:
            logger.info(f"Launching 16-connection aria2c turbo download for {target_url}")
            aria2_cmd = [
                str(ARIA2_BINARY),
                "-x", "16",
                "-s", "16",
                "-j", "16",
                "-k", "512K",
                "--min-split-size=512K",
                "--max-connection-per-server=16",
                "--file-allocation=none",
                "--check-certificate=false",
                "--allow-overwrite=true",
                "--auto-file-renaming=false",
                "--summary-interval=1",
                "--console-log-level=warn",
                "--stream-piece-selector=geom",
                "--timeout=30",
                "--user-agent", USER_AGENT,
                "-d", str(TEMP_DIR),
                "-o", f"{job.id}_{safe_name}.part",
                target_url
            ]
            if referer:
                aria2_cmd.extend(["--referer", referer])

            proc = await asyncio.create_subprocess_exec(
                *aria2_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            last_prog = time.time()
            while proc.returncode is None:
                if cancel_event.is_set():
                    try:
                        proc.kill()
                    except Exception:
                        pass
                    if temp_path.exists():
                        temp_path.unlink()
                    if aria2_ctrl.exists():
                        aria2_ctrl.unlink()
                    raise asyncio.CancelledError("Download cancelled by user")

                await asyncio.sleep(0.35)
                now = time.time()
                if temp_path.exists():
                    curr_sz = temp_path.stat().st_size
                    elapsed = now - start_time
                    speed = (curr_sz / elapsed) if elapsed > 0 else 0
                    eta = ((total_bytes - curr_sz) / speed) if (total_bytes and speed > 0 and total_bytes > curr_sz) else None
                    pct = min(99.0, (curr_sz / total_bytes * 100)) if total_bytes else 50.0

                    if now - last_prog >= 0.35:
                        progress_callback(JobProgress(
                            percentage=round(pct, 1),
                            downloaded_bytes=curr_sz,
                            total_bytes=total_bytes,
                            speed_bytes_sec=round(speed, 2),
                            eta_seconds=round(eta, 1) if eta else None,
                            elapsed_seconds=round(elapsed, 1),
                            current_step=f"Downloading ({round(speed/1024/1024, 1)} MB/s • 16-Thread Turbo)" if speed else "Downloading media stream"
                        ))
                        last_prog = now

                if proc.poll() is not None:
                    break

            await proc.wait()
            if proc.returncode == 0 and temp_path.exists() and temp_path.stat().st_size > 1024:
                if aria2_ctrl.exists():
                    try:
                        aria2_ctrl.unlink()
                    except Exception:
                        pass
                ensure_path_within_dir(target_path, DOWNLOAD_DIR)
                shutil.move(str(temp_path), str(target_path))
                return target_path
            else:
                logger.warning(f"aria2c returned code {proc.returncode}; falling back to high-buffer streaming...")
        except asyncio.CancelledError:
            raise
        except Exception as aria_err:
            logger.warning(f"aria2c execution error ({aria_err}); falling back to streaming...")
        finally:
            if aria2_ctrl.exists():
                try:
                    aria2_ctrl.unlink()
                except Exception:
                    pass

    # 2. High-performance buffered streaming fallback (2 MB buffer)
    try:
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=40)
        async with httpx.AsyncClient(timeout=45.0, follow_redirects=True, headers=headers, limits=limits) as client:
            async with client.stream("GET", job.url) as response:
                if response.status_code not in (200, 206):
                    raise RuntimeError(f"HTTP {response.status_code} received from server")

                content_len = response.headers.get("content-length")
                total_bytes = int(content_len) if content_len and content_len.isdigit() else None

                with open(temp_path, "wb", buffering=2 * 1024 * 1024) as f:
                    async for chunk in response.aiter_bytes(chunk_size=1024 * 1024 * 2):
                        if cancel_event.is_set():
                            raise asyncio.CancelledError("Download cancelled by user")

                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        now = time.time()

                        if now - last_update_time >= 0.35:
                            elapsed = now - start_time
                            speed = downloaded_bytes / elapsed if elapsed > 0 else 0
                            eta = ((total_bytes - downloaded_bytes) / speed) if (total_bytes and speed > 0 and total_bytes > downloaded_bytes) else None
                            pct = (downloaded_bytes / total_bytes * 100) if total_bytes else 0.0

                            progress_callback(JobProgress(
                                percentage=round(pct, 1),
                                downloaded_bytes=downloaded_bytes,
                                total_bytes=total_bytes,
                                speed_bytes_sec=round(speed, 2),
                                eta_seconds=round(eta, 1) if eta else None,
                                elapsed_seconds=round(elapsed, 1),
                                current_step=f"Downloading ({round(speed/1024/1024, 1)} MB/s)" if speed else "Downloading media file"
                            ))
                            last_update_time = now

        # Move from temp to final destination
        ensure_path_within_dir(target_path, DOWNLOAD_DIR)
        shutil.move(str(temp_path), str(target_path))
        return target_path

    except Exception as exc:
        if cancel_event.is_set():
            raise asyncio.CancelledError("Download cancelled by user")

        logger.info(f"httpx stream failed ({exc}); falling back to Windows Schannel curl for {job.url}...")
        loop = asyncio.get_running_loop()
        curl_bin = shutil.which("curl") or "curl.exe"
        curl_cmd = [
            curl_bin,
            "-L",
            "--ssl-no-revoke",
            "-A", USER_AGENT,
            "--buffer-size", "2097152",
            "--max-time", "1800",
            "-o", str(temp_path),
            job.url
        ]
        if referer:
            curl_cmd.extend(["-e", referer])

        p = await loop.run_in_executor(None, lambda: subprocess.run(curl_cmd, capture_output=True))
        if p.returncode == 0 and temp_path.exists() and temp_path.stat().st_size > 1024:
            ensure_path_within_dir(target_path, DOWNLOAD_DIR)
            shutil.move(str(temp_path), str(target_path))
            return target_path

        raise exc

    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass


def download_with_ytdlp_sync(
    job: DownloadJob,
    progress_callback: Callable[[JobProgress], None],
    cancel_event: asyncio.Event,
    referer: Optional[str] = None
) -> Path:
    """
    Download video and merge streams preserving original stream quality.
    Accelerated with 16-connection parallel chunk downloading and 16 concurrent fragments.
    """
    format_selector = build_format_selector(job.requested_quality, job.preferred_container)

    # Safe output template
    temp_template = str(TEMP_DIR / f"{job.id}_%(title).100s [%(resolution)s].%(ext)s")
    start_time = time.time()
    last_hook_time = [start_time]

    def ytdlp_progress_hook(d: Dict[str, Any]):
        if cancel_event.is_set():
            raise asyncio.CancelledError("Job cancelled by user")

        now = time.time()
        status = d.get('status')

        if status == 'downloading':
            if now - last_hook_time[0] < 0.3:
                return
            last_hook_time[0] = now

            downloaded = d.get('downloaded_bytes') or 0
            total = d.get('total_bytes') or d.get('total_bytes_estimate')
            if total: estimated_total[0] = total
            speed = d.get('speed') or 0.0
            eta = d.get('eta')
            elapsed = now - start_time
            pct = 0.0
            if total and total > 0:
                pct = min(99.0, (downloaded / total) * 100.0)
            elif downloaded > 0:
                pct = 50.0

            progress_callback(JobProgress(
                percentage=round(pct, 1),
                downloaded_bytes=downloaded,
                total_bytes=total,
                speed_bytes_sec=round(speed, 2) if speed else None,
                eta_seconds=round(eta, 1) if eta else None,
                elapsed_seconds=round(elapsed, 1),
                current_step=f"Downloading ({round(speed/1024/1024, 1)} MB/s • Turbo)" if speed else "Downloading media stream"
            ))

        elif status == 'finished':
            progress_callback(JobProgress(
                percentage=99.0,
                downloaded_bytes=d.get('total_bytes') or 0,
                total_bytes=d.get('total_bytes'),
                speed_bytes_sec=None,
                eta_seconds=None,
                elapsed_seconds=round(now - start_time, 1),
                current_step="Merging video and audio streams"
            ))

    ydl_opts: Dict[str, Any] = {
        'format': format_selector,
        'outtmpl': temp_template,
        'progress_hooks': [ytdlp_progress_hook],
        'socket_timeout': REQUEST_TIMEOUT_SECONDS,
        'retries': 5,
        'fragment_retries': 10,
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'overwrites': True,
        'extractor_args': {
            'youtube': {
                'player_client': ['android', 'ios', 'web_creator']
            }
        },
        'noplaylist': True,
        'playlist_items': '1',
        # Turbocharged 16-fragment parallel downloading
        'concurrent_fragment_downloads': 16,
        'buffersize': 16 * 1024 * 1024,
    }

    # Integrate aria2c 16-connection multi-part downloader when available
    if ARIA2_BINARY and Path(ARIA2_BINARY).exists():
        ydl_opts['external_downloader'] = {
            'http': str(ARIA2_BINARY),
            'https': str(ARIA2_BINARY),
        }
        ydl_opts['external_downloader_args'] = {
            'aria2c': [
                '-x', '16',
                '-s', '16',
                '-k', '1M',
                '--file-allocation=none',
                '--summary-interval=0',
                '--console-log-level=warn',
                '--max-connection-per-server=16',
                '--min-split-size=1M',
            ]
        }

    if referer:
        ydl_opts['http_headers'] = {
            'Referer': referer,
            'User-Agent': USER_AGENT
        }

    # Container preference & stream remuxing
    if job.preferred_container and job.preferred_container != "auto":
        ydl_opts['merge_output_format'] = job.preferred_container

    js_r = get_yt_dlp_js_runtimes()
    if js_r:
        ydl_opts['js_runtimes'] = js_r

    # Add ffmpeg location if available
    ffmpeg_dir = Path(FFMPEG_BINARY).parent
    if ffmpeg_dir.exists():
        ydl_opts['ffmpeg_location'] = str(ffmpeg_dir)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(job.url, download=True)
    except Exception as ydl_err:
        # If external downloader fails on a specific stream, auto-retry with native 16-thread downloader
        if 'external_downloader' in ydl_opts:
            logger.warning(f"aria2c external downloader encountered {ydl_err}; retrying with native 16-thread engine...")
            ydl_opts.pop('external_downloader', None)
            ydl_opts.pop('external_downloader_args', None)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(job.url, download=True)
        else:
            raise ydl_err

    if info:
        ytdlp_title = info.get('title')
        if ytdlp_title and str(ytdlp_title).strip():
            job.title = str(ytdlp_title).strip()
        if not job.thumbnail:
            job.thumbnail = info.get('thumbnail')
        if not job.duration:
            job.duration = info.get('duration')
        if not job.uploader:
            job.uploader = info.get('uploader') or info.get('channel')
    final_filename = ydl.prepare_filename(info)

    # In case merging changed the extension
    merged_ext = ydl_opts.get('merge_output_format')
    if merged_ext:
        base, _ = os.path.splitext(final_filename)
        candidate = f"{base}.{merged_ext}"
        if os.path.exists(candidate):
            final_filename = candidate

    temp_file = Path(final_filename)
    if not temp_file.exists():
        matches = list(TEMP_DIR.glob(f"{job.id}_*"))
        if matches:
            temp_file = matches[0]
        else:
            raise FileNotFoundError("Downloaded media file could not be located in output directory")

    # Give priority to job.title for output filename if available
    if job.title:
        clean_title = sanitize_filename(job.title, fallback=f"video_{job.id}")
        safe_name = f"{clean_title}{temp_file.suffix}"
    else:
        safe_name = sanitize_filename(temp_file.name[len(job.id) + 1:], fallback=f"video_{job.id}{temp_file.suffix}")

    target_path = resolve_filename_collision(DOWNLOAD_DIR / safe_name)
    ensure_path_within_dir(target_path, DOWNLOAD_DIR)
    shutil.move(str(temp_file), str(target_path))

    return target_path


async def execute_download_job(
    job: DownloadJob,
    progress_callback: Callable[[JobProgress], None],
    cancel_event: asyncio.Event
) -> Tuple[Path, Optional[str], Optional[str], int]:
    """
    Main asynchronous job execution dispatcher with Universal Sniffer fallback.
    Returns: (output_filepath, actual_resolution, actual_container, file_size_bytes)
    """
    loop = asyncio.get_running_loop()

    # Direct media URL check (including query strings and trailing slashes)
    clean_url_stem = job.url.lower().split("?")[0].rstrip("/")
    is_direct = any(clean_url_stem.endswith(ext) for ext in [
        ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".mp3", ".wav"
    ])

    if is_direct:
        output_path = await download_direct_file(job, progress_callback, cancel_event)
    else:
        # Pre-emptively check Universal Sniffer on non-major/tube platforms to bypass generic playlist traps
        is_major_native = any(d in job.url.lower() for d in [
            "youtube.com", "youtu.be", "vimeo.com", "tiktok.com",
            "twitter.com", "x.com", "twitch.tv", "instagram.com", "facebook.com", "reddit.com"
        ])
        direct_stream_found = False

        if not is_major_native:
            try:
                sniff_res = await loop.run_in_executor(None, sniff_page_media, job.url)
                if sniff_res and sniff_res.get("stream_url"):
                    resolved_stream = sniff_res["stream_url"]
                    referer_url = sniff_res.get("referer") or job.url

                    if sniff_res.get("title") and (not job.title or job.title == job.url):
                        job.title = sniff_res["title"]
                    if sniff_res.get("thumbnail") and not job.thumbnail:
                        job.thumbnail = sniff_res["thumbnail"]

                    logger.info(f"Universal Sniffer direct resolved: {resolved_stream}")
                    candidate_pool = sniff_res.get("all_candidates") or [resolved_stream]
                    
                    for cand in candidate_pool[:5]:
                        cand_clean = cand.lower().split("?")[0].rstrip("/")
                        is_cand_direct = any(cand_clean.endswith(ext) for ext in [
                            ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".mp3", ".wav"
                        ])
                        stream_job = job.model_copy(update={"url": cand})
                        try:
                            if is_cand_direct:
                                output_path = await download_direct_file(
                                    stream_job,
                                    progress_callback,
                                    cancel_event,
                                    referer=referer_url
                                )
                            else:
                                output_path = await loop.run_in_executor(
                                    None,
                                    download_with_ytdlp_sync,
                                    stream_job,
                                    progress_callback,
                                    cancel_event,
                                    referer_url
                                )
                            direct_stream_found = True
                            break
                        except Exception as cand_err:
                            logger.warning(f"Candidate {cand} failed ({cand_err}); falling to next candidate...")
            except Exception as sniff_err:
                logger.debug(f"Pre-emptive sniffer check failed, falling back to yt-dlp: {sniff_err}")

        if not direct_stream_found:
            try:
                # 1. Primary: yt-dlp native extraction & download
                output_path = await loop.run_in_executor(
                    None,
                    download_with_ytdlp_sync,
                    job,
                    progress_callback,
                    cancel_event,
                    None
                )
            except Exception as primary_err:
                logger.info(f"Primary yt-dlp failed for {job.url}: {primary_err}. Attempting Universal Sniffer fallback...")
                
                # 2. Universal Sniffer Fallback
                sniff_res = await loop.run_in_executor(None, sniff_page_media, job.url)
                if not sniff_res or not sniff_res.get("stream_url"):
                    raise primary_err

                resolved_stream = sniff_res["stream_url"]
                referer_url = sniff_res.get("referer") or job.url

                # Update job info from sniffer
                if sniff_res.get("title") and (not job.title or job.title == job.url):
                    job.title = sniff_res["title"]
                if sniff_res.get("thumbnail") and not job.thumbnail:
                    job.thumbnail = sniff_res["thumbnail"]

                logger.info(f"Universal Sniffer extracted stream URL: {resolved_stream}")

                # Create clone job with resolved stream URL
                stream_job = job.model_copy(update={"url": resolved_stream})

                clean_stream_stem = resolved_stream.lower().split("?")[0].rstrip("/")
                is_stream_direct = any(clean_stream_stem.endswith(ext) for ext in [
                    ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".mp3", ".wav"
                ])

                if is_stream_direct:
                    try:
                        output_path = await download_direct_file(
                            stream_job,
                            progress_callback,
                            cancel_event,
                            referer=referer_url
                        )
                    except Exception as direct_err:
                        logger.warning(f"Direct stream download failed ({direct_err}), retrying via yt-dlp...")
                        output_path = await loop.run_in_executor(
                            None,
                            download_with_ytdlp_sync,
                            stream_job,
                            progress_callback,
                            cancel_event,
                            referer_url
                        )
                else:
                    output_path = await loop.run_in_executor(
                        None,
                        download_with_ytdlp_sync,
                        stream_job,
                        progress_callback,
                        cancel_event,
                        referer_url
                    )

    # Verification phase
    is_valid, actual_res, actual_container, size = verify_media_file(output_path)
    if not is_valid:
        if output_path.exists():
            try:
                output_path.unlink()
            except Exception:
                pass
        raise RuntimeError("Downloaded media file is empty or corrupted.")

    return output_path, actual_res, actual_container, size
