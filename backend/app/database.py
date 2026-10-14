import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.config import DB_PATH
from app.models import DownloadJob, JobStatus, JobProgress, VideoMetadata


class Database:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._lock = threading.Lock()
        self.init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS jobs (
                        id TEXT PRIMARY KEY,
                        url TEXT NOT NULL,
                        source_host TEXT,
                        title TEXT,
                        thumbnail TEXT,
                        duration REAL,
                        uploader TEXT,
                        status TEXT NOT NULL,
                        requested_quality TEXT,
                        actual_quality TEXT,
                        preferred_container TEXT,
                        actual_container TEXT,
                        output_filename TEXT,
                        output_filepath TEXT,
                        file_size_bytes INTEGER,
                        error_message TEXT,
                        error_category TEXT,
                        retry_count INTEGER DEFAULT 0,
                        max_retries INTEGER DEFAULT 3,
                        progress_json TEXT,
                        available_resolutions_json TEXT,
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        completed_at TEXT
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at)")
                conn.commit()
            finally:
                conn.close()

    def save_job(self, job: DownloadJob):
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                progress_json = json.dumps(job.progress.model_dump())
                avail_res_json = json.dumps(job.available_resolutions)

                cursor.execute("""
                    INSERT INTO jobs (
                        id, url, source_host, title, thumbnail, duration, uploader,
                        status, requested_quality, actual_quality, preferred_container,
                        actual_container, output_filename, output_filepath, file_size_bytes,
                        error_message, error_category, retry_count, max_retries,
                        progress_json, available_resolutions_json,
                        created_at, updated_at, completed_at
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                    )
                    ON CONFLICT(id) DO UPDATE SET
                        status=excluded.status,
                        title=excluded.title,
                        thumbnail=excluded.thumbnail,
                        duration=excluded.duration,
                        uploader=excluded.uploader,
                        requested_quality=excluded.requested_quality,
                        actual_quality=excluded.actual_quality,
                        preferred_container=excluded.preferred_container,
                        actual_container=excluded.actual_container,
                        output_filename=excluded.output_filename,
                        output_filepath=excluded.output_filepath,
                        file_size_bytes=excluded.file_size_bytes,
                        error_message=excluded.error_message,
                        error_category=excluded.error_category,
                        retry_count=excluded.retry_count,
                        progress_json=excluded.progress_json,
                        available_resolutions_json=excluded.available_resolutions_json,
                        updated_at=excluded.updated_at,
                        completed_at=excluded.completed_at
                """, (
                    job.id, job.url, job.source_host, job.title, job.thumbnail,
                    job.duration, job.uploader, job.status.value, job.requested_quality,
                    job.actual_quality, job.preferred_container, job.actual_container,
                    job.output_filename, job.output_filepath, job.file_size_bytes,
                    job.error_message, job.error_category, job.retry_count,
                    job.max_retries, progress_json, avail_res_json,
                    job.created_at, job.updated_at, job.completed_at
                ))
                conn.commit()
            finally:
                conn.close()

    def get_job(self, job_id: str) -> Optional[DownloadJob]:
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
                row = cursor.fetchone()
                if not row:
                    return None
                return self._row_to_job(row)
            finally:
                conn.close()

    def get_all_jobs(self) -> List[DownloadJob]:
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM jobs ORDER BY created_at DESC")
                rows = cursor.fetchall()
                return [self._row_to_job(r) for r in rows]
            finally:
                conn.close()

    def delete_job(self, job_id: str) -> bool:
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
                conn.commit()
                return cursor.rowcount > 0
            finally:
                conn.close()

    def clear_all_jobs(self):
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM jobs")
                conn.commit()
            finally:
                conn.close()

    def reconcile_interrupted_jobs(self):
        """
        On server restart, check if any jobs were running.
        Reconcile them so they are not permanently stuck.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM jobs 
                    WHERE status IN ('downloading', 'merging', 'analyzing')
                """)
                rows = cursor.fetchall()
                now = datetime.now(timezone.utc).isoformat()
                for row in rows:
                    job_id = row["id"]
                    out_path = row["output_filepath"]
                    # If valid file exists on disk with nonzero size, could be completed
                    if out_path and Path(out_path).exists() and Path(out_path).stat().st_size > 0:
                        cursor.execute("""
                            UPDATE jobs SET
                                status = 'completed',
                                updated_at = ?,
                                completed_at = ?
                            WHERE id = ?
                        """, (now, now, job_id))
                    else:
                        cursor.execute("""
                            UPDATE jobs SET
                                status = 'failed',
                                error_message = 'Interrupted by server restart. You can retry this job without restarting completed downloads.',
                                error_category = 'Interrupted',
                                updated_at = ?
                            WHERE id = ?
                        """, (now, job_id))
                conn.commit()
            finally:
                conn.close()

    def _row_to_job(self, row: sqlite3.Row) -> DownloadJob:
        progress_data = {}
        if row["progress_json"]:
            try:
                progress_data = json.loads(row["progress_json"])
            except Exception:
                pass
        progress = JobProgress(**progress_data) if progress_data else JobProgress()

        avail_res = []
        if row["available_resolutions_json"]:
            try:
                avail_res = json.loads(row["available_resolutions_json"])
            except Exception:
                pass

        return DownloadJob(
            id=row["id"],
            url=row["url"],
            source_host=row["source_host"] or "",
            title=row["title"],
            thumbnail=row["thumbnail"],
            duration=row["duration"],
            uploader=row["uploader"],
            status=JobStatus(row["status"]),
            requested_quality=row["requested_quality"] or "best",
            actual_quality=row["actual_quality"],
            preferred_container=row["preferred_container"] or "auto",
            actual_container=row["actual_container"],
            output_filename=row["output_filename"],
            output_filepath=row["output_filepath"],
            file_size_bytes=row["file_size_bytes"],
            error_message=row["error_message"],
            error_category=row["error_category"],
            retry_count=row["retry_count"] or 0,
            max_retries=row["max_retries"] or 3,
            progress=progress,
            available_resolutions=avail_res,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            completed_at=row["completed_at"]
        )


db = Database()
