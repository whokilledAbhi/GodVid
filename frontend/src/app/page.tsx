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
  VideoMetadata,
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
import { Film, ListFilter } from "lucide-react";

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

  // Initial load
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

  // Connect Server-Sent Events (SSE) for real-time live updates
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
          // Reconnect with backoff
          setTimeout(connectSSE, 3000);
        };
      } catch (err) {
        console.error("SSE connection error:", err);
      }
    };

    connectSSE();

    // Fallback polling every 5s
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

  // Handle URL analysis
  const handleAnalyze = async (rawUrls: string) => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeBatchUrls(rawUrls, true);
      // If there are analyzed items with resolution options, we can reflect them
      if (res.items.length > 0) {
        // Enqueue items into the queue
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

  // Handle Direct Download All
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

  // Job item actions
  const handleCancel = async (id: string) => {
    await cancelJob(id);
  };

  const handleRetry = async (id: string) => {
    await retryJob(id);
  };

  const handleDelete = async (id: string) => {
    await deleteJob(id);
  };

  const handleCancelAll = async () => {
    await cancelAllJobs();
  };

  const handleClearAll = async () => {
    await clearAllJobs();
  };

  const handleConcurrencyChange = async (limit: number) => {
    setConcurrencyLimit(limit);
    await updateConcurrency(limit);
  };

  // Filter jobs by status tab
  const filteredJobs = jobs.filter((job) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "active")
      return job.status === "downloading" || job.status === "merging";
    if (filterStatus === "completed") return job.status === "completed";
    if (filterStatus === "failed")
      return job.status === "failed" || job.status === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <Header
        status={systemStatus}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingStatus={isLoadingStatus}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Main Input Section */}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-2">
                <Film className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-zinc-100">
                  Processing Queue ({jobs.length})
                </h3>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs">
                {[
                  { id: "all", label: `All (${jobs.length})` },
                  { id: "active", label: `Active (${summary.active})` },
                  { id: "completed", label: `Completed (${summary.completed})` },
                  { id: "failed", label: `Issues (${summary.failed + summary.cancelled})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterStatus(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      filterStatus === tab.id
                        ? "bg-zinc-800 text-white font-semibold shadow-sm"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tab.label}
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
                <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-xs text-zinc-400">
                  No jobs matching this filter.
                </div>
              )}
            </div>
          ) : (
            <div className="py-14 px-4 text-center bg-zinc-900/30 border border-dashed border-zinc-800 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500 mb-3">
                <ListFilter className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-zinc-300">
                Download queue is empty
              </h4>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
                Paste video links in the box above and click "Analyze URLs" or "Download All" to begin batch processing.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Format Inspector Modal */}
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
