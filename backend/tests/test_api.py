import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import db
from app.models import DownloadJob, JobStatus


@pytest.mark.asyncio
async def test_api_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "ffmpeg_available" in data
        assert "concurrency_limit" in data
        assert "disk_free_gb" in data


@pytest.mark.asyncio
async def test_api_analyze_urls():
    payload = {
        "raw_urls": "https://www.youtube.com/watch?v=dQw4w9WgXcQ\nfile:///invalid/path",
        "extract_formats": False
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert len(data["valid_urls"]) == 1
        assert len(data["invalid_urls"]) == 1
        assert "file:///" in data["invalid_urls"][0]["url"]


@pytest.mark.asyncio
async def test_api_create_and_manage_jobs():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create jobs
        payload = {
            "urls": ["https://example.com/test1.mp4", "https://example.com/test2.mp4"],
            "quality": "1080p",
            "container": "mp4"
        }
        res = await ac.post("/api/jobs", json=payload)
        assert res.status_code == 200
        created = res.json()["jobs"]
        assert len(created) == 2
        job_id = created[0]["id"]

        # Get job
        job_res = await ac.get(f"/api/jobs/{job_id}")
        assert job_res.status_code == 200
        assert job_res.json()["id"] == job_id

        # Cancel job
        cancel_res = await ac.post(f"/api/jobs/{job_id}/cancel")
        assert cancel_res.status_code == 200

        # Retry job
        retry_res = await ac.post(f"/api/jobs/{job_id}/retry")
        assert retry_res.status_code == 200

        # Concurrency setting
        conc_res = await ac.post("/api/settings/concurrency", json={"concurrency_limit": 3})
        assert conc_res.status_code == 200
        assert conc_res.json()["concurrency_limit"] == 3

        # Delete job
        del_res = await ac.delete(f"/api/jobs/{job_id}")
        assert del_res.status_code == 200
