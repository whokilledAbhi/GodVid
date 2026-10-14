import os
import shutil
from pathlib import Path

# Base directories
APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_DIR = BACKEND_DIR.parent

# Data and download storage
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", str(BACKEND_DIR / "downloads")))
TEMP_DIR = Path(os.getenv("TEMP_DIR", str(BACKEND_DIR / "temp")))
DB_PATH = Path(os.getenv("DB_PATH", str(BACKEND_DIR / "jobs.db")))

DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# System dependencies
FFMPEG_BINARY = os.getenv("FFMPEG_PATH") or shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_BINARY = os.getenv("FFPROBE_PATH") or shutil.which("ffprobe") or "ffprobe"

# Limits and defaults
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "50"))
DEFAULT_CONCURRENCY = int(os.getenv("DEFAULT_CONCURRENCY", "2"))
MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "5"))
RETENTION_HOURS = int(os.getenv("RETENTION_HOURS", "24"))
MAX_FILE_SIZE_BYTES = int(os.getenv("MAX_FILE_SIZE_BYTES", str(20 * 1024 * 1024 * 1024))) # 20 GB default limit
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "3600")) # 1 hour max per job

# Quality preferences
SUPPORTED_RESOLUTIONS = ["best", "2160p", "1440p", "1080p", "720p", "480p", "360p", "audio_only"]
SUPPORTED_CONTAINERS = ["auto", "mp4", "mkv", "webm"]
