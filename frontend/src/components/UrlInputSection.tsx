"use client";

import React, { useState, useMemo } from "react";
import {
  Download,
  Trash2,
  ClipboardPaste,
  Layers,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

interface UrlInputSectionProps {
  onDownload: (urls: string[], quality: string, container: string) => Promise<void>;
  isEnqueuing: boolean;
  selectedQuality: string;
  onQualityChange: (q: string) => void;
  selectedContainer: string;
  onContainerChange: (c: string) => void;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  onDownload,
  isEnqueuing,
  selectedQuality,
  onQualityChange,
  selectedContainer,
  onContainerChange,
}) => {
  const [rawText, setRawText] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);

  // Parse URLs
  const parsedUrls = useMemo(() => {
    if (!rawText.trim()) return [];
    const tokens = rawText.split(/[\r\n,]+|\s{2,}/);
    const seen = new Set<string>();
    const valid: string[] = [];

    for (const token of tokens) {
      const parts = token.trim().split(/\s+/);
      for (const p of parts) {
        const cleaned = p.trim().replace(/[\)\]\>\"\']+$/, "");
        if (!cleaned) continue;
        if (seen.has(cleaned)) continue;
        seen.add(cleaned);

        try {
          const urlObj = new URL(cleaned);
          if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
            valid.push(cleaned);
          }
        } catch {
          // Ignore invalid URL formatting
        }
      }
    }
    return valid;
  }, [rawText]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text.trim());
        toast.success("Pasted from clipboard");
      }
    } catch {
      toast.error("Unable to read clipboard. Please paste manually.");
    }
  };

  const handleClear = () => {
    setRawText("");
  };

  const handleDownloadClick = async () => {
    if (parsedUrls.length === 0) {
      toast.error("Please enter a valid video link");
      return;
    }
    try {
      await onDownload(parsedUrls, selectedQuality, selectedContainer);
      toast.success(
        parsedUrls.length === 1
          ? "Download queued"
          : `Queued ${parsedUrls.length} downloads`
      );
      setRawText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to enqueue downloads");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isBatchMode) {
      e.preventDefault();
      handleDownloadClick();
    }
  };

  return (
    <div className="bg-white/[0.025] backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-5 shadow-2xl transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-tight text-white">
          Add Media
        </h2>

        <button
          type="button"
          onClick={() => setIsBatchMode(!isBatchMode)}
          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all cursor-pointer flex items-center space-x-1.5 backdrop-blur-md ${
            isBatchMode
              ? "bg-blue-600/20 text-blue-400 border-blue-500/40"
              : "bg-white/[0.03] text-slate-400 hover:text-white border-white/[0.06] hover:bg-white/[0.06]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Batch</span>
        </button>
      </div>

      {/* URL Input Box */}
      <div className="relative rounded-xl border border-white/[0.08] bg-black/40 focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/50 backdrop-blur-md transition-all">
        {isBatchMode ? (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Paste video links (one per line)...`}
            rows={4}
            className="w-full bg-transparent px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none resize-y leading-relaxed"
          />
        ) : (
          <div className="flex items-center pr-2">
            <input
              type="url"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste video URL here (e.g. YouTube, Vimeo, direct media link)..."
              className="w-full bg-transparent px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
            {rawText && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                title="Clear input"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="ml-1 flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-blue-400" />
              <span>Paste</span>
            </button>
          </div>
        )}

        {isBatchMode && (
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-white/[0.06] bg-white/[0.02] rounded-b-xl">
            <span className="text-[11px] text-slate-400">
              {parsedUrls.length} valid link{parsedUrls.length === 1 ? "" : "s"}
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-all cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-blue-400" />
                <span>Paste</span>
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-slate-400 hover:text-rose-400 bg-white/[0.04] border border-white/[0.08] rounded-lg transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inline Controls & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-white/[0.06]">
        {/* Quality & Format Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={selectedQuality}
              onChange={(e) => onQualityChange(e.target.value)}
              className="appearance-none bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] focus:border-blue-500/60 rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-200 focus:outline-none transition-all cursor-pointer backdrop-blur-md"
            >
              <option value="best" className="bg-[#0B0F19]">Best Available</option>
              <option value="2160p" className="bg-[#0B0F19]">2160p (4K UHD)</option>
              <option value="1440p" className="bg-[#0B0F19]">1440p (2K QHD)</option>
              <option value="1080p" className="bg-[#0B0F19]">1080p (Full HD)</option>
              <option value="720p" className="bg-[#0B0F19]">720p (HD)</option>
              <option value="480p" className="bg-[#0B0F19]">480p (SD)</option>
              <option value="audio_only" className="bg-[#0B0F19]">Audio Only (MP3)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedContainer}
              onChange={(e) => onContainerChange(e.target.value)}
              className="appearance-none bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] focus:border-blue-500/60 rounded-xl pl-3 pr-8 py-1.5 text-xs font-medium text-slate-200 focus:outline-none transition-all cursor-pointer uppercase backdrop-blur-md"
            >
              <option value="auto" className="bg-[#0B0F19]">Auto</option>
              <option value="mp4" className="bg-[#0B0F19]">MP4</option>
              <option value="mkv" className="bg-[#0B0F19]">MKV</option>
              <option value="webm" className="bg-[#0B0F19]">WebM</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Primary Download Action Button */}
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isEnqueuing || !rawText.trim()}
          className="flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>
            {isEnqueuing
              ? "Queueing..."
              : parsedUrls.length > 1
              ? `Download All (${parsedUrls.length})`
              : "Download Video"}
          </span>
        </button>
      </div>
    </div>
  );
};
