const API_BASE = "http://localhost:8000";

let currentTabUrl = "";
let currentTabTitle = "";
let pollInterval = null;
const localAutoSavedJobs = new Set();

document.addEventListener("DOMContentLoaded", async () => {
  initElements();
  await loadSavedPreferences();
  await detectActiveTab();
  await checkEngineStatus();
  await refreshQueue();

  // Fast UI polling every 1 second while popup is open
  pollInterval = setInterval(refreshQueue, 1000);
});

window.addEventListener("unload", () => {
  if (pollInterval) clearInterval(pollInterval);
});

function initElements() {
  const downloadBtn = document.getElementById("downloadBtn");
  const toggleManualBtn = document.getElementById("toggleManualBtn");
  const manualDownloadBtn = document.getElementById("manualDownloadBtn");
  const clearQueueBtn = document.getElementById("clearQueueBtn");
  const qualitySelect = document.getElementById("qualitySelect");
  const containerSelect = document.getElementById("containerSelect");
  const openStorageFolderBtn = document.getElementById("openStorageFolderBtn");

  downloadBtn.addEventListener("click", () => handleDownload(currentTabUrl));

  toggleManualBtn.addEventListener("click", () => {
    const box = document.getElementById("manualInputContainer");
    box.classList.toggle("hidden");
  });

  manualDownloadBtn.addEventListener("click", () => {
    const input = document.getElementById("manualUrlInput");
    if (input.value.trim()) {
      handleDownload(input.value.trim());
      input.value = "";
    }
  });

  clearQueueBtn.addEventListener("click", async () => {
    try {
      await fetch(`${API_BASE}/api/jobs`, { method: "DELETE" });
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

  qualitySelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ selectedQuality: e.target.value });
  });

  containerSelect.addEventListener("change", (e) => {
    chrome.storage.local.set({ selectedContainer: e.target.value });
  });
}

async function loadSavedPreferences() {
  const stored = await chrome.storage.local.get(["selectedQuality", "selectedContainer", "savedJobIds"]);
  if (stored.selectedQuality) {
    document.getElementById("qualitySelect").value = stored.selectedQuality;
  }
  if (stored.selectedContainer) {
    document.getElementById("containerSelect").value = stored.selectedContainer;
  }
  if (Array.isArray(stored.savedJobIds)) {
    stored.savedJobIds.forEach(id => localAutoSavedJobs.add(id));
  }
}

async function detectActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      currentTabUrl = tab.url || "";
      currentTabTitle = tab.title || "Web Video";

      document.getElementById("tabTitle").textContent = currentTabTitle;
      document.getElementById("tabTitle").title = currentTabTitle;
      document.getElementById("tabUrl").textContent = currentTabUrl;
      document.getElementById("tabUrl").title = currentTabUrl;

      if (tab.favIconUrl) {
        const faviconImg = document.getElementById("tabFavicon");
        faviconImg.src = tab.favIconUrl;
        faviconImg.classList.remove("hidden");
        document.getElementById("tabDefaultIcon").classList.add("hidden");
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
    const res = await fetch(`${API_BASE}/api/status`, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();

    if (data.status === "healthy") {
      offlineNotice.classList.add("hidden");
      downloadBtn.disabled = false;
      if (manualDownloadBtn) manualDownloadBtn.disabled = false;
    } else {
      throw new Error("Unhealthy");
    }
  } catch {
    offlineNotice.classList.remove("hidden");
    downloadBtn.disabled = true;
    if (manualDownloadBtn) manualDownloadBtn.disabled = true;
  }
}

async function handleDownload(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith("http")) {
    showFeedback("Please navigate to a valid web page or paste a link.", true);
    return;
  }

  const quality = document.getElementById("qualitySelect").value;
  const container = document.getElementById("containerSelect").value;
  const downloadBtn = document.getElementById("downloadBtn");
  const btnText = document.getElementById("downloadBtnText");

  try {
    downloadBtn.disabled = true;
    btnText.textContent = "Initiating...";

    const res = await fetch(`${API_BASE}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [targetUrl],
        quality: quality,
        container: container,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error (HTTP ${res.status})`);
    }

    showFeedback("Download started! Video will automatically save to your Downloads folder.", false);
    btnText.textContent = "Downloading...";

    // Notify background worker
    chrome.runtime.sendMessage({ action: "jobQueued" });
    await refreshQueue();

    setTimeout(() => {
      btnText.textContent = "Download This Video";
      downloadBtn.disabled = false;
    }, 2500);
  } catch (err) {
    showFeedback(err.message, true);
    btnText.textContent = "Download This Video";
    downloadBtn.disabled = false;
  }
}

async function refreshQueue() {
  const listEl = document.getElementById("queueList");
  try {
    const res = await fetch(`${API_BASE}/api/jobs`, { cache: "no-store" });
    if (!res.ok) return;

    const jobs = await res.json();
    if (!jobs || jobs.length === 0) {
      listEl.innerHTML = '<div class="empty-queue">No active downloads</div>';
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

    // Render uniform cards for the recent 4 jobs
    const recent = jobs.slice(0, 4);
    listEl.innerHTML = recent.map((job) => renderJobItem(job)).join("");

    // Bind click listeners for manual Save/Download buttons
    listEl.querySelectorAll(".save-storage-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const jobId = btn.getAttribute("data-job-id");
        const job = jobs.find((j) => j.id === jobId);
        if (job) {
          triggerBrowserStorageDownload(job);
          showFeedback("Saving file to your Downloads folder...", false);
        }
      });
    });
  } catch {
    // Ignore fetch errors during periodic polling
  }
}

// Uniformly structured card for every video regardless of quality
function renderJobItem(job) {
  const isCompleted = job.status === "completed";
  const isDownloading = job.status === "downloading" || job.status === "merging";
  const isFailed = job.status === "failed";
  const pct = Math.round(job.progress?.percentage || 0);

  let statusClass = "status-active-pill";
  if (isCompleted) statusClass = "status-completed-pill";
  if (isFailed) statusClass = "status-failed-pill";

  // Display Quality AND File Size for every single file
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
        <div class="progress-bar ${isCompleted ? 'completed' : (isDownloading ? 'active' : 'pending')}" style="${isCompleted ? 'width: 100%' : (isDownloading ? `width: ${Math.max(pct, 2)}%` : '')}"></div>
      </div>

      <div class="queue-item-meta">
        <span class="meta-specs">${specText}</span>
        ${isCompleted ? `
          <button class="save-storage-btn" data-job-id="${job.id}" type="button">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Save to Storage
          </button>
        ` : `
          <span style="font-weight:600;color:#60A5FA;">${speedStr ? speedStr + ' • ' : ''}${pct}%</span>
        `}
      </div>
    </div>
  `;
}

// Direct zero-click browser download trigger
function triggerBrowserStorageDownload(job) {
  const downloadUrl = `${API_BASE}/api/jobs/${job.id}/download`;
  const filename = sanitizeFilename(job.output_filename || `${job.title || 'video'}.${job.container || 'mp4'}`);

  // 1. Try Chrome Downloads API if extension permissions active
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

  // 2. Direct browser native anchor trigger fallback
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
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
