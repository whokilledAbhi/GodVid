const DEFAULT_API_BASE = "http://localhost:8000";
let apiBase = DEFAULT_API_BASE;
let currentTabUrl = "";
let currentTabTitle = "";
let pageHasVideo = false;
let pollInterval = null;
const localAutoSavedJobs = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedPreferences();
  initElements();
  await detectActiveTab();
  await checkEngineStatus();
  await refreshQueue();

  // Fast UI polling every 1.2 seconds while popup is open
  pollInterval = setInterval(async () => {
    await checkEngineStatus();
    await refreshQueue();
  }, 1200);
});

window.addEventListener("unload", () => {
  if (pollInterval) clearInterval(pollInterval);
});

async function loadSavedPreferences() {
  const stored = await chrome.storage.local.get([
    "backendUrl",
    "savedJobIds",
  ]);

  // Sanitize stored URL: if missing or contains obsolete/dead trycloudflare URL, default to localhost:8000
  if (stored.backendUrl && typeof stored.backendUrl === "string" && !stored.backendUrl.includes("lexington-assuming-other-chat")) {
    apiBase = stored.backendUrl.replace(/\/+$/, "");
  } else {
    apiBase = DEFAULT_API_BASE;
    await chrome.storage.local.set({ backendUrl: apiBase });
  }

  const backendInput = document.getElementById("backendUrlInput");
  if (backendInput) {
    backendInput.value = apiBase;
  }

  if (Array.isArray(stored.savedJobIds)) {
    stored.savedJobIds.forEach((id) => localAutoSavedJobs.add(id));
  }

  updateDashboardLink();
}

function updateDashboardLink() {
  const dashLink = document.getElementById("openDashboardLink");
  if (!dashLink) return;
  if (apiBase.includes("localhost") || apiBase.includes("127.0.0.1")) {
    dashLink.href = "http://localhost:3000";
  } else {
    dashLink.href = apiBase;
  }
}

