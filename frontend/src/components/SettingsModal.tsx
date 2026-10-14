"use client";

import React, { useEffect } from "react";
import {
  X,
  Settings,
  HardDrive,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Info,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                System & Engine Settings
              </h3>
              <p className="text-xs text-zinc-400">
                Media processing engine and worker configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Concurrency Setting */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-zinc-200 flex items-center space-x-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Download Worker Concurrency</span>
              </label>
              <span className="font-mono text-zinc-400">Current: {concurrencyLimit}x</span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Configures how many video jobs can actively download and process simultaneously.
              Higher limits require faster network bandwidth and more disk I/O.
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-indigo-600 text-white border-indigo-500 font-bold"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-850"
                  }`}
                >
                  {num}x
                </button>
              ))}
            </div>
          </div>

          {/* Dependencies Status */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <h4 className="font-semibold text-zinc-200 flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Core Dependencies</span>
            </h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800/80">
                <span className="text-zinc-300">FFmpeg Multiplexer:</span>
                <span className="flex items-center space-x-1 font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{status?.ffmpeg_available ? "Installed & Operational" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800/80">
                <span className="text-zinc-300">FFprobe Stream Inspector:</span>
                <span className="flex items-center space-x-1 font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{status?.ffprobe_available ? "Installed & Operational" : "Missing"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800/80">
                <span className="text-zinc-300">Storage Available:</span>
                <span className="font-mono text-zinc-200 flex items-center space-x-1">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{status?.disk_free_gb} GB</span>
                </span>
              </div>
            </div>
          </div>

          {/* Security & Retention Policies */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2 text-zinc-400 leading-relaxed">
            <div className="flex items-center space-x-1.5 font-semibold text-zinc-300">
              <Info className="w-4 h-4 text-indigo-400" />
              <span>Storage & Security Safeguards</span>
            </div>
            <p>
              • <strong>SSRF Protection:</strong> Internal, private, loopback, and cloud metadata endpoints are strictly blocked.
            </p>
            <p>
              • <strong>Temporary Cleanup:</strong> Temporary download fragments and extracted chunks are cleaned automatically after job completion or cancellation.
            </p>
            <p>
              • <strong>Original Codecs:</strong> Video streams are preserved directly from source servers without lossy transcoding.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
