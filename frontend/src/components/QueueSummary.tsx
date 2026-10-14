"use client";

import React from "react";
import {
  Archive,
  XCircle,
  Trash2,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { QueueSummary as QueueSummaryType } from "../lib/types";
import { getBatchZipDownloadUrl } from "../lib/api";

interface QueueSummaryProps {
  summary: QueueSummaryType;
  onCancelAll: () => void;
  onClearAll: () => void;
}

export const QueueSummary: React.FC<QueueSummaryProps> = ({
  summary,
  onCancelAll,
  onClearAll,
}) => {
  if (summary.total === 0) return null;

  const hasActive = summary.active > 0 || summary.pending > 0 || summary.analyzing > 0;
  const hasCompleted = summary.completed > 0;

  return (
    <div className="bg-[#121720] border border-[#273041] rounded-2xl p-5 sm:p-6 mb-6 shadow-xl">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Total Jobs */}
        <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#9AA6B8] block uppercase tracking-wider">
              Total Queue
            </span>
            <span className="text-2xl font-bold font-mono text-[#F2F5FA] mt-1 block">
              {summary.total}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#273041]/50 flex items-center justify-center text-[#9AA6B8]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Active Downloads */}
        <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#9AA6B8] block uppercase tracking-wider">
              Active Jobs
            </span>
            <span className="text-2xl font-bold font-mono text-[#7185FF] mt-1 block">
              {summary.active}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#7185FF]/15 flex items-center justify-center text-[#7185FF]">
            <Activity className={`w-4 h-4 ${summary.active > 0 ? "animate-pulse" : ""}`} />
          </div>
        </div>

        {/* Completed Jobs */}
        <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#9AA6B8] block uppercase tracking-wider">
              Completed
            </span>
            <span className="text-2xl font-bold font-mono text-[#35D49A] mt-1 block">
              {summary.completed}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#35D49A]/15 flex items-center justify-center text-[#35D49A]">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        {/* Failed / Issues */}
        <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-[#9AA6B8] block uppercase tracking-wider">
              Issues
            </span>
            <span className="text-2xl font-bold font-mono text-[#FF6B78] mt-1 block">
              {summary.failed + summary.cancelled}
            </span>
          </div>
          <div className="w-9 h-9 rounded-lg bg-[#FF6B78]/15 flex items-center justify-center text-[#FF6B78]">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Overall Batch Progress */}
      <div className="mt-5 pt-4 border-t border-[#273041]">
        <div className="flex items-center justify-between text-xs font-medium text-[#9AA6B8] mb-2">
          <span className="flex items-center space-x-2">
            <span>Overall Batch Progress</span>
            <span className="text-[#6B778D] font-mono">
              ({summary.completed} of {summary.total} finished)
            </span>
          </span>
          <span className="font-mono text-[#F2F5FA] font-bold text-sm">
            {Math.round(summary.overall_percentage)}%
          </span>
        </div>

        <div className="w-full h-2.5 rounded-full bg-[#0B0D12] overflow-hidden border border-[#273041] relative">
          <div
            className="h-full bg-gradient-to-r from-[#7185FF] via-[#8294FF] to-[#35D49A] rounded-full transition-all duration-300"
            style={{ width: `${summary.overall_percentage}%` }}
          />
        </div>
      </div>

      {/* Global Actions Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-[#273041]">
        <div className="text-xs text-[#9AA6B8]">
          <span>Concurrency Limit: </span>
          <strong className="text-[#F2F5FA] font-mono">{summary.concurrency_limit} simultaneous downloads</strong>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download all as ZIP */}
          {hasCompleted && (
            <a
              href={getBatchZipDownloadUrl()}
              download
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#7185FF] hover:bg-[#8294FF] text-white shadow-md shadow-[#7185FF]/20 transition-all cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Download ZIP ({summary.completed} Video{summary.completed === 1 ? "" : "s"})</span>
            </a>
          )}

          {/* Cancel All */}
          {hasActive && (
            <button
              type="button"
              onClick={onCancelAll}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-[#171D28] hover:bg-[#1E2534] text-[#9AA6B8] hover:text-[#FF6B78] border border-[#273041] hover:border-[#FF6B78]/30 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel All Active</span>
            </button>
          )}

          {/* Clear Queue */}
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28] rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Queue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
