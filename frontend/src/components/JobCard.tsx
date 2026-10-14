"use client";

import React from "react";
import {
  Download,
  RotateCcw,
  XCircle,
  Trash2,
  Clock,
  Gauge,
  Film,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { DownloadJob, JobStatus } from "../lib/types";
import { formatBytes, formatDuration, formatSpeed, formatETA } from "../lib/utils";
import { getFileDownloadUrl } from "../lib/api";

interface JobCardProps {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onInspectFormats?: (job: DownloadJob) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onCancel,
  onRetry,
  onDelete,
  onInspectFormats,
}) => {
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  const isCancelled = job.status === "cancelled";
  const isActive = job.status === "downloading" || job.status === "merging";
  const isAnalyzing = job.status === "analyzing";
  const isPending = job.status === "pending";

  const statusBadge = () => {
    switch (job.status) {
      case "completed":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case "downloading":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Downloading</span>
          </span>
        );
      case "merging":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-3.5 h-3.5 animate-pulse" />
            <span>Merging Streams</span>
          </span>
        );
      case "analyzing":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Inspecting</span>
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-700/30 text-zinc-400 border border-zinc-700/50">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-md">
      <div className="flex flex-col sm:flex-row items-start gap-4">
        {/* Thumbnail or Media Placeholder */}
        <div className="w-full sm:w-44 h-28 sm:h-26 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden relative shrink-0 flex items-center justify-center">
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt={job.title || "Video preview"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-zinc-600 space-y-1">
              <Film className="w-8 h-8" />
              <span className="text-[10px] uppercase font-mono">No Preview</span>
            </div>
          )}

          {/* Duration Badge */}
          {job.duration && (
            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-zinc-200">
              {formatDuration(job.duration)}
            </div>
          )}
        </div>

        {/* Video Info & Progress Body */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <div>
              <h3
                className="text-sm sm:text-base font-semibold text-zinc-100 line-clamp-1"
                title={job.title || job.url}
              >
                {job.title || "Pending Analysis"}
              </h3>

              <div className="flex flex-wrap items-center gap-2 mt-1">
                {/* Source Host */}
                {job.source_host && (
                  <span className="text-xs text-zinc-400 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                    {job.source_host}
                  </span>
                )}

                {/* Quality Indicator */}
                <span className="flex items-center space-x-1 text-xs text-indigo-300 font-medium">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>
                    {job.actual_quality
                      ? `Downloaded: ${job.actual_quality}`
                      : `Requested: ${job.requested_quality}`}
                  </span>
                </span>

                {/* File size */}
                {(job.file_size_bytes || job.progress.total_bytes) && (
                  <span className="text-xs text-zinc-400 font-mono">
                    • {formatBytes(job.file_size_bytes || job.progress.total_bytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="shrink-0">{statusBadge()}</div>
          </div>

          {/* Error Message if Failed */}
          {isFailed && job.error_message && (
            <div className="mt-2.5 p-2.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs text-rose-300 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">Download Failed</p>
                <p className="mt-0.5 text-zinc-300">{job.error_message}</p>
              </div>
            </div>
          )}

          {/* Progress Bar & Telemetry */}
          {(isActive || isCompleted || isAnalyzing) && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium text-zinc-300 truncate max-w-[200px] sm:max-w-xs">
                  {job.progress.current_step || "Processing"}
                </span>
                <span className="font-mono text-zinc-200 font-semibold">
                  {Math.round(job.progress.percentage)}%
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800/80">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-indigo-500 to-violet-500"
                  }`}
                  style={{ width: `${Math.max(job.progress.percentage, isAnalyzing ? 30 : 0)}%` }}
                />
              </div>

              {/* Download Speed & Size Metrics */}
              {isActive && (
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-400 pt-0.5">
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center space-x-1">
                      <Gauge className="w-3 h-3 text-cyan-400" />
                      <span>{formatSpeed(job.progress.speed_bytes_sec)}</span>
                    </span>
                    <span>
                      {formatBytes(job.progress.downloaded_bytes)}
                      {job.progress.total_bytes && ` / ${formatBytes(job.progress.total_bytes)}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {job.progress.eta_seconds !== undefined && job.progress.eta_seconds !== null && (
                      <span>ETA: {formatETA(job.progress.eta_seconds)}</span>
                    )}
                    <span>Elapsed: {formatDuration(job.progress.elapsed_seconds)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center space-x-2">
              {/* Completed: Download File Button */}
              {isCompleted && (
                <a
                  href={getFileDownloadUrl(job.id)}
                  download
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video</span>
                </a>
              )}

              {/* Active or Pending: Cancel Button */}
              {(isActive || isPending || isAnalyzing) && (
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cancel</span>
                </button>
              )}

              {/* Failed or Cancelled: Retry Button */}
              {(isFailed || isCancelled) && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Job</span>
                </button>
              )}

              {/* Format Inspector trigger */}
              {onInspectFormats && (
                <button
                  type="button"
                  onClick={() => onInspectFormats(job)}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Formats</span>
                </button>
              )}
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => onDelete(job.id)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
              title="Remove from queue"
              aria-label="Remove job"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
