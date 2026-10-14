"use client";

import React from "react";
import { DownloadCloud, Settings, HardDrive, Cpu, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { SystemStatus } from "../lib/types";

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
  const isHealthy = status?.status === "healthy";

  return (
    <header className="border-b border-[#273041] bg-[#121720]/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7185FF] to-[#5569E0] flex items-center justify-center shadow-lg shadow-[#7185FF]/20 text-white shrink-0 border border-[#8294FF]/30">
            <DownloadCloud className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-[#F2F5FA]">
                Batch Video Downloader
              </span>
              <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#7185FF]/15 text-[#8294FF] border border-[#7185FF]/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-[#9AA6B8] hidden sm:block font-normal">
              Original Media Extraction Engine • Zero Lossy Re-encoding
            </p>
          </div>
        </div>

        {/* Status Indicators & Navigation Controls */}
        <div className="flex items-center space-x-3">
          {/* Engine Status Pill */}
          <div
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isLoadingStatus
                ? "bg-[#171D28] text-[#9AA6B8] border-[#273041]"
                : isHealthy
                ? "bg-[#35D49A]/10 text-[#35D49A] border-[#35D49A]/30"
                : "bg-[#FF6B78]/10 text-[#FF6B78] border-[#FF6B78]/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isLoadingStatus
                  ? "bg-[#9AA6B8] animate-pulse"
                  : isHealthy
                  ? "bg-[#35D49A] shadow-sm shadow-[#35D49A]/50 animate-pulse"
                  : "bg-[#FF6B78]"
              }`}
            />
            <span className="font-semibold">
              {isLoadingStatus
                ? "Checking Engine..."
                : isHealthy
                ? "Engine Ready"
                : "Engine Offline"}
            </span>
          </div>

          {/* Storage telemetry pill */}
          {status && (
            <div className="hidden md:flex items-center space-x-1.5 text-xs text-[#9AA6B8] px-3 py-1.5 rounded-lg bg-[#171D28] border border-[#273041]">
              <HardDrive className="w-3.5 h-3.5 text-[#7185FF]" />
              <span className="font-mono text-[#F2F5FA] font-medium">{status.disk_free_gb} GB</span>
              <span>Free</span>
            </div>
          )}

          {/* Refresh / Check button */}
          {onRefreshStatus && (
            <button
              onClick={onRefreshStatus}
              className="p-2 rounded-lg bg-[#171D28] hover:bg-[#1E2534] border border-[#273041] text-[#9AA6B8] hover:text-[#F2F5FA] transition-all cursor-pointer"
              title="Refresh Engine Status"
              aria-label="Refresh Status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingStatus ? "animate-spin" : ""}`} />
            </button>
          )}

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-[#171D28] hover:bg-[#1E2534] border border-[#273041] hover:border-[#3A4760] text-[#9AA6B8] hover:text-[#F2F5FA] transition-all cursor-pointer text-xs font-medium"
            title="System & Worker Configuration"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
