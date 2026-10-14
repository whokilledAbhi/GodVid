"use client";

import React, { useEffect } from "react";
import { X, Layers, Film, ShieldCheck } from "lucide-react";
import { DownloadJob } from "../lib/types";
import { formatBytes } from "../lib/utils";

interface FormatModalProps {
  job: DownloadJob | null;
  onClose: () => void;
}

export const FormatModal: React.FC<FormatModalProps> = ({ job, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121720] border border-[#273041] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-[#273041] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#7185FF]/15 text-[#8294FF] border border-[#7185FF]/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F2F5FA]">
                Source Format & Stream Inspector
              </h3>
              <p className="text-xs text-[#9AA6B8] truncate max-w-md font-mono mt-0.5">
                {job.title || job.url}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#171D28] border border-[#273041]">
              <span className="text-[#9AA6B8] block text-[11px] font-semibold uppercase tracking-wider">
                Requested
              </span>
              <span className="font-semibold text-[#F2F5FA] mt-1 block">
                {job.requested_quality}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#171D28] border border-[#273041]">
              <span className="text-[#9AA6B8] block text-[11px] font-semibold uppercase tracking-wider">
                Actual Stream
              </span>
              <span className="font-semibold text-[#8294FF] mt-1 block">
                {job.actual_quality || "Pending"}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#171D28] border border-[#273041]">
              <span className="text-[#9AA6B8] block text-[11px] font-semibold uppercase tracking-wider">
                Container
              </span>
              <span className="font-semibold text-[#F2F5FA] uppercase mt-1 block font-mono">
                {job.actual_container || job.preferred_container}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#171D28] border border-[#273041]">
              <span className="text-[#9AA6B8] block text-[11px] font-semibold uppercase tracking-wider">
                File Size
              </span>
              <span className="font-semibold text-[#F2F5FA] font-mono mt-1 block">
                {formatBytes(job.file_size_bytes)}
              </span>
            </div>
          </div>

          {/* Available Source Resolutions */}
          <div>
            <h4 className="text-xs font-semibold text-[#F2F5FA] uppercase tracking-wider mb-2.5 flex items-center space-x-2">
              <Film className="w-4 h-4 text-[#7185FF]" />
              <span>Available Source Resolutions</span>
            </h4>
            {job.available_resolutions && job.available_resolutions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {job.available_resolutions.map((res) => (
                  <span
                    key={res}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-[#171D28] border border-[#273041] text-[#F2F5FA]"
                  >
                    {res}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#9AA6B8] italic">
                Resolution format list is populated after extraction or completion.
              </p>
            )}
          </div>

          {/* Original Stream Integrity Notice */}
          <div className="p-4 rounded-xl bg-[#7185FF]/10 border border-[#7185FF]/25 text-xs text-[#8294FF] space-y-1.5">
            <div className="flex items-center space-x-2 font-semibold text-[#F2F5FA]">
              <ShieldCheck className="w-4 h-4 text-[#7185FF]" />
              <span>Stream Remuxing Guarantee</span>
            </div>
            <p className="text-[#9AA6B8] leading-relaxed">
              This engine pairs the highest available video stream with the best uncompressed audio stream, remuxing them directly via FFmpeg without lossy re-encoding or resolution downscaling.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#273041] bg-[#0B0D12] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-[#171D28] hover:bg-[#1E2534] text-[#F2F5FA] border border-[#273041] hover:border-[#3A4760] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