function initElements() {
  const downloadBtn = document.getElementById("downloadBtn");
  const toggleManualBtn = document.getElementById("toggleManualBtn");
  const manualDownloadBtn = document.getElementById("manualDownloadBtn");
  const clearQueueBtn = document.getElementById("clearQueueBtn");
  const openStorageFolderBtn = document.getElementById("openStorageFolderBtn");

  // Three-dot and quality menu elements
  const threeDotMenuBtn = document.getElementById("threeDotMenuBtn");
  const quickOptionsBtn = document.getElementById("quickOptionsBtn");
  const qualityDropdownMenu = document.getElementById("qualityDropdownMenu");

  // Settings elements
  const toggleSettingsBtn = document.getElementById("toggleSettingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const alertConfigureBtn = document.getElementById("alertConfigureBtn");
  const presetLocalBtn = document.getElementById("presetLocalBtn");
  const saveBackendUrlBtn = document.getElementById("saveBackendUrlBtn");
  const backendUrlInput = document.getElementById("backendUrlInput");

  downloadBtn.addEventListener("click", () => {
    if (pageHasVideo && currentTabUrl) {
      handleDownload(currentTabUrl, "best");
    }
  });

  const toggleQualityMenu = (e) => {
    e.stopPropagation();
    if (!pageHasVideo) return;
    qualityDropdownMenu.classList.toggle("hidden");
  };

  if (threeDotMenuBtn) threeDotMenuBtn.addEventListener("click", toggleQualityMenu);
  if (quickOptionsBtn) quickOptionsBtn.addEventListener("click", toggleQualityMenu);

  // Close quality menu when clicking outside
  document.addEventListener("click", (e) => {
    if (qualityDropdownMenu && !qualityDropdownMenu.classList.contains("hidden")) {
      if (!qualityDropdownMenu.contains(e.target) && e.target !== threeDotMenuBtn && e.target !== quickOptionsBtn) {
        qualityDropdownMenu.classList.add("hidden");
      }
    }
  });

  // Handle Quality selection from dropdown menu
  if (qualityDropdownMenu) {
    qualityDropdownMenu.querySelectorAll(".quality-menu-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const selectedQuality = item.getAttribute("data-quality") || "best";
        qualityDropdownMenu.classList.add("hidden");
        if (pageHasVideo && currentTabUrl) {
          handleDownload(currentTabUrl, selectedQuality);
        }
      });
    });
  }

  toggleManualBtn.addEventListener("click", () => {
    const box = document.getElementById("manualInputContainer");
    box.classList.toggle("hidden");
  });

  manualDownloadBtn.addEventListener("click", () => {
    const input = document.getElementById("manualUrlInput");
    if (input.value.trim()) {
      handleDownload(input.value.trim(), "best");
      input.value = "";
    }
  });

  clearQueueBtn.addEventListener("click", async () => {
    try {
      await fetch(`${apiBase}/api/jobs`, { method: "DELETE" });
      await chrome.storage.local.set({ savedJobIds: [] });
      localAutoSavedJobs.clear();
      await refreshQueue();
      chrome.runtime.sendMessage({ action: "pollNow" });
    } catch (e) {
      console.error("Failed to clear queue", e);
    }
  });

  openStorageFolderBtn.addEventListener("click", () => {
    if (chrome.downloads && chrome.downloads.showDefaultFolder) {
      chrome.downloads.showDefaultFolder();
    }
  });

  // Settings Panel handlers
  const toggleSettings = () => {
    const panel = document.getElementById("settingsPanel");
    panel.classList.toggle("hidden");
  };

  if (toggleSettingsBtn) toggleSettingsBtn.addEventListener("click", toggleSettings);
  if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", toggleSettings);
  if (alertConfigureBtn) alertConfigureBtn.addEventListener("click", () => {
    const panel = document.getElementById("settingsPanel");
    panel.classList.remove("hidden");
    backendUrlInput.focus();
  });

  const saveEndpoint = async (urlVal) => {
    const cleaned = urlVal.trim().replace(/\/+$/, "");
    if (!cleaned) return;

    backendUrlInput.value = cleaned;
    const fb = document.getElementById("settingsFeedback");
    fb.className = "settings-feedback";
    fb.textContent = "Testing connection...";
    fb.classList.remove("hidden");

    try {
      const testRes = await fetch(`${cleaned}/api/status`, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (testRes.ok) {
        apiBase = cleaned;
        await chrome.storage.local.set({ backendUrl: apiBase });
        fb.className = "settings-feedback success";
        fb.textContent = "✓ Connected & saved successfully";
        updateDashboardLink();
        await checkEngineStatus();
        setTimeout(() => {
          fb.classList.add("hidden");
          document.getElementById("settingsPanel").classList.add("hidden");
        }, 1200);
      } else {
        throw new Error(`HTTP ${testRes.status}`);
      }
    } catch (err) {
      apiBase = cleaned;
      await chrome.storage.local.set({ backendUrl: apiBase });
      fb.className = "settings-feedback error";
      fb.textContent = `✕ Saved, but offline (${err.message})`;
      updateDashboardLink();
      await checkEngineStatus();
    }
  };

  if (saveBackendUrlBtn) {
    saveBackendUrlBtn.addEventListener("click", () => saveEndpoint(backendUrlInput.value));
  }

  if (presetLocalBtn) {
    presetLocalBtn.addEventListener("click", () => saveEndpoint("http://localhost:8000"));
  }

  const quickLocalBtn = document.getElementById("quickLocalBtn");
  if (quickLocalBtn) {
    quickLocalBtn.addEventListener("click", () => saveEndpoint("http://localhost:8000"));
  }
}

function isRecognizedVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();

  // Known streaming / tube platforms
  const videoDomains = [
    "youtube.com", "youtu.be", "tiktok.com", "instagram.com/reel", "instagram.com/p",
    "twitter.com", "x.com", "vimeo.com", "reddit.com", "dailymotion.com",
    "twitch.tv", "pinterest.com/pin", "facebook.com/watch", "fb.watch",
    "newdesimms.com", "shorts.xxx", "pornhub.com", "xvideos.com", "spankbang.com",
    "redgifs.com", "bilibili.com", "loom.com", "streamable.com"
  ];
  if (videoDomains.some((d) => lower.includes(d))) return true;

  // Direct media files
  const cleanPath = lower.split("?")[0].split("#")[0];
  const mediaExts = [".mp4", ".mkv", ".webm", ".m3u8", ".mov", ".avi", ".flv", ".mp3", ".m4a", ".wav"];
  if (mediaExts.some((ext) => cleanPath.endsWith(ext))) return true;

  return false;
}

function cleanVideoTitle(rawTitle) {
  if (!rawTitle) return "Web Video";
  let t = rawTitle;

  // 1. Unescape HTML entities
  t = t
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // 2. Remove notification counters e.g. "(1) ", "(99+) "
  t = t.replace(/^\(\d+\+?\)\s*/, "");

  // 3. Remove common site noise suffixes
  t = t.replace(
    /\s+[|\-•–—]\s*(?:YouTube|TikTok|Instagram|Twitter|X|Reddit|Pinterest|ChatGPT|Pornhub|XVideos|Vimeo|Dailymotion|Twitch|Facebook|[A-Za-z0-9-]+\.(?:com|org|net|co|me|tv|xxx|io|site|online|app))\s*$/i,
    ""
  );
  t = t.replace(/\s+-\s+ChatGPT\s*$/i, "");

  // 4. Strip pipe site brand separator if present e.g. "Video Title | Channel"
  if (t.includes(" | ")) {
    const parts = t.split(" | ");
    if (parts[0].trim().length >= 3) {
      t = parts[0];
    }
  }

  // 5. Clean excess whitespace and enclosing quotes
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/^["'“](.*)["'”]$/, "$1").trim();

  return t || "Web Video";
}

async function inspectPageForMedia(tabId) {
  if (!chrome.scripting || !tabId) return { hasVideo: false };
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const videos = Array.from(document.querySelectorAll("video"));
        const iframes = Array.from(document.querySelectorAll("iframe")).filter((f) => {
          const s = (f.src || "").toLowerCase();
          return s.includes("youtube") || s.includes("vimeo") || s.includes("player") || s.includes("embed") || s.includes("stream");
        });
        const ogVideo = document.querySelector('meta[property="og:video"], meta[name="twitter:player"]');

        const hasActiveVideo =
          videos.some((v) => v.src || v.currentSrc || v.querySelector("source")) ||
          iframes.length > 0 ||
          !!ogVideo;

        let title = "";
        // YouTube specific video title selector
        const ytTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string, ytd-watch-metadata h1, #title h1 yt-formatted-string, #title h1");
        if (ytTitle && ytTitle.textContent && ytTitle.textContent.trim().length > 1) {
          title = ytTitle.textContent.trim();
        }

        // Dedicated video title selectors
        if (!title) {
          const dedicatedTitle = document.querySelector('[data-e2e="browse-video-desc"], [data-testid="tweetText"], h1.title, h1[class*="title"], h1[class*="video"], .video-title, #video-title');
          if (dedicatedTitle && dedicatedTitle.textContent && dedicatedTitle.textContent.trim().length > 1) {
            title = dedicatedTitle.textContent.trim();
          }
        }

        // Active video element attributes
        if (!title) {
          const activeVid = videos.find((v) => v.src || v.currentSrc) || videos[0];
          if (activeVid) {
            title = activeVid.getAttribute("title") || activeVid.getAttribute("aria-label") || "";
          }
        }

        // Any h1 on the page
        if (!title) {
          const titleEl = document.querySelector('h1, [data-title], [class*="post-title"], [class*="title-info"]');
          if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 1) {
            title = titleEl.textContent.trim();
          }
        }

        // OpenGraph / Twitter meta titles
        if (!title) {
          const ogT = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]');
          if (ogT && ogT.content) title = ogT.content.trim();
        }

        return {
          hasVideo: hasActiveVideo,
          title: title || document.title || "",
        };
      },
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (e) {
    return { hasVideo: false };
  }
  return { hasVideo: false };
}

