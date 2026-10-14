"use client";

import React from "react";
import { DownloadCloud, Settings, HardDrive, CheckCircle2, AlertTriangle } from "lucide-react";
import { SystemStatus } from "../lib/types";

interface HeaderProps {
  status: SystemStatus | null;
  onOpenSettings: () => void;
  isLoadingStatus: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenSettings,
  isLoadingStatus,
}) => {
  const isHealthy = status?.status === "healthy";

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <DownloadCloud className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
                Batch Video Downloader
              </h1>
              <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                v1.0
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Preserve original source quality • Zero lossy re-encoding
            </p>
          </div>
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center space-x-3">
          {/* Health Pill */}
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isHealthy
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                : "bg-rose-950/40 text-rose-400 border-rose-800/40"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isHealthy
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-rose-500"
              }`}
            />
            <span>
              {isLoadingStatus
                ? "Checking..."
                : isHealthy
                ? "Engine Ready"
                : "Engine Offline"}
            </span>
          </div>

          {/* Disk space badge */}
          {status && (
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-zinc-400 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
              <span>{status.disk_free_gb} GB Free</span>
            </div>
          )}

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="System & Engine Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
