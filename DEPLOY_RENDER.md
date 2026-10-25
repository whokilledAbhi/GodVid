# Deploying GodVid Backend to Render (Zero Sleep Configuration)

This configuration enables 24/7 continuous operation on Render with Docker, FFmpeg, and multi-stream media extraction.

---

## 1. Quick Deploy via Render Blueprint (Recommended)

1. Push this repository (`GodVid`) to your GitHub / GitLab account.
2. Log in to [Render.com](https://render.com/).
3. Click **New +** -> **Blueprint**.
4. Select your `GodVid` repository.
5. Render will automatically read `render.yaml`, configure the Docker build (`backend/Dockerfile`), allocate ports, and start the service.
6. Once deployed, copy your service URL (e.g., `https://godvid-backend.onrender.com`).

---

## 2. Manual Web Service Creation (Alternative)

If you prefer setting it up manually:
- **Service Type:** Web Service
- **Runtime:** Docker
- **Root Directory:** `backend`
- **Dockerfile Path:** `Dockerfile`
- **Instance Type:** Free (or Starter)
- **Health Check Path:** `/health`
- **Environment Variables:**
  - `PORT`: `8000`
  - `HOST`: `0.0.0.0`
  - `MAX_BATCH_SIZE`: `50`
  - `DEFAULT_CONCURRENCY`: `5`
  - `MAX_CONCURRENCY`: `8`
  - `RETENTION_HOURS`: `24`

---

## 3. How the "Never Sleep" System Operates

Render's free tier spins down after 15 minutes of inactivity. To prevent sleep, this backend implements a **dual keep-alive heartbeat**:

1. **Automatic Self-Pinger (Built into FastAPI):**
   - Render automatically injects `RENDER_EXTERNAL_URL` into your running service.
   - When the service boots, a background task (`render_keep_alive_loop`) sends an HTTP GET request to its own public URL (`https://<service>.onrender.com/health`) every **9.5 minutes (570 seconds)**.
   - Because the request traverses Render's public edge router, Render detects active web traffic and resets the 15-minute inactivity counter continuously.

2. **External Fallback Heartbeat (GitHub Actions / UptimeRobot):**
   - If the service ever reboots, an external pinger ensures it wakes immediately:
     - **Option A (GitHub Actions):** Go to your repo on GitHub -> **Settings** -> **Secrets and variables** -> **Actions** -> New repository secret: `RENDER_APP_URL` = `https://<your-service>.onrender.com`. The workflow runs every 10 minutes.
     - **Option B (Free UptimeRobot / Cron-Job.org):** Add a free HTTP monitor pointing to `https://<your-service>.onrender.com/health` set to a 5-minute interval.

---

## 4. Connecting to God of Tools

Once your Render URL is live (e.g., `https://godvid-backend.onrender.com`):

### Option A: Via Environment Variable (for deployments)
In your `God Of Tools` repository:
Add to `.env.local` (or your Vercel/production environment variables):
```env
NEXT_PUBLIC_GODVID_API_URL=https://godvid-backend.onrender.com
```

### Option B: Instant In-Browser Setting
1. Open God of Tools -> navigate to `/tools/all-video-downloader`.
2. Click **Engine Settings** in the workspace.
3. Paste `https://godvid-backend.onrender.com` into the API Endpoint field and click **Save & Test Connection**.
