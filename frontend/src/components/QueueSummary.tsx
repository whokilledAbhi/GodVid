"use client";

import React from "react";
import { Archive, XCircle, Trash2 } from "lucide-react";
import { QueueSummary as QueueSummaryType } from "../lib/types";
import { getBatchZipDownloadUrl } from "../lib/api";

interface QueueSummaryProps {
  summary: QueueSummaryType;
  filterStatus: string;
  onFilterChange: (status: string) => void;
  onCancelAll: () => void;
  onClearAll: () => void;
}

export const QueueSummary: React.FC<QueueSummaryProps> = ({
  summary,
  filterStatus,
  onFilterChange,
  onCancelAll,
  onClearAll,
}) => {
  if (summary.total === 0) return null;

  const hasActive = summary.active > 0 || summary.pending > 0 || summary.analyzing > 0;
  const hasCompleted = summary.completed > 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 p-1 bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-xl text-xs">
        {[
          { id: "all", label: "All", count: summary.total },
          { id: "active", label: "Active", count: summary.active + summary.pending + summary.analyzing },
          { id: "completed", label: "Completed", count: summary.completed },
          { id: "failed", label: "Issues", count: summary.failed + summary.cancelled },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              filterStatus === tab.id
                ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[10px] opacity-70 font-mono">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Batch Action Buttons */}
      <div className="flex items-center space-x-2">
        {hasCompleted && (
          <a
            href={getBatchZipDownloadUrl()}
            download
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Save All as ZIP ({summary.completed})</span>
          </a>
        )}

        {hasActive && (
          <button
            type="button"
            onClick={onCancelAll}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] transition-all cursor-pointer backdrop-blur-md"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel Active</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all cursor-pointer backdrop-blur-md"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
};
