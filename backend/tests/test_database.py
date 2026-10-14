import pytest
from datetime import datetime, timezone
from app.database import Database
from app.models import DownloadJob, JobStatus, JobProgress


def test_database_crud(tmp_path):
    test_db_path = tmp_path / "test_jobs.db"
    db_inst = Database(db_path=test_db_path)
    
    now = datetime.now(timezone.utc).isoformat()
    job = DownloadJob(
        id="test-job-1",
        url="https://example.com/test.mp4",
        source_host="example.com",
        title="Sample Video",
        status=JobStatus.PENDING,
        requested_quality="1080p",
        preferred_container="mp4",
        created_at=now,
        updated_at=now,
        available_resolutions=["1080p", "720p"]
    )
    
    # Save
    db_inst.save_job(job)
    
    # Retrieve
    retrieved = db_inst.get_job("test-job-1")
    assert retrieved is not None
    assert retrieved.id == "test-job-1"
    assert retrieved.title == "Sample Video"
    assert retrieved.status == JobStatus.PENDING
    assert retrieved.available_resolutions == ["1080p", "720p"]
    
    # Update status and progress
    job.status = JobStatus.DOWNLOADING
    job.progress = JobProgress(percentage=50.0, downloaded_bytes=5000, total_bytes=10000)
    db_inst.save_job(job)
    
    updated = db_inst.get_job("test-job-1")
    assert updated.status == JobStatus.DOWNLOADING
    assert updated.progress.percentage == 50.0
    assert updated.progress.downloaded_bytes == 5000
    
    # List
    all_jobs = db_inst.get_all_jobs()
    assert len(all_jobs) == 1
    
    # Delete
    assert db_inst.delete_job("test-job-1") is True
    assert db_inst.get_job("test-job-1") is None


def test_reconcile_interrupted_jobs(tmp_path):
    test_db_path = tmp_path / "test_reconcile.db"
    db_inst = Database(db_path=test_db_path)
    
    now = datetime.now(timezone.utc).isoformat()
    # Interrupted job without file
    job_stuck = DownloadJob(
        id="stuck-1",
        url="https://example.com/video.mp4",
        status=JobStatus.DOWNLOADING,
        created_at=now,
        updated_at=now
    )
    db_inst.save_job(job_stuck)
    
    # Interrupted job with existing output file
    out_file = tmp_path / "completed_video.mp4"
    out_file.write_bytes(b"dummy video data")
    job_with_file = DownloadJob(
        id="stuck-2",
        url="https://example.com/video2.mp4",
        status=JobStatus.DOWNLOADING,
        output_filepath=str(out_file),
        created_at=now,
        updated_at=now
    )
    db_inst.save_job(job_with_file)
    
    # Run reconciliation
    db_inst.reconcile_interrupted_jobs()
    
    j1 = db_inst.get_job("stuck-1")
    assert j1.status == JobStatus.FAILED
    assert "Interrupted by server restart" in j1.error_message
    
    j2 = db_inst.get_job("stuck-2")
    assert j2.status == JobStatus.COMPLETED
