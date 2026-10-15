# GodVid Browser Extension (Chrome & Brave)

1-click video downloader extension for Google Chrome, Brave, Edge, and all Chromium browsers. Connects directly to your local GodVid engine.

---

## Features

- **1-Click Download**: Automatically detects the active video page or YouTube/Vimeo/social media tab and lets you queue it in one click.
- **Right-Click Context Menu**: Right-click on any video link, video player, or web page and select `"Download Video with GodVid"`.
- **Live Badge & Progress**: Shows active download counts directly on the extension icon badge and renders real-time download speeds and percentages inside the popup.
- **Quality & Format Controls**: Select your preferred resolution (4K, 1080p, 720p, Audio MP3) and format (MP4, MKV, WebM) directly in the popup.
- **Universal Sniffer Integration**: Leverages the local GodVid Universal Sniffer to extract embedded streams from custom tube sites, blogs, and video players.

---

## How to Install in Google Chrome

1. Open Google Chrome.
2. Navigate to: `chrome://extensions/`
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button in the top-left.
5. In the folder picker dialog, select this folder:
   ```
   A:\PROJECTS\GodVid\extension
   ```
6. The **GodVid Video Downloader** extension is now installed!
7. Pin the extension to your toolbar by clicking the puzzle icon in Chrome and clicking the pin icon next to GodVid.

---

## How to Install in Brave Browser

1. Open Brave Browser.
2. Navigate to: `brave://extensions/`
3. Toggle on **Developer mode** in the top-right corner.
4. Click the **Load unpacked** button.
5. Select this folder:
   ```
   A:\PROJECTS\GodVid\extension
   ```
6. Pin GodVid to your toolbar.

---

## Usage

1. Make sure your GodVid backend engine is running on `http://localhost:8000` (run `.\start.bat` or `python backend/run.py`).
2. When watching a video on YouTube, Vimeo, Reddit, Twitter, or any video website, click the GodVid extension icon on your browser toolbar.
3. Select your desired Quality and click **Download This Video**.
4. You can also right-click any video or link and click **Download Video with GodVid**.
