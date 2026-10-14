import {
  DownloadJob,
  QueueSummary,
  SystemStatus,
  BatchAnalyzeResponse,
} from "./types";

const API_BASE = "";

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/api/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch system status: HTTP ${res.status}`);
  }
  return res.json();
}

export async function analyzeBatchUrls(
  rawUrls: string,
  extractFormats: boolean = true
): Promise<BatchAnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_urls: rawUrls, extract_formats: extractFormats }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to analyze URLs");
  }
  return res.json();
}

export async function createDownloadJobs(
  urls: string[],
  quality: string = "best",
  container: string = "auto",
  filenameTemplate: string = "{title} [{resolution}].{ext}"
): Promise<DownloadJob[]> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls,
      quality,
      container,
      filename_template: filenameTemplate,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to create download jobs");
  }
  const data = await res.json();
  return data.jobs;
}

export async function fetchAllJobs(): Promise<DownloadJob[]> {
  const res = await fetch(`${API_BASE}/api/jobs`);
  if (!res.ok) {
    throw new Error(`Failed to list jobs: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchQueueSummary(): Promise<QueueSummary> {
  const res = await fetch(`${API_BASE}/api/jobs/summary`);
  if (!res.ok) {
    throw new Error(`Failed to fetch summary: HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to cancel job ${jobId}`);
  }
}

export async function cancelAllJobs(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/cancel-all`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to cancel all jobs");
  }
}

export async function retryJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}/retry`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Failed to retry job ${jobId}`);
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete job ${jobId}`);
  }
}

export async function clearAllJobs(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error("Failed to clear queue");
  }
}

export async function updateConcurrency(limit: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/settings/concurrency`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concurrency_limit: limit }),
  });
  if (!res.ok) {
    throw new Error("Failed to update concurrency limit");
  }
}

export function getFileDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/jobs/${jobId}/download`;
}

export function getBatchZipDownloadUrl(jobIds?: string[]): string {
  if (jobIds && jobIds.length > 0) {
    return `${API_BASE}/api/jobs/batch-zip?job_ids=${encodeURIComponent(
      jobIds.join(",")
    )}`;
  }
  return `${API_BASE}/api/jobs/batch-zip`;
}
