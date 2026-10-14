import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Tuple

from app.config import (
    FFMPEG_BINARY, FFPROBE_BINARY, DOWNLOAD_DIR, TEMP_DIR,
    RETENTION_HOURS
)


def check_system_dependencies() -> Dict[str, Any]:
    """
    Verify presence of FFmpeg and FFprobe, returning version details and setup instructions.
    """
    ffmpeg_ok = False
    ffmpeg_version = None
    ffprobe_ok = False
    ffprobe_version = None

    if shutil.which(FFMPEG_BINARY):
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

    if shutil.which(FFPROBE_BINARY):
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
