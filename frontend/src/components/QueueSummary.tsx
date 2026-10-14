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
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 sm:p-5 mb-6 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Metric Counts */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Total */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs font-medium text-zinc-300">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Total:</span>
            <span className="font-mono font-bold text-white">{summary.total}</span>
          </div>

          {/* Completed */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-950/30 border border-emerald-900/40 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Completed:</span>
            <span className="font-mono font-bold text-emerald-200">{summary.completed}</span>
          </div>

          {/* Active */}
          {summary.active > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-blue-950/30 border border-blue-900/40 text-xs font-medium text-blue-300">
              <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Active:</span>
              <span className="font-mono font-bold text-blue-200">{summary.active}</span>
            </div>
          )}

          {/* Failed */}
          {summary.failed > 0 && (
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-rose-950/30 border border-rose-900/40 text-xs font-medium text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Failed:</span>
              <span className="font-mono font-bold text-rose-200">{summary.failed}</span>
            </div>
          )}
        </div>

        {/* Global Batch Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* ZIP Download */}
          {hasCompleted && (
            <a
              href={getBatchZipDownloadUrl()}
              download
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
            >
              <Archive className="w-4 h-4" />
              <span>Download ZIP ({summary.completed} Files)</span>
            </a>
          )}

          {/* Cancel All */}
          {hasActive && (
            <button
              type="button"
              onClick={onCancelAll}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5 text-zinc-400" />
              <span>Cancel All</span>
            </button>
          )}

          {/* Clear Queue */}
          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Queue</span>
          </button>
        </div>
      </div>

      {/* Overall Batch Progress */}
      {summary.total > 0 && (
        <div className="mt-4 pt-3.5 border-t border-zinc-800/60">
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-1.5 font-medium">
            <span>Overall Batch Progress</span>
            <span className="font-mono text-zinc-200 font-semibold">
              {Math.round(summary.overall_percentage)}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800/80">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${summary.overall_percentage}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
