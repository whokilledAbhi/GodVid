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
      className={`bg-white/[0.02] hover:bg-white/[0.035] backdrop-blur-xl border rounded-2xl p-4 transition-all shadow-lg ${
        isDownloading
          ? "border-blue-500/30"
          : isCompleted
          ? "border-emerald-500/20"
          : isFailed
          ? "border-rose-500/25"
          : "border-white/[0.06]"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Video Thumbnail */}
        <div className="w-full sm:w-40 h-28 sm:h-24 rounded-xl bg-black/40 border border-white/[0.06] overflow-hidden relative shrink-0 flex items-center justify-center">
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt={job.title || "Video thumbnail"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <Film className="w-6 h-6 stroke-[1.5]" />
            </div>
          )}

          {/* Duration overlay badge */}
          {job.duration && job.duration > 0 && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-mono font-medium text-white">
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
                className="text-xs sm:text-sm font-semibold text-white leading-snug truncate"
                title={job.title || job.url}
              >
                {job.title || job.url}
              </h3>

              {/* Badges / Metadata */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                {job.source_host && (
                  <span className="font-mono text-[10.5px] text-slate-400 bg-white/[0.03] px-2 py-0.5 rounded-md border border-white/[0.05]">
                    {job.source_host}
                  </span>
                )}

                <span className="text-[10.5px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                  {job.actual_quality || job.requested_quality}
                  {job.actual_container || job.preferred_container
                    ? ` • ${(job.actual_container || job.preferred_container).toUpperCase()}`
                    : ""}
                </span>

                {(job.file_size_bytes || job.progress.total_bytes) && (
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    {formatBytes(job.file_size_bytes || job.progress.total_bytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Status Pill */}
            <div className="shrink-0">
              {isCompleted && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                </span>
              )}
              {isDownloading && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{job.status === "merging" ? "Merging" : "Downloading"}</span>
                </span>
              )}
              {isPending && (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  <span>Queue</span>
                </span>
              )}
              {isFailed && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Failed</span>
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancelled</span>
                </span>
              )}
            </div>
          </div>

          {/* Error Message if Failed */}
          {isFailed && job.error_message && (
            <div className="mt-2.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              {job.error_message}
            </div>
          )}

          {/* Progress Bar & Telemetry */}
          {(isDownloading || isCompleted || isPending) && (
            <div className="mt-3 space-y-1">
              <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden relative">
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
              <div className="flex items-center justify-between text-[10.5px] text-slate-400 pt-0.5 font-mono">
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
                  <span className="font-semibold text-white">
                    {Math.round(job.progress.percentage)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.05]">
            <div className="flex items-center space-x-2">
              {/* Completed: Download File */}
              {isCompleted && (
                <a
                  href={getFileDownloadUrl(job.id)}
                  download
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save Video</span>
                </a>
              )}

              {/* Active or Pending: Cancel */}
              {(isDownloading || isPending) && (
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] transition-all cursor-pointer"
                >
                  Cancel
                </button>
              )}

              {/* Failed or Cancelled: Retry */}
              {(isFailed || isCancelled) && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-blue-400 border border-white/[0.08] transition-all cursor-pointer"
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
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Remove"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
