import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Tuple

from app.config import (
    FFMPEG_BINARY, FFPROBE_BINARY, ARIA2_BINARY, DOWNLOAD_DIR, TEMP_DIR,
    RETENTION_HOURS
)


def check_system_dependencies() -> Dict[str, Any]:
    """
    Verify presence of FFmpeg, FFprobe, and aria2c turbo downloader.
    """
    ffmpeg_ok = False
    ffmpeg_version = None
    ffprobe_ok = False
    ffprobe_version = None
    aria2_ok = False
    aria2_version = None

    if FFMPEG_BINARY and (shutil.which(FFMPEG_BINARY) or Path(FFMPEG_BINARY).exists()):
        try:
            res = subprocess.run(
                [FFMPEG_BINARY, "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            if res.returncode == 0:
                ffmpeg_ok = True
                ffmpeg_version = res.stdout.splitlines()[0] if res.stdout else "Available"
        except Exception:
            pass

    if FFPROBE_BINARY and (shutil.which(FFPROBE_BINARY) or Path(FFPROBE_BINARY).exists()):
        try:
            res = subprocess.run(
                [FFPROBE_BINARY, "-version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            if res.returncode == 0:
                ffprobe_ok = True
                ffprobe_version = res.stdout.splitlines()[0] if res.stdout else "Available"
        except Exception:
            pass

    if ARIA2_BINARY and (shutil.which(ARIA2_BINARY) or Path(ARIA2_BINARY).exists()):
        try:
            res = subprocess.run(
                [ARIA2_BINARY, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=5
            )
            if res.returncode == 0:
                aria2_ok = True
                aria2_version = res.stdout.splitlines()[0] if res.stdout else "Available"
        except Exception:
            pass

    return {
        "ffmpeg": {
            "available": ffmpeg_ok,
            "version": ffmpeg_version,
            "binary": FFMPEG_BINARY,
            "instructions": "Install FFmpeg via 'winget install Gyan.FFmpeg' on Windows, 'brew install ffmpeg' on macOS, or 'apt install ffmpeg' on Linux."
        },
        "ffprobe": {
            "available": ffprobe_ok,
            "version": ffprobe_version,
            "binary": FFPROBE_BINARY,
            "instructions": "FFprobe is bundled with FFmpeg."
        },
        "aria2": {
            "available": aria2_ok,
            "version": aria2_version,
            "binary": ARIA2_BINARY,
            "instructions": "aria2c turbo downloader enables 16-connection multi-part downloads."
        }
    }


def cleanup_expired_files(retention_hours: int = RETENTION_HOURS):
    """
    Delete temporary or completed files older than the retention threshold.
    """
    now = time.time()
    cutoff = now - (retention_hours * 3600)

    # Clean temp dir of files older than 1 hour or cancelled parts
    for item in TEMP_DIR.glob("*"):
        try:
            if item.is_file() and item.stat().st_mtime < (now - 3600):
                item.unlink(missing_ok=True)
        except Exception:
            pass

    # Clean downloads older than retention_hours
    for item in DOWNLOAD_DIR.glob("*"):
        try:
            if item.is_file() and item.stat().st_mtime < cutoff:
                item.unlink(missing_ok=True)
        except Exception:
            pass