async function detectActiveTab() {
  const tabTitleEl = document.getElementById("tabTitle");
  const tabUrlEl = document.getElementById("tabUrl");
  const tabDefaultIcon = document.getElementById("tabDefaultIcon");
  const tabNoVideoIcon = document.getElementById("tabNoVideoIcon");
  const tabFavicon = document.getElementById("tabFavicon");
  const downloadBtn = document.getElementById("downloadBtn");
  const downloadBtnText = document.getElementById("downloadBtnText");
  const threeDotMenuBtn = document.getElementById("threeDotMenuBtn");
  const quickOptionsBtn = document.getElementById("quickOptionsBtn");

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      currentTabUrl = tab.url || "";
      const rawTitle = tab.title || "Web Video";

      // Disallow internal browser URLs
      if (
        currentTabUrl.startsWith("chrome://") ||
        currentTabUrl.startsWith("brave://") ||
        currentTabUrl.startsWith("about:") ||
        currentTabUrl.startsWith("edge://")
      ) {
        pageHasVideo = false;
        tabTitleEl.textContent = "Browser Internal Page";
        tabUrlEl.textContent = "Open a webpage with a video to download";
        tabDefaultIcon.classList.add("hidden");
        tabNoVideoIcon.classList.remove("hidden");
        tabFavicon.classList.add("hidden");
        downloadBtn.disabled = true;
        downloadBtnText.textContent = "No Video Detected";
        if (threeDotMenuBtn) threeDotMenuBtn.disabled = true;
        if (quickOptionsBtn) quickOptionsBtn.disabled = true;
        return;
      }

      // 1. Check if recognized video platform or direct media URL
      const isKnownVideo = isRecognizedVideoUrl(currentTabUrl);

      // 2. Query page DOM for media tags and true title
      const domMedia = await inspectPageForMedia(tab.id);

      pageHasVideo = isKnownVideo || (domMedia && domMedia.hasVideo);

      if (pageHasVideo) {
        const candidateTitle = (domMedia && domMedia.title && domMedia.title.length > 2) ? domMedia.title : rawTitle;
        currentTabTitle = cleanVideoTitle(candidateTitle);

        tabTitleEl.textContent = currentTabTitle;
        tabTitleEl.title = currentTabTitle;
        tabUrlEl.textContent = currentTabUrl;
        tabUrlEl.title = currentTabUrl;

        tabDefaultIcon.classList.remove("hidden");
        tabNoVideoIcon.classList.add("hidden");

        if (tab.favIconUrl) {
          tabFavicon.src = tab.favIconUrl;
          tabFavicon.classList.remove("hidden");
          tabDefaultIcon.classList.add("hidden");
        }

        downloadBtn.disabled = false;
        downloadBtnText.textContent = "Download Video";
        if (threeDotMenuBtn) threeDotMenuBtn.disabled = false;
        if (quickOptionsBtn) quickOptionsBtn.disabled = false;
      } else {
        // No video detected on this page (e.g. ChatGPT, Google, Wikipedia)
        currentTabTitle = "No video detected on this page";
        tabTitleEl.textContent = "No video detected on this page";
        tabTitleEl.title = "No video or media stream found on this page";
        tabUrlEl.textContent = currentTabUrl;
        tabUrlEl.title = currentTabUrl;

        tabDefaultIcon.classList.add("hidden");
        tabNoVideoIcon.classList.remove("hidden");
        if (tab.favIconUrl) {
          tabFavicon.src = tab.favIconUrl;
          tabFavicon.classList.remove("hidden");
        }

        downloadBtn.disabled = true;
        downloadBtnText.textContent = "No Video Detected";
        if (threeDotMenuBtn) threeDotMenuBtn.disabled = true;
        if (quickOptionsBtn) quickOptionsBtn.disabled = true;
      }
    }
  } catch (err) {
    console.error("Failed to detect active tab:", err);
  }
}

