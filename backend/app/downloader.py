import asyncio
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Optional, Callable, Dict, Any, Tuple
import httpx
import yt_dlp

from app.config import (
    DOWNLOAD_DIR, TEMP_DIR, FFMPEG_BINARY, FFPROBE_BINARY,
    DOWNLOAD_TIMEOUT_SECONDS
)
from app.models import DownloadJob, JobStatus, JobProgress
from app.security import sanitize_filename, ensure_path_within_dir


def build_format_selector(quality: str, container: str) -> str:
    """
    Build yt-dlp format selection string preserving original quality without lossy re-encoding.
    """
    q = (quality or "best").lower().strip()
    
    if q == "audio_only":
        return "bestaudio/best"

    if q.endswith("p") and q[:-1].isdigit():
        height = int(q[:-1])
        # Try to find best video up to requested height + best audio, fallback to best single stream
        return f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/bestvideo+bestaudio/best"

    # Default: Best available video + audio, or single best
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
    if not filepath.exists():
        return False, None, None, None

    size_bytes = filepath.stat().st_size
    if size_bytes == 0:
        return False, None, None, 0

    actual_container = filepath.suffix.lstrip(".").lower()
    actual_res = None

    # Probe file with ffprobe if binary is present
    if shutil.which(FFPROBE_BINARY):
        try:
            cmd = [
                FFPROBE_BINARY,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                str(filepath)
            ]
            res = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=15
            )
            dim = res.stdout.strip()
            if dim and "x" in dim:
                actual_res = f"{dim.split('x')[1]}p ({dim})"
        except Exception:
            pass

    return True, actual_res, actual_container, size_bytes


async def download_direct_file(
    job: DownloadJob,
    progress_callback: Callable[[JobProgress], None],
    cancel_event: asyncio.Event
) -> Path:
    """
    Direct file streaming download for native media URLs.
    Avoids loading files into memory by streaming chunks to disk.
    """
    filename = job.output_filename or f"{job.id}.mp4"
    safe_name = sanitize_filename(filename, fallback=f"video_{job.id}.mp4")
    target_path = resolve_filename_collision(DOWNLOAD_DIR / safe_name)
    temp_path = TEMP_DIR / f"{job.id}_{safe_name}.part"

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
        current_step="Starting direct stream download"
    ))

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            async with client.stream("GET", job.url) as response:
                if response.status_code not in (200, 206):
                    raise RuntimeError(f"HTTP {response.status_code} received from server")

                content_len = response.headers.get("content-length")
                total_bytes = int(content_len) if content_len and content_len.isdigit() else None

                with open(temp_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=1024 * 64):
                        if cancel_event.is_set():
                            raise asyncio.CancelledError("Download cancelled by user")

                        f.write(chunk)
                        downloaded_bytes += len(chunk)
                        now = time.time()

                        if now - last_update_time >= 0.5:
                            elapsed = now - start_time
                            speed = downloaded_bytes / elapsed if elapsed > 0 else 0
                            eta = ((total_bytes - downloaded_bytes) / speed) if (total_bytes and speed > 0) else None
                            pct = (downloaded_bytes / total_bytes * 100) if total_bytes else 0.0

                            progress_callback(JobProgress(
                                percentage=round(pct, 1),
                                downloaded_bytes=downloaded_bytes,
                                total_bytes=total_bytes,
                                speed_bytes_sec=round(speed, 2),
                                eta_seconds=round(eta, 1) if eta else None,
                                elapsed_seconds=round(elapsed, 1),
                                current_step="Streaming media file"
                            ))
                            last_update_time = now

        # Move from temp to final destination
        ensure_path_within_dir(target_path, DOWNLOAD_DIR)
        shutil.move(str(temp_path), str(target_path))
        return target_path

    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass


def download_with_ytdlp_sync(
    job: DownloadJob,
    progress_callback: Callable[[JobProgress], None],
    cancel_event: asyncio.Event
) -> Path:
    """
    Download video and merge streams preserving original stream quality.
    Stream-copy / remux via FFmpeg without unnecessary transcoding.
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
            # Throttle progress notifications to ~300ms
            if now - last_hook_time[0] < 0.3:
                return
            last_hook_time[0] = now

            downloaded = d.get('downloaded_bytes') or 0
            total = d.get('total_bytes') or d.get('total_bytes_estimate')
            speed = d.get('speed')
            eta = d.get('eta')
            elapsed = now - start_time

            pct = 0.0
            if total and total > 0:
                pct = (downloaded / total) * 100.0
            elif d.get('_percent_str'):
                try:
                    clean_str = d['_percent_str'].replace('%', '').strip()
                    pct = float(clean_str)
                except Exception:
                    pass

            progress_callback(JobProgress(
                percentage=round(min(pct, 99.0), 1),
                downloaded_bytes=downloaded,
                total_bytes=total,
                speed_bytes_sec=float(speed) if speed else None,
                eta_seconds=float(eta) if eta else None,
                elapsed_seconds=round(elapsed, 1),
                current_step="Downloading media stream"
            ))

        elif status == 'finished':
            progress_callback(JobProgress(
                percentage=99.0,
                downloaded_bytes=d.get('downloaded_bytes') or 0,
                total_bytes=d.get('total_bytes'),
                speed_bytes_sec=None,
                eta_seconds=None,
                elapsed_seconds=round(now - start_time, 1),
                current_step="Merging and verifying audio/video streams"
            ))

    ydl_opts: Dict[str, Any] = {
        'format': format_selector,
        'outtmpl': temp_template,
        'progress_hooks': [ytdlp_progress_hook],
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'cachedir': False,
        'socket_timeout': 30,
        'retries': 3,
        'fragment_retries': 3,
    }

    # Container preference & stream remuxing
    if job.preferred_container and job.preferred_container != "auto":
        ydl_opts['merge_output_format'] = job.preferred_container

    # Add ffmpeg location if available
    ffmpeg_dir = Path(FFMPEG_BINARY).parent
    if ffmpeg_dir.exists():
        ydl_opts['ffmpeg_location'] = str(ffmpeg_dir)

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(job.url, download=True)
        final_filename = ydl.prepare_filename(info)

        # In case merging changed the extension (e.g. mkv or mp4)
        merged_ext = ydl_opts.get('merge_output_format')
        if merged_ext:
            base, _ = os.path.splitext(final_filename)
            candidate = f"{base}.{merged_ext}"
            if os.path.exists(candidate):
                final_filename = candidate

        # Locate downloaded file in TEMP_DIR matching job id
        temp_file = Path(final_filename)
        if not temp_file.exists():
            # Check temp dir for file with prefix job.id
            matches = list(TEMP_DIR.glob(f"{job.id}_*"))
            if matches:
                temp_file = matches[0]
            else:
                raise FileNotFoundError("Downloaded media file could not be located in output directory")

        # Move to DOWNLOAD_DIR with safe sanitized name
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
    Main asynchronous job execution dispatcher.
    Returns: (output_filepath, actual_resolution, actual_container, file_size_bytes)
    """
    loop = asyncio.get_running_loop()

    # Determine if it's a direct file or handled by yt-dlp
    is_direct = any(job.url.lower().endswith(ext) for ext in [
        ".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".mp3", ".wav"
    ])

    if is_direct:
        output_path = await download_direct_file(job, progress_callback, cancel_event)
    else:
        # Run yt-dlp download in thread pool to keep event loop responsive
        output_path = await loop.run_in_executor(
            None,
            download_with_ytdlp_sync,
            job,
            progress_callback,
            cancel_event
        )

    # Post-download verification
    is_valid, actual_res, actual_container, size = verify_media_file(output_path)
    if not is_valid:
        if output_path.exists():
            try:
                output_path.unlink()
            except Exception:
                pass
        raise RuntimeError("Downloaded media file is empty or corrupted during merge.")

    return output_path, actual_res, actual_container, size
