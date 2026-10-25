"use client";

import React from "react";
import { Settings, RefreshCw, DownloadCloud } from "lucide-react";
import { SystemStatus } from "../lib/types";

// Backward-compatibility export
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
    <header className="border-b border-white/[0.06] bg-[#060911]/70 backdrop-blur-2xl sticky top-0 z-40 transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 overflow-hidden shadow-inner backdrop-blur-md">
            <img src="/logo.svg" alt="GodVid Logo" className="w-6 h-6 select-none" />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            GodVid
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {onRefreshStatus && (
            <button
              type="button"
              onClick={onRefreshStatus}
              className="p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStatus ? "animate-spin" : ""}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 hover:text-white transition-all cursor-pointer text-xs font-medium backdrop-blur-md"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
