"use client";

import React from "react";
import {
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  Film,
  Loader2,
} from "lucide-react";
import { DownloadJob } from "../lib/types";
import { getFileDownloadUrl } from "../lib/api";

interface JobCardProps {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onCancel,
  onRetry,
  onDelete,
}) => {
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";
  const isDownloading = job.status === "downloading" || job.status === "merging";
  const isPending = job.status === "pending" || job.status === "analyzing";

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  };

  const formatSpeed = (bytesPerSec?: number | null) => {
    if (!bytesPerSec || bytesPerSec <= 0) return "";
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const formatDuration = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatETA = (seconds?: number | null) => {
    if (!seconds || seconds <= 0) return "";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  return (
    <div
      className={`bg-[#111827] border rounded-xl p-4 transition-colors ${
        isDownloading
          ? "border-[#2563EB]/40 bg-[#111827]"
          : isCompleted
          ? "border-[#1F2937]"
          : isFailed
          ? "border-red-500/30"
          : "border-[#1F2937]"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Video Thumbnail */}
        <div className="w-full sm:w-44 h-28 sm:h-24 rounded-lg bg-[#0B0F19] border border-[#1F2937] overflow-hidden relative shrink-0 flex items-center justify-center">
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt={job.title || "Video thumbnail"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#6B7280]">
              <Film className="w-6 h-6 stroke-[1.5]" />
            </div>
          )}

          {/* Duration overlay badge */}
          {job.duration && job.duration > 0 && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-medium text-white">
              {formatDuration(job.duration)}
            </span>
          )}
        </div>

        {/* Info & Progress */}
        <div className="flex-1 min-w-0 w-full flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Title */}
              <h3
                className="text-sm font-semibold text-[#F9FAFB] leading-snug truncate"
                title={job.title || job.url}
              >
                {job.title || job.url}
              </h3>

              {/* Badges / Metadata */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                {job.source_host && (
                  <span className="font-mono text-[11px] text-[#9CA3AF] bg-[#1F2937] px-2 py-0.5 rounded border border-[#374151]">
                    {job.source_host}
                  </span>
                )}

                <span className="text-[11px] font-medium text-[#60A5FA] bg-[#2563EB]/10 px-2 py-0.5 rounded border border-[#2563EB]/25">
                  {job.actual_quality || job.requested_quality}
                  {job.actual_container || job.preferred_container
                    ? ` • ${(job.actual_container || job.preferred_container).toUpperCase()}`
                    : ""}
                </span>

                {(job.file_size_bytes || job.progress.total_bytes) && (
                  <span className="text-[11px] text-[#9CA3AF] font-mono">
                    {formatBytes(job.file_size_bytes || job.progress.total_bytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Status Pill */}
            <div className="shrink-0">
              {isCompleted && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </span>
              )}
              {isDownloading && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#2563EB]/15 text-[#60A5FA] border border-[#2563EB]/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{job.status === "merging" ? "Merging" : "Downloading"}</span>
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1F2937] text-[#9CA3AF] border border-[#374151]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#9CA3AF]" />
                  <span>Starting</span>
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Failed</span>
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1F2937] text-[#9CA3AF] border border-[#374151]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelled</span>
                </span>
              )}
            </div>
          </div>

          {/* Error Message if Failed */}
          {isFailed && job.error_message && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-xs text-red-300">
              {job.error_message}
            </div>
          )}

          {/* Progress Bar & Telemetry */}
          {(isDownloading || isCompleted || isPending) && (
            <div className="mt-3 space-y-1">
              <div className="w-full h-1.5 rounded-full bg-[#1F2937] overflow-hidden relative">
                {isPending ? (
                  <div className="progress-indeterminate-bar" />
                ) : (
                  <div
                    className={`h-full rounded-full ${
                      isCompleted
                        ? "bg-emerald-500 transition-[width] duration-300 ease-out"
                        : "progress-continuous-active"
                    }`}
                    style={{
                      width: `${isCompleted ? 100 : Math.max(job.progress.percentage, 1)}%`,
                    }}
                  />
                )}
              </div>

              {/* Progress Detail Line */}
              <div className="flex items-center justify-between text-[11px] text-[#9CA3AF] pt-0.5 font-mono">
                <span>
                  {isDownloading && job.progress.speed_bytes_sec
                    ? `${formatSpeed(job.progress.speed_bytes_sec)} • ${formatBytes(
                        job.progress.downloaded_bytes
                      )} / ${formatBytes(job.progress.total_bytes)}`
                    : job.progress.current_step || "Processing..."}
                </span>

                <div className="flex items-center space-x-2">
                  {isDownloading && job.progress.eta_seconds && (
                    <span>ETA: {formatETA(job.progress.eta_seconds)}</span>
                  )}
                  <span className="font-semibold text-[#F9FAFB]">
                    {Math.round(job.progress.percentage)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#1F2937]">
            <div className="flex items-center space-x-2">
              {/* Completed: Download File */}
              {isCompleted && (
                <a
                  href={getFileDownloadUrl(job.id)}
                  download
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Video File</span>
                </a>
              )}

              {/* Active or Pending: Cancel */}
              {(isDownloading || isPending) && (
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-[#9CA3AF] hover:text-[#F87171] hover:bg-red-500/10 border border-[#374151] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {/* Failed or Cancelled: Retry */}
              {(isFailed || isCancelled) && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#1F2937] hover:bg-[#374151] text-[#60A5FA] border border-[#374151] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(job.id)}
              className="p-1.5 rounded-md text-[#6B7280] hover:text-[#F87171] hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Delete from list"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
