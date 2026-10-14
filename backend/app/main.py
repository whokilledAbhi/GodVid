import asyncio
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.config import (
    DOWNLOAD_DIR, MAX_BATCH_SIZE, DEFAULT_CONCURRENCY,
    MAX_CONCURRENCY, FFMPEG_BINARY, FFPROBE_BINARY
)
from app.database import db
from app.extractor import extract_metadata
from app.job_manager import job_manager
from app.models import (
    BatchAnalyzeRequest, BatchAnalyzeResponse, CreateJobsRequest,
    CreateJobsResponse, DownloadJob, JobStatus, QueueSummary,
    SystemStatus, ConcurrencySettingsRequest, VideoMetadata
)
from app.security import (
    parse_and_validate_batch, sanitize_filename, ensure_path_within_dir
)
from app.utils import check_system_dependencies, cleanup_expired_files
from app.zip_service import create_batch_zip


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: start queue worker loop and reconcile DB
    await job_manager.start()
    cleanup_expired_files()
    yield
    # Shutdown
    await job_manager.stop()


app = FastAPI(
    title="Batch Video Downloader API",
    description="High-performance backend for batch media extraction, quality preservation, and download management.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/status", response_model=SystemStatus)
async def get_system_status():
    """Return backend health, FFmpeg availability, worker state, and available disk space."""
    deps = check_system_dependencies()
    disk = shutil.disk_usage(str(DOWNLOAD_DIR))
    jobs = db.get_all_jobs()
    active_count = sum(1 for j in jobs if j.status in (JobStatus.DOWNLOADING, JobStatus.MERGING))

    return SystemStatus(
        status="healthy",
        ffmpeg_available=deps["ffmpeg"]["available"],
        ffmpeg_version=deps["ffmpeg"]["version"],
        ffprobe_available=deps["ffprobe"]["available"],
        active_workers=active_count,
        concurrency_limit=job_manager.concurrency_limit,
        disk_free_gb=round(disk.free / (1024 ** 3), 2),
        total_jobs=len(jobs)
    )


@app.post("/api/analyze", response_model=BatchAnalyzeResponse)
async def analyze_urls(req: BatchAnalyzeRequest):
    """
    Parse, deduplicate, validate, and extract metadata for a batch of URLs before downloading.
    """
    parsed = parse_and_validate_batch(req.raw_urls, max_batch_size=MAX_BATCH_SIZE)
    valid_urls = parsed["valid_urls"]
    invalid_urls = parsed["invalid_urls"]

    items: List[VideoMetadata] = []
    if req.extract_formats and valid_urls:
        # Run extractions concurrently with bounded concurrency
        semaphore = asyncio.Semaphore(4)

        async def extract_bounded(u: str) -> VideoMetadata:
            async with semaphore:
                return await extract_metadata(u)

        items = await asyncio.gather(*(extract_bounded(u) for u in valid_urls))

    return BatchAnalyzeResponse(
        valid_urls=valid_urls,
        invalid_urls=invalid_urls,
        total_detected=parsed["total_detected"],
        deduplicated_count=parsed["deduplicated_count"],
        items=items
    )


@app.get("/api/jobs", response_model=List[DownloadJob])
async def list_jobs():
    """Retrieve all jobs in the queue."""
    return db.get_all_jobs()


@app.get("/api/jobs/summary", response_model=QueueSummary)
async def get_summary():
    """Retrieve aggregated queue summary metrics."""
    return job_manager.get_summary()


@app.post("/api/jobs", response_model=CreateJobsResponse)
async def create_download_jobs(req: CreateJobsRequest):
    """
    Enqueue multiple URLs for downloading with specified quality and container preferences.
    """
    if not req.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    created_jobs: List[DownloadJob] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for url in req.urls:
        # Quick validation
        job_id = str(uuid.uuid4())
        job = DownloadJob(
            id=job_id,
            url=url.strip(),
            status=JobStatus.PENDING,
            requested_quality=req.quality or "best",
            preferred_container=req.container or "auto",
            created_at=now_iso,
            updated_at=now_iso
        )
        created_jobs.append(job)

    await job_manager.enqueue_jobs(created_jobs)
    return CreateJobsResponse(jobs=created_jobs)


