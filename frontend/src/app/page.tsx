"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "../components/Header";
import { UrlInputSection } from "../components/UrlInputSection";
import { JobCard } from "../components/JobCard";
import { QueueSummary } from "../components/QueueSummary";
import { SettingsModal } from "../components/SettingsModal";
import {
  DownloadJob,
  QueueSummary as QueueSummaryType,
  SystemStatus,
} from "../lib/types";
import {
  fetchSystemStatus,
  fetchAllJobs,
  fetchQueueSummary,
  createDownloadJobs,
  cancelJob,
  cancelAllJobs,
  retryJob,
  deleteJob,
  clearAllJobs,
  updateConcurrency,
} from "../lib/api";
import { Film, Inbox } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [summary, setSummary] = useState<QueueSummaryType>({
    total: 0,
    pending: 0,
    analyzing: 0,
    active: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    overall_percentage: 0,
    concurrency_limit: 2,
  });
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Preferences
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [selectedContainer, setSelectedContainer] = useState("auto");
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [filenameTemplate, setFilenameTemplate] = useState("{title} [{resolution}].{ext}");

  // UI state
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const eventSourceRef = useRef<EventSource | null>(null);
  const autoSavedJobsRef = useRef<Set<string>>(new Set());

  const triggerAutoFileSave = (jobId: string, filename?: string) => {
    try {
      const a = document.createElement("a");
      a.href = `/api/jobs/${jobId}/download`;
      a.download = filename || "video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Auto-save error:", err);
    }
  };

  // Initial data load
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingStatus(true);
      const [status, allJobs, queueSummary] = await Promise.all([
        fetchSystemStatus().catch(() => null),
        fetchAllJobs().catch(() => []),
        fetchQueueSummary().catch(() => null),
      ]);

      if (status) {
        setSystemStatus(status);
        setConcurrencyLimit(status.concurrency_limit || 2);
      }
      if (allJobs) {
        setJobs(allJobs);
        allJobs.forEach((j) => {
          if (j.status === "completed") {
            autoSavedJobsRef.current.add(j.id);
          }
        });
      }
      if (queueSummary) setSummary(queueSummary);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  // Server-Sent Events (SSE) for live streaming updates
  useEffect(() => {
    loadInitialData();

    const connectSSE = () => {
      try {
        const es = new EventSource("/api/events");
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const { type, data } = parsed;

            if (type === "initial") {
              setJobs(parsed.jobs || []);
              (parsed.jobs || []).forEach((j: any) => {
                if (j.status === "completed") {
                  autoSavedJobsRef.current.add(j.id);
                }
              });
              if (parsed.summary) setSummary(parsed.summary);
            } else if (type === "job_added") {
              setJobs((prev) => {
                if (prev.some((j) => j.id === data.id)) return prev;
                return [data, ...prev];
              });
            } else if (type === "job_updated") {
              setJobs((prev) =>
                prev.map((j) => (j.id === data.id ? { ...j, ...data } : j))
              );
              if (data.status === "completed") {
                if (!autoSavedJobsRef.current.has(data.id)) {
                  autoSavedJobsRef.current.add(data.id);
                  triggerAutoFileSave(data.id, data.output_filename);
                  toast.success(`Saved to Storage: ${data.title || "Video download"}`);
                }
              } else if (data.status === "failed") {
                toast.error(`Download failed: ${data.title || data.url}`);
              }
            } else if (type === "job_progress") {
              setJobs((prev) =>
                prev.map((j) =>
                  j.id === data.id
                    ? {
                        ...j,
                        progress: data.progress,
                        status: data.status || j.status,
                        title: data.title || j.title,
                        thumbnail: data.thumbnail || j.thumbnail,
                      }
                    : j
                )
              );
            } else if (type === "summary_updated") {
              setSummary(data);
            } else if (type === "job_deleted") {
              setJobs((prev) => prev.filter((j) => j.id !== data.id));
            } else if (type === "queue_cleared") {
              setJobs([]);
            }
          } catch (e) {
            console.error("Error parsing SSE event:", e);
          }
        };

        es.onerror = () => {
          es.close();
          setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    };

    connectSSE();

    // Fallback polling for status & jobs
    const pollInterval = setInterval(() => {
      fetchSystemStatus()
        .then((s) => setSystemStatus(s))
        .catch(() => setSystemStatus(null));

      fetchAllJobs()
        .then((j) => setJobs(j))
        .catch(() => {});
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loadInitialData]);

  // Direct download handler
  const handleDownload = async (
    urls: string[],
    quality: string,
    container: string
  ) => {
    setIsEnqueuing(true);
    try {
      await createDownloadJobs(urls, quality, container, filenameTemplate);
      const allJobs = await fetchAllJobs();
      setJobs(allJobs);
      const summ = await fetchQueueSummary();
      setSummary(summ);
    } finally {
      setIsEnqueuing(false);
    }
  };

  // Job Actions
  const handleCancel = async (id: string) => {
    try {
      await cancelJob(id);
      toast.info("Download cancelled");
    } catch {
      toast.error("Failed to cancel download");
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryJob(id);
      toast.success("Job re-queued for download");
    } catch {
      toast.error("Failed to retry job");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      toast.success("Removed from queue");
    } catch {
      toast.error("Failed to delete job");
    }
  };

  const handleCancelAll = async () => {
    try {
      await cancelAllJobs();
      toast.info("All active jobs cancelled");
    } catch {
      toast.error("Failed to cancel active jobs");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllJobs();
      setJobs([]);
      toast.success("Queue cleared");
    } catch {
      toast.error("Failed to clear queue");
    }
  };

  const handleConcurrencyChange = async (limit: number) => {
    setConcurrencyLimit(limit);
    try {
      await updateConcurrency(limit);
      toast.success(`Concurrency limit set to ${limit}`);
    } catch {
      toast.error("Failed to update concurrency limit");
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active")
      return (
        job.status === "downloading" ||
        job.status === "merging" ||
        job.status === "pending" ||
        job.status === "analyzing"
      );
    if (filterStatus === "completed") return job.status === "completed";
    if (filterStatus === "failed")
      return job.status === "failed" || job.status === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0F19] text-[#F9FAFB] flex flex-col font-sans">
      {/* Clean Header */}
      <Header
        status={systemStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingStatus={isLoadingStatus}
        onRefreshStatus={loadInitialData}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-7">
        {/* URL Input & Quick Download Bar */}
        <UrlInputSection
          onDownload={handleDownload}
          isEnqueuing={isEnqueuing}
          selectedQuality={selectedQuality}
          onQualityChange={setSelectedQuality}
          selectedContainer={selectedContainer}
          onContainerChange={setSelectedContainer}
        />

        {/* Download Queue Section */}
        <div className="mt-7">
          {/* Queue Filters and Batch Actions */}
          <QueueSummary
            summary={summary}
            filterStatus={filterStatus}
            onFilterChange={setFilterStatus}
            onCancelAll={handleCancelAll}
            onClearAll={handleClearAll}
          />

          {/* Job List */}
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                />
              ))}

              {filteredJobs.length === 0 && (
                <div className="p-8 text-center bg-[#111827] border border-[#1F2937] rounded-xl text-xs text-[#9CA3AF]">
                  No downloads match the "{filterStatus}" filter.
                </div>
              )}
            </div>
          ) : (
            /* Clean Minimal Empty State */
            <div className="py-14 px-6 text-center bg-[#111827]/50 border border-dashed border-[#1F2937] rounded-xl">
              <div className="w-12 h-12 rounded-xl bg-[#1F2937] flex items-center justify-center mx-auto text-[#60A5FA] mb-3">
                <Inbox className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h4 className="text-sm font-semibold text-[#F9FAFB]">
                Download queue is empty
              </h4>
              <p className="text-xs text-[#9CA3AF] max-w-sm mx-auto mt-1 leading-relaxed">
                Paste a YouTube or video URL in the box above and click{" "}
                <strong className="text-[#F9FAFB]">Download Video</strong> to begin.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        status={systemStatus}
        concurrencyLimit={concurrencyLimit}
        onConcurrencyChange={handleConcurrencyChange}
      />
    </div>
  );
}
