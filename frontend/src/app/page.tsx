"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "../components/Header";
import { UrlInputSection } from "../components/UrlInputSection";
import { PreferencesBar } from "../components/PreferencesBar";
import { JobCard } from "../components/JobCard";
import { QueueSummary } from "../components/QueueSummary";
import { FormatModal } from "../components/FormatModal";
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
  analyzeBatchUrls,
  createDownloadJobs,
  cancelJob,
  cancelAllJobs,
  retryJob,
  deleteJob,
  clearAllJobs,
  updateConcurrency,
} from "../lib/api";
import { Film, ListFilter, Inbox, Sparkles } from "lucide-react";
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

  // User preferences
  const [selectedQuality, setSelectedQuality] = useState("best");
  const [selectedContainer, setSelectedContainer] = useState("auto");
  const [concurrencyLimit, setConcurrencyLimit] = useState(2);
  const [filenameTemplate, setFilenameTemplate] = useState("{title} [{resolution}].{ext}");

  // UI state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnqueuing, setIsEnqueuing] = useState(false);
  const [inspectingJob, setInspectingJob] = useState<DownloadJob | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const eventSourceRef = useRef<EventSource | null>(null);

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
      if (allJobs) setJobs(allJobs);
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
              // Notification on completion
              if (data.status === "completed") {
                toast.success(`Completed: ${data.title || "Video download"}`);
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

    const pollInterval = setInterval(() => {
      fetchSystemStatus()
        .then((s) => setSystemStatus(s))
        .catch(() => setSystemStatus(null));
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loadInitialData]);

  // URL analysis
  const handleAnalyze = async (rawUrls: string) => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeBatchUrls(rawUrls, true);
      if (res.items.length > 0) {
        await createDownloadJobs(
          res.valid_urls,
          selectedQuality,
          selectedContainer,
          filenameTemplate
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Direct Download All
  const handleDownloadAll = async (urls: string[]) => {
    setIsEnqueuing(true);
    try {
      await createDownloadJobs(
        urls,
        selectedQuality,
        selectedContainer,
        filenameTemplate
      );
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
      toast.error("Failed to cancel job");
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
      toast.error("Failed to cancel all jobs");
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllJobs();
      toast.success("Queue cleared");
    } catch {
      toast.error("Failed to clear queue");
    }
  };

  const handleConcurrencyChange = async (limit: number) => {
    setConcurrencyLimit(limit);
    try {
      await updateConcurrency(limit);
      toast.success(`Concurrency limit set to ${limit}x`);
    } catch {
      toast.error("Failed to update concurrency limit");
    }
  };

  // Filter jobs by tab
  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active")
      return job.status === "downloading" || job.status === "merging" || job.status === "analyzing";
    if (filterStatus === "completed") return job.status === "completed";
    if (filterStatus === "failed")
      return job.status === "failed" || job.status === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0D12] text-[#F2F5FA] flex flex-col font-sans">
      {/* Header */}
      <Header
        status={systemStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingStatus={isLoadingStatus}
        onRefreshStatus={loadInitialData}
      />

      {/* Main Centered Content Container */}
      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {/* URL Input Section */}
        <UrlInputSection
          onAnalyze={handleAnalyze}
          onDownloadAll={handleDownloadAll}
          isAnalyzing={isAnalyzing}
          isEnqueuing={isEnqueuing}
        />

        {/* Global Extraction Preferences */}
        <PreferencesBar
          selectedQuality={selectedQuality}
          onQualityChange={setSelectedQuality}
          selectedContainer={selectedContainer}
          onContainerChange={setSelectedContainer}
          concurrencyLimit={concurrencyLimit}
          onConcurrencyChange={handleConcurrencyChange}
          filenameTemplate={filenameTemplate}
          onFilenameTemplateChange={setFilenameTemplate}
        />

        {/* Queue Section */}
        <div className="mt-8">
          {/* Summary Banner */}
          <QueueSummary
            summary={summary}
            onCancelAll={handleCancelAll}
            onClearAll={handleClearAll}
          />

          {/* Queue Filter Tabs & Header */}
          {jobs.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center space-x-2.5">
                <Film className="w-5 h-5 text-[#7185FF]" />
                <h3 className="text-lg font-bold text-[#F2F5FA]">
                  Download Queue
                </h3>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-[#171D28] text-[#9AA6B8] border border-[#273041]">
                  {jobs.length}
                </span>
              </div>

              {/* Status Filter Tabs (Motrix Style) */}
              <div className="flex items-center space-x-1.5 p-1 bg-[#121720] border border-[#273041] rounded-xl text-xs">
                {[
                  { id: "all", label: "All", count: jobs.length },
                  { id: "active", label: "Active", count: summary.active + summary.analyzing },
                  { id: "completed", label: "Completed", count: summary.completed },
                  { id: "failed", label: "Issues", count: summary.failed + summary.cancelled },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                      filterStatus === tab.id
                        ? "bg-[#7185FF] text-white font-semibold shadow-sm shadow-[#7185FF]/20"
                        : "text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28]"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="text-[11px] opacity-80 font-mono">({tab.count})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Jobs List */}
          {jobs.length > 0 ? (
            <div className="space-y-3.5">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onInspectFormats={setInspectingJob}
                />
              ))}

              {filteredJobs.length === 0 && (
                <div className="p-10 text-center bg-[#121720] border border-[#273041] rounded-2xl text-xs text-[#9AA6B8]">
                  No jobs currently match the "{filterStatus}" filter.
                </div>
              )}
            </div>
          ) : (
            /* Refined Empty State */
            <div className="py-16 px-6 text-center bg-[#121720]/60 border border-dashed border-[#273041] rounded-2xl">
              <div className="w-14 h-14 rounded-2xl bg-[#171D28] border border-[#273041] flex items-center justify-center mx-auto text-[#7185FF] mb-3.5 shadow-inner">
                <Inbox className="w-7 h-7 stroke-[1.8]" />
              </div>
              <h4 className="text-base font-semibold text-[#F2F5FA]">
                Download queue is empty
              </h4>
              <p className="text-xs text-[#9AA6B8] max-w-md mx-auto mt-1.5 leading-relaxed">
                Paste one or multiple video links in the box above and click{" "}
                <strong className="text-[#F2F5FA]">Analyze URLs</strong> to inspect formats or{" "}
                <strong className="text-[#7185FF]">Download All</strong> to begin batch processing.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Format Modal */}
      <FormatModal
        job={inspectingJob}
        onClose={() => setInspectingJob(null)}
      />

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
