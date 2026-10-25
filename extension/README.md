# GodVid Browser Extension (Chrome & Brave) - Compact Edition (v1.0.2)

1-click high-performance video downloader extension for Google Chrome, Brave, Edge, and all Chromium browsers. Connects seamlessly to your local GodVid engine or remote Cloudflare Tunnel.

---

## ⚡ What's New in v1.0.2 (Compact Edition)

- **98.2% Package Size Reduction**: Stripped unnecessary assets, dropping package size from 1,030 KB down to **18.7 KB**.
- **Compact & High-Density UI**: Width reduced to **310px** with reduced vertical padding, inline controls, collapsible custom URL input, and streamlined queue rendering.
- **Cloudflare Tunnel & Remote Support**: Full support for Cloudflare Tunnels (`https://*.trycloudflare.com` or custom domains) via the built-in Settings gear.
- **24/7 Always-On Autostart**: Eliminates the "engine offline" state with silent Windows background service runners.

---

## Features

- **1-Click Download**: Automatically detects the active video page and lets you queue it in one click.
- **Right-Click Context Menu**: Right-click on any video link, video player, or web page and select `"Download Video with GodVid"`.
- **Live Badge & Progress**: Shows active download counts on the extension icon badge and renders real-time download speeds and percentages inside the popup.
- **Quality & Format Controls**: Select your preferred resolution (4K, 1080p, 720p, Audio MP3) and format (MP4, MKV, WebM) directly in the popup.
- **Auto-Save to Disk**: Completed downloads are automatically saved to your browser's default Downloads directory.

---

## How to Install in Google Chrome / Brave

1. Open your browser and navigate to `chrome://extensions/` (or `brave://extensions/`).
2. Toggle on **Developer mode** in the top-right corner.
3. If an earlier version of GodVid is installed, click **Remove** or **Reload**.
4. Click **Load unpacked** and select the folder:
   ```
   a:\PROJECTS\GodVid\extension
   ```
   *(Or extract `godvid-extension-compact.zip` and load that directory).*
5. Pin GodVid to your toolbar.

---

## Cloudflare & 24/7 Setup

1. **Keep running always (local)**: Run `install-autostart-service.bat` to launch the engine silently in the background on every PC boot.
2. **Deploy with Cloudflare**: Run `deploy-cloudflare-tunnel.bat` to get a public `https://*.trycloudflare.com` address.
3. **Configure in Extension**: Click the **Settings (gear icon)** at the top right of the extension popup, paste your Cloudflare URL, and click **Test & Save**.