async function checkEngineStatus() {
  const offlineNotice = document.getElementById("offlineNotice");
  const downloadBtn = document.getElementById("downloadBtn");
  const manualDownloadBtn = document.getElementById("manualDownloadBtn");

  try {
    const res = await fetch(`${apiBase}/api/status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();

    if (data.status === "healthy") {
      offlineNotice.classList.add("hidden");
      if (pageHasVideo) {
        downloadBtn.disabled = false;
      }
      if (manualDownloadBtn) manualDownloadBtn.disabled = false;
      return;
    } else {
      throw new Error("Unhealthy");
    }
  } catch {
    // If configured endpoint failed and is not localhost, probe localhost:8000 as auto-recovery
    if (apiBase !== "http://localhost:8000") {
      try {
        const localRes = await fetch("http://localhost:8000/api/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(1500),
        });
        if (localRes.ok) {
          const localData = await localRes.json();
          if (localData.status === "healthy") {
            apiBase = "http://localhost:8000";
            await chrome.storage.local.set({ backendUrl: apiBase });
            const backendInput = document.getElementById("backendUrlInput");
            if (backendInput) backendInput.value = apiBase;
            updateDashboardLink();

            offlineNotice.classList.add("hidden");
            if (pageHasVideo) {
              downloadBtn.disabled = false;
            }
            if (manualDownloadBtn) manualDownloadBtn.disabled = false;
            return;
          }
        }
      } catch {}
    }

    offlineNotice.classList.remove("hidden");
    downloadBtn.disabled = true;
    if (manualDownloadBtn) manualDownloadBtn.disabled = true;
  }
}

async function handleDownload(targetUrl, quality = "best") {
  if (!targetUrl || !targetUrl.startsWith("http")) {
    showFeedback("Please navigate to a valid web page or paste a link.", true);
    return;
  }

  const downloadBtn = document.getElementById("downloadBtn");
  const btnText = document.getElementById("downloadBtnText");

  try {
    downloadBtn.disabled = true;
    const qLabel = quality === "audio_only" ? "Audio (MP3)" : (quality === "best" ? "Best Available" : quality);
    btnText.textContent = `Queueing (${qLabel})...`;

    const res = await fetch(`${apiBase}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [targetUrl],
        title: currentTabTitle && currentTabTitle !== "No video detected on this page" ? currentTabTitle : undefined,
        quality: quality,
        container: "auto",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error (HTTP ${res.status})`);
    }

    showFeedback(`Download started (${qLabel})!`, false);
    btnText.textContent = "Downloading...";

    // Notify background worker
    chrome.runtime.sendMessage({ action: "jobQueued" });
    await refreshQueue();

    setTimeout(() => {
      btnText.textContent = "Download Video";
      if (pageHasVideo) downloadBtn.disabled = false;
    }, 2000);
  } catch (err) {
    showFeedback(err.message, true);
    btnText.textContent = "Download Video";
    if (pageHasVideo) downloadBtn.disabled = false;
  }
}

async function refreshQueue() {
  const listEl = document.getElementById("queueList");
  try {
    const res = await fetch(`${apiBase}/api/jobs`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return;

    const jobs = await res.json();
    if (!jobs || jobs.length === 0) {
      listEl.innerHTML = '<div class="queue-empty">Queue empty</div>';
      return;
    }

    // Auto-trigger browser storage download for completed jobs not yet saved
    for (const job of jobs) {
      if (job.status === "completed" && !localAutoSavedJobs.has(job.id)) {
        localAutoSavedJobs.add(job.id);
        chrome.storage.local.set({ savedJobIds: Array.from(localAutoSavedJobs) });
        triggerBrowserStorageDownload(job);
      }
    }

    // Render uniform compact cards for the recent 3 jobs
    const recent = jobs.slice(0, 3);
    listEl.innerHTML = recent.map((job) => renderJobItem(job)).join("");

    // Bind click listeners for manual Save/Download buttons
    listEl.querySelectorAll(".save-storage-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const jobId = btn.getAttribute("data-job-id");
        const job = jobs.find((j) => j.id === jobId);
        if (job) {
          triggerBrowserStorageDownload(job);
          showFeedback("Saving file to Downloads folder...", false);
        }
      });
    });
  } catch {
    // Ignore fetch errors during periodic polling
  }
}

function renderJobItem(job) {
  const isCompleted = job.status === "completed";
  const isDownloading = job.status === "downloading" || job.status === "merging";
  const isFailed = job.status === "failed";
  const pct = Math.round(job.progress?.percentage || 0);

  let statusClass = "status-active-pill";
  if (isCompleted) statusClass = "status-completed-pill";
  if (isFailed) statusClass = "status-failed-pill";

  const qualityStr = job.actual_quality || job.requested_quality || "Best";
  const sizeBytes = job.file_size_bytes || job.progress?.total_bytes;
  const formattedSize = formatBytes(sizeBytes);
  const specText = formattedSize ? `${qualityStr} • ${formattedSize}` : qualityStr;

  const speedStr = job.progress?.speed_bytes_sec
    ? `${(job.progress.speed_bytes_sec / 1024 / 1024).toFixed(1)} MB/s`
    : "";

  return `
    <div class="queue-item">
      <div class="queue-item-header">
        <span class="queue-item-title" title="${escapeHtml(job.title || job.url)}">
          ${escapeHtml(job.title || job.url)}
        </span>
        <span class="queue-item-status ${statusClass}">
          ${job.status}
        </span>
      </div>

      <div class="progress-track">
        <div class="progress-bar ${isCompleted ? 'completed' : (isDownloading ? 'active' : 'pending')}" style="${isCompleted ? 'width: 100%' : (isDownloading ? `width: ${Math.max(pct, 3)}%` : '')}"></div>
      </div>

      <div class="queue-item-meta">
        <span class="meta-specs">${specText}</span>
        ${isCompleted ? `
          <button class="save-storage-btn" data-job-id="${job.id}" type="button">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Save
          </button>
        ` : `
          <span style="font-weight:600;color:#60A5FA;">${speedStr ? speedStr + ' • ' : ''}${pct}%</span>
        `}
      </div>
    </div>
  `;
}

function triggerBrowserStorageDownload(job) {
  const downloadUrl = `${apiBase}/api/jobs/${job.id}/download`;
  const filename = sanitizeFilename(job.output_filename || `${job.title || 'video'}.${job.container || 'mp4'}`);

  if (typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.warn("chrome.downloads error, using fallback browser anchor:", chrome.runtime.lastError.message);
        fallbackAnchorDownload(downloadUrl, filename);
      }
    });
    return;
  }

  fallbackAnchorDownload(downloadUrl, filename);
}

function fallbackAnchorDownload(url, filename) {
  try {
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename);
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  } catch (err) {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: url, active: false });
    } else {
      window.open(url, "_blank");
    }
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}

function sanitizeFilename(name) {
  if (!name) return "video.mp4";
  return name.replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 180);
}

function showFeedback(msg, isError) {
  const el = document.getElementById("actionFeedback");
  el.textContent = msg;
  el.className = `feedback-msg ${isError ? 'feedback-error' : 'feedback-success'}`;
  el.classList.remove("hidden");

  setTimeout(() => {
    el.classList.add("hidden");
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
