import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from pathlib import Path

from app.config import DEFAULT_CONCURRENCY, MAX_CONCURRENCY
from app.database import db
from app.downloader import execute_download_job
from app.extractor import extract_metadata, classify_extractor_error
from app.models import DownloadJob, JobStatus, JobProgress, QueueSummary

logger = logging.getLogger("job_manager")


class JobManager:
    def __init__(self, concurrency_limit: int = DEFAULT_CONCURRENCY):
        self.concurrency_limit = max(1, min(concurrency_limit, MAX_CONCURRENCY))
        self._semaphore = asyncio.Semaphore(self.concurrency_limit)
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._cancel_events: Dict[str, asyncio.Event] = {}
        self._sse_subscribers: Set[asyncio.Queue] = set()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

    async def start(self):
        """Start background queue worker and reconcile database."""
        self._running = True
        db.reconcile_interrupted_jobs()
        self._worker_task = asyncio.create_task(self._process_queue_loop())
        logger.info(f"JobManager started with concurrency limit {self.concurrency_limit}")

    async def stop(self):
        """Gracefully stop worker loop and cancel ongoing tasks."""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
        
        # Cancel all active tasks
        for job_id, task in list(self._active_tasks.items()):
            task.cancel()
        self._active_tasks.clear()

    def set_concurrency(self, limit: int):
        """Update concurrency limit dynamically."""
        new_limit = max(1, min(limit, MAX_CONCURRENCY))
        self.concurrency_limit = new_limit
        # Reinitialize semaphore
        self._semaphore = asyncio.Semaphore(new_limit)

    async def subscribe_sse(self) -> asyncio.Queue:
        """Subscribe a client to real-time Server-Sent Events."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._sse_subscribers.add(queue)
        # Send initial full state immediately
        all_jobs = db.get_all_jobs()
        summary = self.get_summary()
        initial_payload = {
            "type": "initial",
            "summary": summary.model_dump(),
            "jobs": [j.model_dump() for j in all_jobs]
        }
        await queue.put(json.dumps(initial_payload))
        return queue

    def unsubscribe_sse(self, queue: asyncio.Queue):
        """Unsubscribe an SSE client."""
        self._sse_subscribers.discard(queue)

    async def broadcast_event(self, event_type: str, data: Dict):
        """Broadcast real-time event to all connected frontend clients."""
        if not self._sse_subscribers:
            return

        payload = json.dumps({"type": event_type, "data": data})
        stale = set()
        for q in self._sse_subscribers:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                stale.add(q)
            except Exception:
                stale.add(q)

        for q in stale:
            self._sse_subscribers.discard(q)

    def get_summary(self) -> QueueSummary:
        """Calculate overall batch summary statistics."""
        jobs = db.get_all_jobs()
        total = len(jobs)
        pending = sum(1 for j in jobs if j.status == JobStatus.PENDING)
        analyzing = sum(1 for j in jobs if j.status == JobStatus.ANALYZING)
        active = sum(1 for j in jobs if j.status in (JobStatus.DOWNLOADING, JobStatus.MERGING))
        completed = sum(1 for j in jobs if j.status == JobStatus.COMPLETED)
        failed = sum(1 for j in jobs if j.status == JobStatus.FAILED)
        cancelled = sum(1 for j in jobs if j.status == JobStatus.CANCELLED)

        overall_pct = 0.0
        if total > 0:
            total_pct_sum = sum(
                100.0 if j.status == JobStatus.COMPLETED else (j.progress.percentage if j.status in (JobStatus.DOWNLOADING, JobStatus.MERGING) else 0.0)
                for j in jobs
            )
            overall_pct = round(total_pct_sum / total, 1)

        return QueueSummary(
            total=total,
            pending=pending,
            analyzing=analyzing,
            active=active,
            completed=completed,
            failed=failed,
            cancelled=cancelled,
            overall_percentage=overall_pct,
            concurrency_limit=self.concurrency_limit
        )

    async def enqueue_jobs(self, jobs: List[DownloadJob]):
        """Persist new jobs and trigger worker queue."""
        for job in jobs:
            db.save_job(job)
            await self.broadcast_event("job_added", job.model_dump())
        await self.broadcast_event("summary_updated", self.get_summary().model_dump())

    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a single job."""
        job = db.get_job(job_id)
        if not job:
            return False

        if job_id in self._cancel_events:
            self._cancel_events[job_id].set()

        if job_id in self._active_tasks:
            self._active_tasks[job_id].cancel()

        job.status = JobStatus.CANCELLED
        job.progress.current_step = "Cancelled by user"
        job.updated_at = datetime.now(timezone.utc).isoformat()
        db.save_job(job)

        await self.broadcast_event("job_updated", job.model_dump())
        await self.broadcast_event("summary_updated", self.get_summary().model_dump())
        return True

    async def cancel_all(self):
        """Cancel all pending, analyzing, and downloading jobs."""
        jobs = db.get_all_jobs()
        for j in jobs:
            if j.status in (JobStatus.PENDING, JobStatus.ANALYZING, JobStatus.DOWNLOADING, JobStatus.MERGING):
                await self.cancel_job(j.id)

    async def retry_job(self, job_id: str) -> bool:
        """Retry a failed or cancelled job without affecting completed jobs."""
        job = db.get_job(job_id)
        if not job:
            return False

        job.status = JobStatus.PENDING
        job.error_message = None
        job.error_category = None
        job.progress = JobProgress(current_step="Queued for retry")
        job.updated_at = datetime.now(timezone.utc).isoformat()
        db.save_job(job)

        await self.broadcast_event("job_updated", job.model_dump())
        await self.broadcast_event("summary_updated", self.get_summary().model_dump())
        return True

    async def _process_queue_loop(self):
        """Continuous background loop monitoring pending jobs and dispatching workers."""
        while self._running:
            try:
                jobs = db.get_all_jobs()
                pending_jobs = [j for j in jobs if j.status == JobStatus.PENDING]

                for job in pending_jobs:
                    if not self._running:
                        break
                    if job.id in self._active_tasks:
                        continue

                    # Spawn worker task guarded by semaphore
                    task = asyncio.create_task(self._job_worker(job.id))
                    self._active_tasks[job.id] = task

                await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in queue loop: {e}")
                await asyncio.sleep(1.0)

    async def _job_worker(self, job_id: str):
        """Worker task processing an individual job with bounded concurrency."""
        async with self._semaphore:
            job = db.get_job(job_id)
            if not job or job.status != JobStatus.PENDING:
                self._active_tasks.pop(job_id, None)
                return

            cancel_event = asyncio.Event()
            self._cancel_events[job_id] = cancel_event

            try:
                if cancel_event.is_set():
                    job.status = JobStatus.CANCELLED
                    db.save_job(job)
                    return

                # Direct download & stream merge in single pass
                job.status = JobStatus.DOWNLOADING
                job.progress.current_step = "Connecting to source..."
                job.updated_at = datetime.now(timezone.utc).isoformat()
                db.save_job(job)
                await self.broadcast_event("job_updated", job.model_dump())
                await self.broadcast_event("summary_updated", self.get_summary().model_dump())

                # Capture event loop for threadsafe callbacks from worker executor
                loop = asyncio.get_running_loop()
                last_broadcast = [0.0]

                def on_progress(p: JobProgress):
                    job.progress = p
                    now = time.time()
                    if now - last_broadcast[0] >= 0.3 or p.percentage >= 99.0:
                        last_broadcast[0] = now
                        db.save_job(job)
                        loop.call_soon_threadsafe(
                            lambda: asyncio.create_task(
                                self.broadcast_event("job_progress", {
                                    "id": job.id,
                                    "progress": p.model_dump(),
                                    "status": job.status.value,
                                    "title": job.title,
                                    "thumbnail": job.thumbnail
                                })
                            )
                        )

                # Execute real download
                out_path, actual_res, actual_container, size = await execute_download_job(
                    job, on_progress, cancel_event
                )

                # Step 3: Success Completion
                job.status = JobStatus.COMPLETED
                job.output_filename = out_path.name
                job.output_filepath = str(out_path)
                job.file_size_bytes = size
                job.actual_quality = actual_res or job.requested_quality
                job.actual_container = actual_container or job.preferred_container
                job.progress.percentage = 100.0
                job.progress.current_step = "Completed"
                now_iso = datetime.now(timezone.utc).isoformat()
                job.updated_at = now_iso
                job.completed_at = now_iso
                db.save_job(job)

                await self.broadcast_event("job_updated", job.model_dump())
                await self.broadcast_event("summary_updated", self.get_summary().model_dump())

            except asyncio.CancelledError:
                job = db.get_job(job_id) or job
                job.status = JobStatus.CANCELLED
                job.progress.current_step = "Cancelled by user"
                job.updated_at = datetime.now(timezone.utc).isoformat()
                db.save_job(job)
                await self.broadcast_event("job_updated", job.model_dump())
                await self.broadcast_event("summary_updated", self.get_summary().model_dump())

            except Exception as e:
                err_str = str(e)
                job = db.get_job(job_id) or job
                is_transient = any(t in err_str.lower() for t in ["timeout", "connection reset", "network", "503", "502"])

                if is_transient and job.retry_count < job.max_retries:
                    job.retry_count += 1
                    job.status = JobStatus.PENDING
                    job.progress.current_step = f"Transient error; retrying (attempt {job.retry_count}/{job.max_retries})"
                    job.updated_at = datetime.now(timezone.utc).isoformat()
                    db.save_job(job)
                    await asyncio.sleep(2 ** job.retry_count) # Backoff
                else:
                    job.status = JobStatus.FAILED
                    job.error_message = classify_extractor_error(err_str)
                    job.error_category = "DownloadError"
                    job.progress.current_step = "Failed"
                    job.updated_at = datetime.now(timezone.utc).isoformat()
                    db.save_job(job)

                await self.broadcast_event("job_updated", job.model_dump())
                await self.broadcast_event("summary_updated", self.get_summary().model_dump())

            finally:
                self._cancel_events.pop(job_id, None)
                self._active_tasks.pop(job_id, None)


job_manager = JobManager()

