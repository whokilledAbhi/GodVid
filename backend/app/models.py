from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    READY = "ready"
    DOWNLOADING = "downloading"
    MERGING = "merging"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class QualityOption(str, Enum):
    BEST = "best"
    P2160 = "2160p"
    P1440 = "1440p"
    P1080 = "1080p"
    P720 = "720p"
    P480 = "480p"
    P360 = "360p"
    AUDIO_ONLY = "audio_only"


class VideoFormatInfo(BaseModel):
    format_id: str
    resolution: Optional[str] = None
    height: Optional[int] = None
    width: Optional[int] = None
    ext: str = "mp4"
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    filesize: Optional[int] = None
    filesize_approx: Optional[int] = None
    tbr: Optional[float] = None
    fps: Optional[float] = None
    is_video: bool = True
    is_audio: bool = True
    is_muxed: bool = False
    note: Optional[str] = None


class VideoMetadata(BaseModel):
    url: str
    title: str = "Unavailable"
    source_host: str = ""
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    uploader: Optional[str] = None
    available_resolutions: List[str] = Field(default_factory=list)
    available_codecs: List[str] = Field(default_factory=list)
    available_containers: List[str] = Field(default_factory=list)
    estimated_size_bytes: Optional[int] = None
    is_direct_file: bool = False
    formats: List[VideoFormatInfo] = Field(default_factory=list)
    extraction_error: Optional[str] = None


class JobProgress(BaseModel):
    percentage: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: Optional[int] = None
    speed_bytes_sec: Optional[float] = None
    eta_seconds: Optional[float] = None
    elapsed_seconds: float = 0.0
    current_step: str = "Idle"


class DownloadJob(BaseModel):
    id: str
    url: str
    source_host: str = ""
    title: Optional[str] = "Pending Analysis"
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    uploader: Optional[str] = None
    status: JobStatus = JobStatus.PENDING
    requested_quality: str = "best"
    actual_quality: Optional[str] = None
    preferred_container: str = "auto"
    actual_container: Optional[str] = None
    output_filename: Optional[str] = None
    output_filepath: Optional[str] = None
    file_size_bytes: Optional[int] = None
    error_message: Optional[str] = None
    error_category: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    progress: JobProgress = Field(default_factory=JobProgress)
    available_resolutions: List[str] = Field(default_factory=list)
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None


# Request & Response Models

class BatchAnalyzeRequest(BaseModel):
    raw_urls: str
    extract_formats: bool = True


class BatchAnalyzeResponse(BaseModel):
    valid_urls: List[str]
    invalid_urls: List[Dict[str, str]]
    total_detected: int
    deduplicated_count: int
    items: List[VideoMetadata] = Field(default_factory=list)


class CreateJobsRequest(BaseModel):
    urls: List[str]
    quality: str = "best"
    container: str = "auto"
    filename_template: Optional[str] = "{title} [{resolution}].{ext}"
    allow_playlist: bool = False


class CreateJobsResponse(BaseModel):
    jobs: List[DownloadJob]


class UpdateJobPreferencesRequest(BaseModel):
    requested_quality: Optional[str] = None
    preferred_container: Optional[str] = None


class ConcurrencySettingsRequest(BaseModel):
    concurrency_limit: int = Field(ge=1, le=5)


class QueueSummary(BaseModel):
    total: int
    pending: int
    analyzing: int
    active: int
    completed: int
    failed: int
    cancelled: int
    overall_percentage: float
    concurrency_limit: int


class SystemStatus(BaseModel):
    status: str = "healthy"
    ffmpeg_available: bool
    ffmpeg_version: Optional[str] = None
    ffprobe_available: bool
    active_workers: int
    concurrency_limit: int
    disk_free_gb: float
    total_jobs: int
