const DEFAULT_API_BASE = "http://localhost:8000";
let apiBase = DEFAULT_API_BASE;

let isPollingActive = false;
let pollTimer = null;

// Initialize dynamic backend URL from storage
async function getApiBase() {
  try {
    const stored = await chrome.storage.local.get(["backendUrl"]);
    if (stored && stored.backendUrl && typeof stored.backendUrl === "string" && !stored.backendUrl.includes("lexington-assuming-other-chat")) {
      apiBase = stored.backendUrl.replace(/\/+$/, "");
    } else {
      apiBase = DEFAULT_API_BASE;
      await chrome.storage.local.set({ backendUrl: apiBase });
    }
  } catch (e) {}
  return apiBase;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.backendUrl) {
    const val = changes.backendUrl.newValue;
    apiBase = (val && typeof val === "string" && !val.includes("lexington-assuming-other-chat") ? val : DEFAULT_API_BASE).replace(/\/+$/, "");
  }
});

// Context Menu Setup
chrome.runtime.onInstalled.addListener(async () => {
  await getApiBase();

  chrome.contextMenus.create({
    id: "godvid-download-current",
    title: "Download Video with GodVid",
    contexts: ["page", "video", "audio"],
  });

  chrome.contextMenus.create({
    id: "godvid-download-link",
    title: "Download Link with GodVid",
    contexts: ["link"],
  });

  // Setup periodic background alarm
  if (typeof chrome !== "undefined" && chrome.alarms) {
    chrome.alarms.create("pollGodVidStatus", { periodInMinutes: 0.15 });
  }
  checkAndAutoDownload();
});

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = "";
  if (info.menuItemId === "godvid-download-link" && info.linkUrl) {
    targetUrl = info.linkUrl;
  } else {
    targetUrl = info.srcUrl || info.pageUrl || tab?.url || "";
  }

  if (!targetUrl || !targetUrl.startsWith("http")) {
    showNotification("Error", "Invalid URL selected for download.");
    return;
  }

  try {
    const baseUrl = await getApiBase();
    const stored = await chrome.storage.local.get(["selectedQuality", "selectedContainer"]);
    const quality = stored.selectedQuality || "best";
    const container = stored.selectedContainer || "auto";

    const res = await fetch(`${baseUrl}/api/jobs`, {
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
      throw new Error(err.detail || `Server returned HTTP ${res.status}`);
    }

    showNotification("Download Started", "Video is processing and will automatically save to your Downloads folder.");
    startActivePolling();
  } catch (err) {
    showNotification("Download Failed", `Could not connect to GodVid engine: ${err.message}`);
  }
});

// Handle Alarms for Background Polling
if (typeof chrome !== "undefined" && chrome.alarms && chrome.alarms.onAlarm) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "pollGodVidStatus") {
      checkAndAutoDownload();
    }
  });
}

// Primary Job Check and Zero-Click Auto-Downloader
async function checkAndAutoDownload() {
  try {
    const baseUrl = await getApiBase();
    const res = await fetch(`${baseUrl}/api/jobs`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      updateBadgeCount(0);
      return;
    }

    const jobs = await res.json();
    if (!Array.isArray(jobs)) return;

    // Retrieve already saved job IDs from storage
    const stored = await chrome.storage.local.get(["savedJobIds"]);
    const savedJobIds = new Set(stored.savedJobIds || []);

    let hasActiveJobs = false;

    for (const job of jobs) {
      if (job.status === "downloading" || job.status === "merging" || job.status === "pending" || job.status === "analyzing") {
        hasActiveJobs = true;
      }

      // Check if job completed but has not been saved to user local disk yet
      if (job.status === "completed" && !savedJobIds.has(job.id)) {
        savedJobIds.add(job.id);
        await chrome.storage.local.set({ savedJobIds: Array.from(savedJobIds) });

        // Trigger native Chrome download to user local Downloads storage
        triggerStorageDownload(job);
      }
    }

    const activeCount = jobs.filter(j => j.status === "downloading" || j.status === "merging" || j.status === "pending" || jobIsActive(j)).length;
    updateBadgeCount(activeCount);

    if (hasActiveJobs) {
      startActivePolling();
    } else {
      stopActivePolling();
    }
  } catch (e) {
    updateBadgeCount(0);
  }
}

function jobIsActive(j) {
  return j.status === "pending" || j.status === "analyzing";
}

function startActivePolling() {
  if (isPollingActive) return;
  isPollingActive = true;

  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    await checkAndAutoDownload();
  }, 1200);
}

function stopActivePolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isPollingActive = false;
}

// Automatically save completed video to user's disk storage via chrome.downloads or browser fallback
async function triggerStorageDownload(job) {
  const baseUrl = await getApiBase();
  const downloadUrl = `${baseUrl}/api/jobs/${job.id}/download`;
  const filename = sanitizeFilename(job.output_filename || `${job.title || 'video'}.${job.container || 'mp4'}`);

  if (typeof chrome !== "undefined" && chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download({
      url: downloadUrl,
      filename: filename,
      conflictAction: "uniquify",
      saveAs: false,
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.warn("chrome.downloads error in bg, using tabs fallback:", chrome.runtime.lastError.message);
        chrome.tabs.create({ url: downloadUrl, active: false });
      } else {
        showNotification("Video Saved to Storage", `"${job.title || filename}" saved directly to your Downloads folder.`);
      }
    });
    return;
  }

  // Fallback if downloads permission pending reload
  chrome.tabs.create({ url: downloadUrl, active: false });
}

function sanitizeFilename(name) {
  if (!name) return "video.mp4";
  return name.replace(/[<>:"/\\|?*]/g, "_").trim().slice(0, 180);
}

// Update Extension Icon Badge
function updateBadgeCount(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: "#2563EB" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

// Native Desktop Notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: title,
    message: message,
    priority: 1,
  });
}

// Message Listener for Popup and Other Contexts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "jobQueued") {
    startActivePolling();
    checkAndAutoDownload();
    sendResponse({ ok: true });
  } else if (msg.action === "pollNow") {
    checkAndAutoDownload();
    sendResponse({ ok: true });
  } else if (msg.action === "openDownloadsFolder") {
    if (chrome.downloads && chrome.downloads.showDefaultFolder) {
      chrome.downloads.showDefaultFolder();
    }
    sendResponse({ ok: true });
  }
  return true;
});
