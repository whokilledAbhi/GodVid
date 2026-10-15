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
      <div className="flex items-center space-x-1 p-1 bg-[#111827] border border-[#1F2937] rounded-lg text-xs">
        {[
          { id: "all", label: "All", count: summary.total },
          { id: "active", label: "Active", count: summary.active + summary.pending + summary.analyzing },
          { id: "completed", label: "Completed", count: summary.completed },
          { id: "failed", label: "Issues", count: summary.failed + summary.cancelled },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
              filterStatus === tab.id
                ? "bg-[#2563EB] text-white font-semibold shadow-sm"
                : "text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1F2937]"
            }`}
          >
            <span>{tab.label}</span>
            <span className="text-[11px] opacity-75 font-mono">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Batch Action Buttons */}
      <div className="flex items-center space-x-2">
        {hasCompleted && (
          <a
            href={getBatchZipDownloadUrl()}
            download
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-sm transition-colors cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>Download All as ZIP ({summary.completed})</span>
          </a>
        )}

        {hasActive && (
          <button
            type="button"
            onClick={onCancelAll}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-[#F87171] hover:bg-red-500/10 border border-[#374151] transition-colors cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Cancel Active</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1F2937] border border-[#374151] transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Queue</span>
        </button>
      </div>
    </div>
  );
};
