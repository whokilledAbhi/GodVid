"use client";

import React, { useEffect } from "react";
import { X, Layers, Film, Volume2, ShieldCheck } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Source Format & Stream Inspector
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-md">
                {job.title || job.url}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Metadata pill highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Requested Quality</span>
              <span className="font-semibold text-zinc-200">{job.requested_quality}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Actual Result</span>
              <span className="font-semibold text-indigo-300">
                {job.actual_quality || "Pending"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">Container</span>
              <span className="font-semibold text-zinc-200 uppercase">
                {job.actual_container || job.preferred_container}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span className="text-zinc-500 block">File Size</span>
              <span className="font-semibold text-zinc-200 font-mono">
                {formatBytes(job.file_size_bytes)}
              </span>
            </div>
          </div>

          {/* Available Resolutions extracted from source */}
          <div>
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" />
              <span>Available Source Resolutions</span>
            </h4>
            {job.available_resolutions && job.available_resolutions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {job.available_resolutions.map((res) => (
                  <span
                    key={res}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-zinc-950 border border-zinc-800 text-zinc-200"
                  >
                    {res}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">
                Format options will appear after analysis or downloading.
              </p>
            )}
          </div>

          {/* Engine Preservation Note */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/30 text-xs text-indigo-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Original Stream Integrity</span>
            </div>
            <p className="text-zinc-300">
              This engine pairs the highest available video stream with the best uncompressed audio stream, remuxing them directly via FFmpeg without lossy re-encoding or resolution downscaling.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
