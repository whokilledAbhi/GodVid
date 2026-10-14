import asyncio
import http.server
import os
import shutil
import socketserver
import subprocess
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
import pytest

from app.config import DOWNLOAD_DIR, TEMP_DIR, FFMPEG_BINARY
from app.database import db
from app.downloader import download_direct_file, verify_media_file
from app.job_manager import JobManager
from app.models import DownloadJob, JobStatus, JobProgress
from app.zip_service import create_batch_zip


# Fixture to produce a valid test MP4 video using ffmpeg
@pytest.fixture(scope="session")
def test_video_file(tmp_path_factory) -> Path:
    temp_dir = tmp_path_factory.mktemp("media")
    video_path = temp_dir / "sample_video.mp4"
    
    # Generate 1-second valid test MP4 video with video and audio tracks
    cmd = [
        FFMPEG_BINARY,
        "-y",
        "-f", "lavfi", "-i", "testsrc=duration=1:size=320x240:rate=10",
        "-f", "lavfi", "-i", "sine=duration=1:frequency=440",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-shortest",
        str(video_path)
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    assert video_path.exists()
    assert video_path.stat().st_size > 0
    return video_path


# Fixture to run a local HTTP server serving the test video
@pytest.fixture(scope="session")
def local_media_server(test_video_file):
    media_dir = test_video_file.parent
    
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(media_dir), **kwargs)
        def log_message(self, format, *args):
            pass # Suppress server access logs

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        
        yield f"http://127.0.0.1:{port}/{test_video_file.name}"
        httpd.shutdown()


@pytest.mark.asyncio
async def test_direct_file_download_and_verify(local_media_server):
    job_id = "test-direct-job-1"
    now = datetime.now(timezone.utc).isoformat()
    job = DownloadJob(
        id=job_id,
        url=local_media_server,
        source_host="127.0.0.1",
        title="Direct Sample Video",
        status=JobStatus.DOWNLOADING,
        output_filename="downloaded_sample.mp4",
        created_at=now,
        updated_at=now
    )

    progress_updates = []
    def on_progress(p: JobProgress):
        progress_updates.append(p.percentage)

    cancel_event = asyncio.Event()

    # Perform download
    out_path = await download_direct_file(job, on_progress, cancel_event)
    
    assert out_path.exists()
    assert out_path.stat().st_size > 0
    assert len(progress_updates) > 0

    # Verify media streams
    is_valid, actual_res, actual_container, size = verify_media_file(out_path)
    assert is_valid is True
    assert actual_container == "mp4"
    assert size == out_path.stat().st_size

    # Clean up test output
    out_path.unlink()


@pytest.mark.asyncio
async def test_batch_zip_generation(test_video_file):
    # Register two completed jobs in DB pointing to real files
    now = datetime.now(timezone.utc).isoformat()
    
    file1 = DOWNLOAD_DIR / "test_vid_1.mp4"
    file2 = DOWNLOAD_DIR / "test_vid_2.mp4"
    shutil.copy(str(test_video_file), str(file1))
    shutil.copy(str(test_video_file), str(file2))

    job1 = DownloadJob(
        id="zip-job-1",
        url="https://example.com/1.mp4",
        status=JobStatus.COMPLETED,
        output_filename="test_vid_1.mp4",
        output_filepath=str(file1),
        created_at=now,
        updated_at=now
    )
    job2 = DownloadJob(
        id="zip-job-2",
        url="https://example.com/2.mp4",
        status=JobStatus.COMPLETED,
        output_filename="test_vid_2.mp4",
        output_filepath=str(file2),
        created_at=now,
        updated_at=now
    )
    db.save_job(job1)
    db.save_job(job2)

    zip_path = create_batch_zip(["zip-job-1", "zip-job-2"])
    assert zip_path.exists()
    assert zip_path.stat().st_size > 0

    # Clean up
    zip_path.unlink(missing_ok=True)
    file1.unlink(missing_ok=True)
    file2.unlink(missing_ok=True)


@pytest.mark.asyncio
async def test_download_cancellation(local_media_server):
    job_id = "test-cancel-job"
    now = datetime.now(timezone.utc).isoformat()
    job = DownloadJob(
        id=job_id,
        url=local_media_server,
        status=JobStatus.DOWNLOADING,
        created_at=now,
        updated_at=now
    )

    cancel_event = asyncio.Event()
    cancel_event.set() # Cancel immediately before starting

    with pytest.raises(asyncio.CancelledError):
        await download_direct_file(job, lambda p: None, cancel_event)