@app.get("/api/jobs/{job_id}", response_model=DownloadJob)
async def get_job(job_id: str):
    """Get single job details."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_single_job(job_id: str):
    """Cancel a specific download job."""
    success = await job_manager.cancel_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found or already cancelled")
    return {"message": f"Job {job_id} cancelled"}


@app.post("/api/jobs/cancel-all")
async def cancel_all_jobs():
    """Cancel all active and pending jobs."""
    await job_manager.cancel_all()
    return {"message": "All active and pending jobs cancelled"}


@app.post("/api/jobs/{job_id}/retry")
async def retry_single_job(job_id: str):
    """Retry a failed or cancelled job."""
    success = await job_manager.retry_job(job_id)
    if not success:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"message": f"Job {job_id} queued for retry"}


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job record and its output file from disk."""
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Cancel if active
    if job.status in (JobStatus.PENDING, JobStatus.ANALYZING, JobStatus.DOWNLOADING, JobStatus.MERGING):
        await job_manager.cancel_job(job_id)

    # Delete physical file
    if job.output_filepath:
        try:
            p = Path(job.output_filepath)
            if p.exists() and p.is_file():
                p.unlink()
        except Exception:
            pass

    db.delete_job(job_id)
    await job_manager.broadcast_event("job_deleted", {"id": job_id})
    await job_manager.broadcast_event("summary_updated", job_manager.get_summary().model_dump())
    return {"message": f"Job {job_id} deleted"}


@app.delete("/api/jobs")
async def clear_all_jobs():
    """Clear all jobs from database and cancel running jobs."""
    await job_manager.cancel_all()
    jobs = db.get_all_jobs()
    for job in jobs:
        if job.output_filepath:
            try:
                p = Path(job.output_filepath)
                if p.exists() and p.is_file():
                    p.unlink()
            except Exception:
                pass

    db.clear_all_jobs()
    await job_manager.broadcast_event("queue_cleared", {})
    await job_manager.broadcast_event("summary_updated", job_manager.get_summary().model_dump())
    return {"message": "All jobs cleared"}


@app.post("/api/settings/concurrency")
async def update_concurrency(req: ConcurrencySettingsRequest):
    """Adjust concurrency limit (1 to 5)."""
    job_manager.set_concurrency(req.concurrency_limit)
    await job_manager.broadcast_event("summary_updated", job_manager.get_summary().model_dump())
    return {"concurrency_limit": job_manager.concurrency_limit}


@app.get("/api/jobs/{job_id}/download")
async def download_file(job_id: str):
    """
    Stream completed downloaded media file to the browser with proper headers.
    """
    job = db.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED or not job.output_filepath:
        raise HTTPException(status_code=400, detail="Video download has not completed yet")

    filepath = Path(job.output_filepath)
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=410, detail="Downloaded media file is no longer available on server disk")

    # Prevent path traversal
    ensure_path_within_dir(filepath, DOWNLOAD_DIR)

    safe_attachment_name = sanitize_filename(job.output_filename or filepath.name, fallback="video.mp4")
    
    # MIME type detection
    ext = filepath.suffix.lower().lstrip(".")
    media_types = {
        "mp4": "video/mp4",
        "mkv": "video/x-matroska",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "wav": "audio/wav"
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(filepath),
        filename=safe_attachment_name,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_attachment_name}"',
            "Cache-Control": "no-cache"
        }
    )


@app.get("/api/jobs/batch-zip")
async def download_batch_zip(background_tasks: BackgroundTasks, job_ids: Optional[str] = Query(None)):
    """
    Package all completed downloads into a ZIP archive and stream to user.
    Cleans up temp zip afterwards.
    """
    id_list = [i.strip() for i in job_ids.split(",") if i.strip()] if job_ids else None
    
    try:
        zip_path = create_batch_zip(id_list)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=507, detail=str(e))

    # Add background cleanup for the temporary zip file after response completes
    def remove_temp_zip(p: Path):
        try:
            if p.exists():
                p.unlink()
        except Exception:
            pass

    background_tasks.add_task(remove_temp_zip, zip_path)

    return FileResponse(
        path=str(zip_path),
        filename=f"batch_videos_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.zip",
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="batch_videos.zip"',
            "Cache-Control": "no-cache"
        }
    )


@app.get("/api/events")
async def sse_events():
    """
    Server-Sent Events endpoint providing real-time streaming updates of job status and progress.
    """
    queue = await job_manager.subscribe_sse()

    async def event_generator():
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            job_manager.unsubscribe_sse(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
