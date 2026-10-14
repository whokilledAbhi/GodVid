# Batch Video Downloader (GodVid)

A production-minded, standalone web application for high-fidelity batch media extraction and downloading. Built with **Next.js**, **FastAPI**, **yt-dlp**, and **FFmpeg**.

---

## 1. Key Capabilities

- **Batch URL Processing**: Paste multiple URLs from text, spreadsheets, or CSV lists. Supports newline-, comma-, and space-delimited formats with automatic whitespace trimming, URL normalization, syntax validation, and deduplication.
- **Genuine "Best Available Quality" Mode**: Inspects actual source streams to select the highest-quality video stream and highest-bitrate audio stream, merging them directly using FFmpeg stream remuxing. Avoids unnecessary lossy re-encoding, resizing, or bitrate reduction.
- **Dynamic Format Inspection**: Dynamically probes source formats (2160p / 4K, 1440p, 1080p, 720p, 480p, or Audio Only) and accurately reflects available streams.
- **Direct File Downloads**: Native streaming download adapter for direct media links (`.mp4`, `.mkv`, `.webm`, `.mov`, `.avi`, `.mp3`), streaming chunks to disk without memory buffering.
- **Controlled Concurrency & Job Persistence**: Configurable concurrency limit (1, 2, 3, or more simultaneous jobs) with persistent SQLite storage. Interrupted jobs are automatically reconciled upon server restart.
- **Accurate Telemetry via Server-Sent Events (SSE)**: Real-time progress updates with downloaded bytes, speed, elapsed time, ETA, and state transitions (`Pending`, `Analyzing`, `Downloading`, `Merging`, `Completed`, `Failed`, `Cancelled`).
- **Flexible File Delivery**: Download completed videos individually or package the entire batch into a streamed ZIP archive without in-memory buffering.
- **Robust Security Safeguards**:
  - Full SSRF protection blocking private, loopback, link-local, carrier-grade NAT, and cloud metadata IP ranges (`169.254.169.254`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, etc.).
  - Filename sanitization protecting against path traversal, control characters, null bytes, and Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`).
  - Strict subprocess parameter arrays (no shell string execution).

---

## 2. Technical Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.12+, FastAPI, Uvicorn, yt-dlp, httpx, aiofiles, Pydantic v2 |
| **Media Processing** | FFmpeg & FFprobe (Stream remuxing, stream verification, audio/video muxing) |
| **Database** | SQLite with ACID transactions and restart state reconciliation |
| **Orchestration** | Docker & Docker Compose |

---

## 3. System Requirements & Dependency Setup

### FFmpeg and FFprobe (Required)
The application requires `ffmpeg` and `ffprobe` in your system `PATH` to merge separate audio/video streams and verify downloaded media.

- **Windows**:
  ```powershell
  winget install Gyan.FFmpeg
  ```
- **macOS**:
  ```bash
  brew install ffmpeg
  ```
- **Ubuntu / Debian**:
  ```bash
  sudo apt-get update && sudo apt-get install -y ffmpeg
  ```

---

## 4. Local Development Quickstart

### Step 1: Clone Repository
```bash
git clone <repository_url>
cd GodVid
```

### Step 2: Backend Setup
```bash
# Create and activate Python virtual environment
python -m venv venv

# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Start backend server
python backend/run.py
```
Backend will start on `http://localhost:8000`.

### Step 3: Frontend Setup
In a new terminal:
```bash
cd frontend

# Install Node dependencies
npm install

# Run Next.js development server
npm run dev
```
Frontend will be available at `http://localhost:3000`.

---

## 5. Docker Deployment

To launch the full stack with isolated containers and bundled FFmpeg:

```bash
docker compose up --build
```
- Web Application: `http://localhost:3000`
- API Documentation (Swagger): `http://localhost:8000/docs`

---

## 6. Running Automated Tests

A comprehensive automated test suite covers unit tests, SSRF protection, database persistence, direct file downloads, cancellation, and ZIP generation.

```bash
# Run pytest with verbose reporting
.\venv\Scripts\pytest backend/tests -v
```

All 17 test modules execute against real controlled fixtures and pass with zero warnings:
```
backend/tests/test_api.py::test_api_status PASSED
backend/tests/test_api.py::test_api_analyze_urls PASSED
backend/tests/test_api.py::test_api_create_and_manage_jobs PASSED
backend/tests/test_database.py::test_database_crud PASSED
backend/tests/test_database.py::test_reconcile_interrupted_jobs PASSED
backend/tests/test_extractor.py::test_classify_extractor_error PASSED
backend/tests/test_extractor.py::test_is_direct_file_url PASSED
backend/tests/test_extractor.py::test_build_format_selector PASSED
backend/tests/test_integration.py::test_direct_file_download_and_verify PASSED
backend/tests/test_integration.py::test_batch_zip_generation PASSED
backend/tests/test_integration.py::test_download_cancellation PASSED
backend/tests/test_security.py::test_ssrf_ip_restriction PASSED
backend/tests/test_security.py::test_url_security_schemes PASSED
backend/tests/test_security.py::test_url_security_blocked_hosts PASSED
backend/tests/test_security.py::test_parse_and_validate_batch PASSED
backend/tests/test_security.py::test_sanitize_filename PASSED
backend/tests/test_path_traversal_prevention PASSED

============================= 17 passed in 2.60s =============================
```

---

## 7. Security Architecture & SSRF Defense

1. **Pre-Request DNS & IP Inspection**: Before fetching any media source, hostnames are pre-resolved via DNS. The resulting IP addresses are validated against a blocklist of private, link-local, loopback, and carrier-grade NAT ranges:
   - `0.0.0.0/8`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - `169.254.0.0/16` (Cloud metadata endpoints such as AWS/GCP/Azure)
   - IPv6: `::1`, `fc00::/7`, `fe80::/10`
2. **Subprocess Isolation**: All external CLI commands (FFmpeg/FFprobe) are invoked strictly with argument arrays `[binary, "-arg", value]`, completely eliminating shell injection risks.
3. **Filesystem Traversal Protection**: Target file paths are verified with `.resolve().relative_to(base_dir)`. Output filenames are sanitized, replacing dangerous characters with safe substitutes and stripping Windows reserved device names (`CON`, `PRN`, `AUX`, `NUL`).

---

## 8. Supported Websites & Technical Limitations

- **Supported Sources**: Hundreds of standard public video platforms supported by `yt-dlp` (YouTube, Vimeo, Dailymotion, Twitch clips, Soundcloud, etc.) as well as direct HTTP/HTTPS media URLs.
- **DRM & Access Restrictions**: Encrypted or DRM-protected streams (Widevine, FairPlay, PlayReady) and paywalled/login-required media cannot and will not be decrypted. In these instances, the application presents a clear and descriptive error message.
- **Respect for Source Terms**: Download content only where you have the authorization, license, or personal rights to do so.
