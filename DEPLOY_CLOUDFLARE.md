# GodVid: Cloudflare Deployment & 24/7 Always-On Setup

This guide covers:
1. **Compact Extension (18 KB, 310px sleek UI)**
2. **24/7 Background Execution (Starts silently on Windows boot, never goes offline)**
3. **Cloudflare Tunnel Deployment (Global HTTPS access via Cloudflare)**
4. **Cloudflare Worker Edge Proxy**

---

## 1. Compact Extension

The extension has been optimized for minimal screen footprint and minimal package size:
- **Package size reduced by 98.2%**: from **1,030 KB** down to **18.7 KB** (`godvid-extension-v1.0.2.zip`).
- **Compact UI Dimensions**: Width reduced to **310px** with tight vertical density, compact inline controls, collapsible custom URL input, and minimal queue height.
- **Dynamic Engine Endpoint**: Connect to `http://localhost:8000` or any **Cloudflare Tunnel** (`https://*.trycloudflare.com` or custom domain) via the in-popup Settings gear.

### How to Install in Chrome / Brave / Edge:
1. Open your browser and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle switch).
3. If you have an existing GodVid extension installed, click **Remove** or **Reload**.
4. Click **Load unpacked** and select the folder:
   ```
   a:\PROJECTS\GodVid\extension
   ```
   *(Or unzip `godvid-extension-v1.0.2.zip` and load that directory).*

---

## 2. Keep the Engine Running 24/7 Always (Windows Background Service)

To prevent the **"GodVid engine offline"** error forever without needing open command prompt windows:

### One-Click 24/7 Autostart:
Double-click:
```
install-autostart-service.bat
```
What this does:
- Adds a startup entry to Windows (`shell:startup`) that runs `start-silent-background.vbs` automatically on PC boot.
- Starts the Python FastAPI engine immediately in the background with **zero visible console windows**.
- Operates quietly on `http://localhost:8000`.

### Background Management Scripts:
- **`status-engine.bat`**: Pings the engine health endpoint and prints active workers, disk space, and FFmpeg status.
- **`stop-engine.bat`**: Cleanly terminates the background engine process when you want to shut it down.
- **`start-silent-background.vbs`**: Manually launch the backend in the background without console windows.

---

## 3. Deploying with Cloudflare Tunnel (Recommended)

Cloudflare Tunnel (`cloudflared`) connects your local GodVid engine through Cloudflare's global edge network without needing port forwarding, static IPs, or router configuration.

### Option A: Quick Free Tunnel (Instant HTTPS)
1. Double-click:
   ```
   deploy-cloudflare-tunnel.bat
   ```
2. Cloudflare will generate a public HTTPS URL such as:
   ```
   https://random-words-123.trycloudflare.com
   ```
3. Open the GodVid extension in Chrome, click the **Settings (gear icon)** at the top right, paste your `trycloudflare.com` URL, and click **Test & Save**.
4. The status pill will immediately show **Cloudflare (Online)**.

### Option B: Permanent Named Cloudflare Tunnel (Your Own Domain)
If you have a domain managed by Cloudflare:
1. Log in to Cloudflare from terminal:
   ```powershell
   .\cloudflared.exe tunnel login
   ```
2. Create a named tunnel:
   ```powershell
   .\cloudflared.exe tunnel create godvid
   ```
3. Route DNS to your tunnel:
   ```powershell
   .\cloudflared.exe tunnel route dns godvid godvid.yourdomain.com
   ```
4. Create a configuration file `config.yml`:
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: C:\Users\<Username>\.cloudflared\<TUNNEL_ID>.json
   ingress:
     - hostname: godvid.yourdomain.com
       service: http://localhost:8000
     - service: http_status:404
   ```
5. Install Cloudflare Tunnel as a permanent Windows Service:
   ```powershell
   .\cloudflared.exe service install
   ```
Now both the GodVid engine and Cloudflare Tunnel will run automatically in the background 24/7 even after reboots!

---

## 4. Cloudflare Worker Edge Proxy

If you wish to route traffic through a Cloudflare Worker edge:
1. Navigate to the `cloudflare` directory:
   ```bash
   cd cloudflare
   ```
2. Edit `wrangler.toml` and set `BACKEND_ORIGIN` to your Cloudflare Tunnel URL or cloud server URL.
3. Deploy to Cloudflare Workers:
   ```bash
   npx wrangler deploy
   ```
4. Use the assigned `https://godvid-worker.<subdomain>.workers.dev` URL in your GodVid extension settings.

---

## 5. Cloud Container 24/7 Hosting (Render / Railway / VPS)

If you prefer running GodVid on a remote cloud server 24/7 so it works even when your local computer is powered off:

### Docker Deployment:
The project includes a ready-to-run `backend/Dockerfile` with Python 3.12, FFmpeg, and yt-dlp pre-configured:
```bash
docker build -t godvid-backend backend/
docker run -d -p 8000:8000 --restart always --name godvid godvid-backend
```

### Free / Cheap Cloud Platforms (Railway / Render):
1. Push your repository to GitHub.
2. In Railway or Render, select **New Service** -> **Deploy from GitHub repo**.
3. Select Dockerfile path: `backend/Dockerfile`.
4. It will provide a persistent HTTPS URL (e.g., `https://godvid.up.railway.app`).
5. In Cloudflare DNS, add a CNAME pointing to that URL with Cloudflare Proxy (orange cloud) enabled.
6. Paste the URL into the GodVid Chrome extension!
