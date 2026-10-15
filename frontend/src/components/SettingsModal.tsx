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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-[#111827] border border-[#1F2937] rounded-xl w-full max-w-lg flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-5 h-5 text-[#60A5FA]" />
            <h3 className="text-sm font-semibold text-[#F9FAFB]">
              System Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#1F2937] transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* Concurrency Selector */}
          <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-medium text-[#F9FAFB] flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-[#60A5FA]" />
                <span>Simultaneous Downloads</span>
              </label>
              <span className="font-mono text-xs text-[#60A5FA] font-semibold">
                {concurrencyLimit} active
              </span>
            </div>
            <p className="text-[#9CA3AF] leading-relaxed">
              Limit simultaneous downloads to protect bandwidth and prevent rate limiting.
            </p>
            <div className="flex gap-2 pt-1">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-[#1F2937] text-[#9CA3AF] border-[#374151] hover:text-[#F9FAFB] hover:bg-[#374151]"
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Dependencies Status */}
          <div className="p-3.5 rounded-lg bg-[#0B0F19] border border-[#1F2937] space-y-2.5">
            <h4 className="font-medium text-[#F9FAFB] flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Core System Status</span>
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between p-2 rounded bg-[#111827] border border-[#1F2937]">
                <span className="text-[#9CA3AF]">FFmpeg & FFprobe</span>
                <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{status?.ffmpeg_available ? "Available" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-[#111827] border border-[#1F2937]">
                <span className="text-[#9CA3AF]">Storage Space</span>
                <span className="font-mono text-[#F9FAFB] flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-[#60A5FA]" />
                  <span>{status?.disk_free_gb} GB Free</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#1F2937] bg-[#0B0F19] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
