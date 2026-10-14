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
} from "lucide-react";
import { DownloadJob } from "../lib/types";
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

  const renderStatusBadge = () => {
    switch (job.status) {
      case "completed":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#35D49A]/15 text-[#35D49A] border border-[#35D49A]/30">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Completed</span>
          </span>
        );
      case "downloading":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#7185FF]/15 text-[#8294FF] border border-[#7185FF]/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Downloading</span>
          </span>
        );
      case "merging":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#8294FF]/15 text-[#8294FF] border border-[#8294FF]/30">
            <Layers className="w-3.5 h-3.5 animate-pulse" />
            <span>Merging Streams</span>
          </span>
        );
      case "analyzing":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F5BD59]/15 text-[#F5BD59] border border-[#F5BD59]/30">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FF6B78]/15 text-[#FF6B78] border border-[#FF6B78]/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#273041] text-[#9AA6B8] border border-[#3A4760]">
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F5BD59]/15 text-[#F5BD59] border border-[#F5BD59]/30">
            <Clock className="w-3.5 h-3.5" />
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div
      className={`bg-[#121720] border rounded-2xl p-5 transition-all duration-200 shadow-sm ${
        isActive
          ? "border-[#7185FF]/50 shadow-md shadow-[#7185FF]/5"
          : isCompleted
          ? "border-[#273041] hover:border-[#35D49A]/40"
          : isFailed
          ? "border-[#FF6B78]/40"
          : "border-[#273041] hover:border-[#3A4760]"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start gap-5">
        {/* Thumbnail Preview Area */}
        <div className="w-full sm:w-48 h-32 sm:h-28 rounded-xl bg-[#0B0D12] border border-[#273041] overflow-hidden relative shrink-0 flex items-center justify-center">
          {job.thumbnail ? (
            <img
              src={job.thumbnail}
              alt={job.title || "Video preview"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-[#6B778D] space-y-1.5">
              <Film className="w-8 h-8 stroke-[1.5]" />
              <span className="text-[10px] uppercase font-mono tracking-wider">No Preview</span>
            </div>
          )}

          {/* Duration Badge */}
          {job.duration !== undefined && job.duration !== null && (
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#0B0D12]/90 backdrop-blur-sm text-[11px] font-mono text-[#F2F5FA] border border-[#273041]">
              {formatDuration(job.duration)}
            </div>
          )}
        </div>

        {/* Video Metadata & Telemetry Body */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                className="text-base font-semibold text-[#F2F5FA] line-clamp-1 leading-snug"
                title={job.title || job.url}
              >
                {job.title || "Pending Analysis"}
              </h3>

              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {/* Source Host Pill */}
                {job.source_host && (
                  <span className="text-[11px] font-mono text-[#9AA6B8] bg-[#171D28] px-2.5 py-0.5 rounded-md border border-[#273041]">
                    {job.source_host}
                  </span>
                )}

                {/* Quality / Resolution Tag */}
                <span className="flex items-center space-x-1 text-xs text-[#8294FF] font-medium bg-[#7185FF]/10 px-2.5 py-0.5 rounded-md border border-[#7185FF]/20">
                  <Sparkles className="w-3 h-3 text-[#7185FF]" />
                  <span>
                    {job.actual_quality
                      ? `Target: ${job.actual_quality}`
                      : `Quality: ${job.requested_quality}`}
                  </span>
                </span>

                {/* Container Tag */}
                {(job.actual_container || job.preferred_container) && (
                  <span className="text-[11px] font-mono font-semibold uppercase text-[#9AA6B8] bg-[#171D28] px-2 py-0.5 rounded-md border border-[#273041]">
                    {job.actual_container || job.preferred_container}
                  </span>
                )}

                {/* Total File Size */}
                {(job.file_size_bytes || job.progress.total_bytes) && (
                  <span className="text-xs text-[#9AA6B8] font-mono">
                    {formatBytes(job.file_size_bytes || job.progress.total_bytes)}
                  </span>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="shrink-0">{renderStatusBadge()}</div>
          </div>

          {/* Failure Error Banner */}
          {isFailed && job.error_message && (
            <div className="mt-3 p-3 rounded-xl bg-[#FF6B78]/10 border border-[#FF6B78]/30 text-xs text-[#FF6B78] flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-[#FF6B78] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[#F2F5FA]">Processing Error</p>
                <p className="mt-0.5 text-[#FF6B78]/90 leading-relaxed">{job.error_message}</p>
              </div>
            </div>
          )}

          {/* Progress Bar & Real-time Telemetry */}
          {(isActive || isCompleted || isAnalyzing) && (
            <div className="mt-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#9AA6B8]">
                <span className="font-medium text-[#F2F5FA] truncate max-w-xs">
                  {job.progress.current_step || "Processing..."}
                </span>
                <span className="font-mono text-[#F2F5FA] font-bold">
                  {Math.round(job.progress.percentage)}%
                </span>
              </div>

              {/* Progress track */}
              <div className="w-full h-2 rounded-full bg-[#0B0D12] overflow-hidden border border-[#273041] relative">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-[#35D49A]"
                      : job.status === "merging"
                      ? "bg-gradient-to-r from-[#7185FF] to-[#8294FF] animate-pulse"
                      : "bg-gradient-to-r from-[#7185FF] to-[#8294FF]"
                  }`}
                  style={{
                    width: `${Math.max(
                      job.progress.percentage,
                      isAnalyzing ? 25 : 0
                    )}%`,
                  }}
                />
              </div>

              {/* Download Speed & Size Metrics */}
              {isActive && (
                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-[#9AA6B8] pt-1">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1.5 text-[#35D49A]">
                      <Gauge className="w-3.5 h-3.5" />
                      <span>{formatSpeed(job.progress.speed_bytes_sec)}</span>
                    </span>
                    <span>
                      {formatBytes(job.progress.downloaded_bytes)}
                      {job.progress.total_bytes && ` / ${formatBytes(job.progress.total_bytes)}`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {job.progress.eta_seconds !== undefined && job.progress.eta_seconds !== null && (
                      <span>ETA: {formatETA(job.progress.eta_seconds)}</span>
                    )}
                    <span>Elapsed: {formatDuration(job.progress.elapsed_seconds)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3.5 border-t border-[#273041]/70">
            <div className="flex items-center space-x-2">
              {/* Completed: Download File Button */}
              {isCompleted && (
                <a
                  href={getFileDownloadUrl(job.id)}
                  download
                  className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#35D49A] hover:bg-[#35D49A]/90 text-[#0B0D12] shadow-md shadow-[#35D49A]/20 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Download Video</span>
                </a>
              )}

              {/* Active or Pending: Cancel Button */}
              {(isActive || isPending || isAnalyzing) && (
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[#171D28] hover:bg-[#1E2534] text-[#9AA6B8] hover:text-[#FF6B78] border border-[#273041] hover:border-[#FF6B78]/30 transition-colors cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}

              {/* Failed or Cancelled: Retry Button */}
              {(isFailed || isCancelled) && (
                <button
                  type="button"
                  onClick={() => onRetry(job.id)}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#7185FF]/15 hover:bg-[#7185FF]/25 text-[#8294FF] border border-[#7185FF]/35 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry Job</span>
                </button>
              )}

              {/* Inspect Formats Trigger */}
              {onInspectFormats && (
                <button
                  type="button"
                  onClick={() => onInspectFormats(job)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28] transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-[#7185FF]" />
                  <span>Inspect Streams</span>
                </button>
              )}
            </div>

            {/* Remove / Delete Button */}
            <button
              type="button"
              onClick={() => onDelete(job.id)}
              className="p-2 rounded-lg text-[#6B778D] hover:text-[#FF6B78] hover:bg-[#FF6B78]/10 transition-colors cursor-pointer"
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
