"use client";

import React from "react";
import { Settings, HardDrive, RefreshCw, DownloadCloud } from "lucide-react";
import { SystemStatus } from "../lib/types";

// Backward-compatibility export for stale client bundles
export { DownloadCloud };

interface HeaderProps {
  status: SystemStatus | null;
  onOpenSettings: () => void;
  isLoadingStatus: boolean;
  onRefreshStatus?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onOpenSettings,
  isLoadingStatus,
  onRefreshStatus,
}) => {
  return (
    <header className="border-b border-[#1E293B] bg-[#0A0F1D]/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Unified Brand Logo & Title: GodVid */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[#0A192F] border border-[#1E293B] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            <img src="/logo.svg" alt="GodVid Logo" className="w-7 h-7 select-none" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-lg font-bold tracking-tight text-[#F9FAFB]">
              GodVid
            </span>
            <span className="hidden sm:inline text-xs text-[#64748B] font-medium tracking-normal">
              Engine
            </span>
          </div>
        </div>

        {/* Controls & Extreme-Right Developer Version Badge */}
        <div className="flex items-center space-x-2.5">
          {/* Refresh Status Button */}
          {onRefreshStatus && (
            <button
              type="button"
              onClick={onRefreshStatus}
              className="p-2 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-[#F9FAFB] transition-colors cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#111827] hover:bg-[#1E293B] border border-[#1E293B] text-[#94A3B8] hover:text-[#F9FAFB] transition-colors cursor-pointer text-xs font-medium"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Version Badge on Extreme Right (Clean Developer Standard) */}
          <div className="ml-1 pl-2.5 border-l border-[#1E293B]">
            <span className="font-mono text-[11px] font-medium text-[#94A3B8] bg-[#0A192F] border border-[#1E293B] px-2.5 py-1 rounded select-none tracking-wide">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
