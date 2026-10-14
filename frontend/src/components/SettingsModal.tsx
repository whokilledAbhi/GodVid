"use client";

import React, { useEffect } from "react";
import {
  X,
  Settings,
  HardDrive,
  Cpu,
  CheckCircle2,
  Shield,
  Info,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121720] border border-[#273041] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[#273041] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#7185FF]/15 text-[#8294FF] border border-[#7185FF]/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F2F5FA]">
                System & Engine Settings
              </h3>
              <p className="text-xs text-[#9AA6B8]">
                Media processing engine, workers, and storage configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28] transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Parallel Concurrency Selector */}
          <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-[#F2F5FA] text-sm flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-[#7185FF]" />
                <span>Simultaneous Worker Concurrency</span>
              </label>
              <span className="font-mono text-xs text-[#8294FF] font-semibold">
                Active: {concurrencyLimit}x
              </span>
            </div>
            <p className="text-[#9AA6B8] leading-relaxed">
              Configures how many video jobs download and merge simultaneously. Conservative limits prevent bandwidth starvation and disk I/O bottlenecks.
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-[#7185FF] text-white border-[#8294FF] shadow-md shadow-[#7185FF]/25 font-bold"
                      : "bg-[#0B0D12] text-[#9AA6B8] border-[#273041] hover:text-[#F2F5FA] hover:bg-[#121720]"
                  }`}
                >
                  {num}x {num === 2 ? "(Rec)" : ""}
                </button>
              ))}
            </div>
          </div>

          {/* Core System Dependencies */}
          <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] space-y-3">
            <h4 className="font-semibold text-[#F2F5FA] text-sm flex items-center space-x-2">
              <Shield className="w-4 h-4 text-[#35D49A]" />
              <span>Core Dependencies</span>
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0D12] border border-[#273041]">
                <span className="text-[#9AA6B8]">FFmpeg Multiplexer:</span>
                <span className="flex items-center space-x-1.5 font-mono text-[#35D49A] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{status?.ffmpeg_available ? "Installed & Operational" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0D12] border border-[#273041]">
                <span className="text-[#9AA6B8]">FFprobe Stream Inspector:</span>
                <span className="flex items-center space-x-1.5 font-mono text-[#35D49A] font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{status?.ffprobe_available ? "Installed & Operational" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0D12] border border-[#273041]">
                <span className="text-[#9AA6B8]">Available Disk Storage:</span>
                <span className="font-mono text-[#F2F5FA] flex items-center space-x-1.5 font-semibold">
                  <HardDrive className="w-3.5 h-3.5 text-[#7185FF]" />
                  <span>{status?.disk_free_gb} GB Free</span>
                </span>
              </div>
            </div>
          </div>

          {/* Security & Policies */}
          <div className="p-4 rounded-xl bg-[#171D28] border border-[#273041] space-y-2 text-[#9AA6B8] leading-relaxed">
            <div className="flex items-center space-x-2 font-semibold text-[#F2F5FA] text-xs">
              <Info className="w-4 h-4 text-[#7185FF]" />
              <span>Engine Security Guarantees</span>
            </div>
            <p>
              • <strong>SSRF Defense:</strong> DNS pre-resolution protects against server-side request forgery by blocking private IP ranges, loopback, link-local, and cloud metadata endpoints (`169.254.169.254`).
            </p>
            <p>
              • <strong>Automatic Cleanup:</strong> Partial download fragments and temporary files are automatically pruned after completion or cancellation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#273041] bg-[#0B0D12] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#7185FF] hover:bg-[#8294FF] text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
