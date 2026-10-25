"use client";

import React, { useEffect } from "react";
import {
  X,
  Settings,
  HardDrive,
  Cpu,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { SystemStatus } from "../lib/types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SystemStatus | null;
  concurrencyLimit: number;
  onConcurrencyChange: (concurrency: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  status,
  concurrencyLimit,
  onConcurrencyChange,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-[#070A13]/90 backdrop-blur-2xl border border-white/[0.08] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">
              System Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Concurrency Selector */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <label className="font-medium text-white flex items-center space-x-2">
                <Cpu className="w-3.5 h-3.5 text-blue-400" />
                <span>Simultaneous Downloads</span>
              </label>
              <span className="font-mono text-xs text-blue-400 font-semibold">
                {concurrencyLimit} active
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              Limit simultaneous media extraction jobs to balance bandwidth.
            </p>
            <div className="flex gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20"
                      : "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Core System Status */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2.5 backdrop-blur-md">
            <h4 className="font-medium text-white flex items-center space-x-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Core System Status</span>
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/[0.05]">
                <span className="text-slate-400">FFmpeg & FFprobe</span>
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{status?.ffmpeg_available ? "Available" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-white/[0.05]">
                <span className="text-slate-400">Storage Space</span>
                <span className="font-mono text-white flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                  <span>{status?.disk_free_gb} GB Free</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] bg-black/20 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
