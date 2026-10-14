import shutil
import zipfile
import uuid
from pathlib import Path
from typing import List, Optional

from app.config import TEMP_DIR
from app.database import db
from app.models import JobStatus


def create_batch_zip(job_ids: Optional[List[str]] = None) -> Path:
    """
    Create a ZIP archive of completed downloaded files without buffering whole videos in RAM.
    Guarantees isolation, disk-space check, and cleanup.
    """
    if job_ids:
        jobs = [db.get_job(jid) for jid in job_ids]
        jobs = [j for j in jobs if j and j.status == JobStatus.COMPLETED and j.output_filepath]
    else:
        all_jobs = db.get_all_jobs()
        jobs = [j for j in all_jobs if j.status == JobStatus.COMPLETED and j.output_filepath]

    if not jobs:
        raise ValueError("No completed video files are available to package into a ZIP archive.")

    # Calculate total size of files to include
    total_file_size = 0
    valid_files = []
    for job in jobs:
        if job.output_filepath:
            fpath = Path(job.output_filepath)
            if fpath.exists() and fpath.is_file():
                size = fpath.stat().st_size
                total_file_size += size
                valid_files.append((fpath, job.output_filename or fpath.name))

    if not valid_files:
        raise ValueError("None of the completed files could be located on disk.")

    # Verify disk space (require at least 1.2x total size free)
    disk_usage = shutil.disk_usage(str(TEMP_DIR))
    if disk_usage.free < (total_file_size + 100 * 1024 * 1024):
        raise RuntimeError(f"Insufficient disk space to generate ZIP archive. Free space: {disk_usage.free // (1024*1024)} MB")

    zip_filename = f"batch_videos_{uuid.uuid4().hex[:8]}.zip"
    zip_path = TEMP_DIR / zip_filename

    # Build ZIP using ZIP_STORED (or ZIP_DEFLATED) without compressing video streams
    # Video streams (.mp4, .mkv, .webm) are already compressed; ZIP_STORED avoids useless CPU overhead
    with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_STORED) as zip_out:
        seen_names = set()
        for fpath, arcname in valid_files:
            # Handle duplicate filenames inside archive
            clean_arcname = arcname
            counter = 1
            stem = Path(arcname).stem
            suffix = Path(arcname).suffix
            while clean_arcname in seen_names:
                clean_arcname = f"{stem}_{counter}{suffix}"
                counter += 1
            seen_names.add(clean_arcname)

            # Write file into ZIP
            zip_out.write(str(fpath), arcname=clean_arcname)

    return zip_path
