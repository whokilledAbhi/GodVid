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
      toast.error("Please enter a valid video URL (e.g., https://www.youtube.com/watch?v=...)");
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
    <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 shadow-sm">
      {/* Top Header & Mode Toggle */}
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-base font-semibold text-[#F9FAFB]">
            Add Downloads
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Supports YouTube, Vimeo, direct MP4/WebM video links, and 1000+ sources.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBatchMode(!isBatchMode)}
          className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer flex items-center space-x-1.5 ${
            isBatchMode
              ? "bg-[#2563EB]/15 text-[#60A5FA] border-[#2563EB]/40"
              : "bg-[#1F2937] text-[#9CA3AF] hover:text-[#F9FAFB] border-[#374151]"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isBatchMode ? "Batch Mode (Active)" : "Batch Mode"}</span>
        </button>
      </div>

      {/* URL Input Box */}
      <div className="relative rounded-lg border border-[#374151] bg-[#0B0F19] focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] transition-colors">
        {isBatchMode ? (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Enter one or multiple video URLs (one per line):
https://www.youtube.com/watch?v=...
https://vimeo.com/...`}
            rows={4}
            className="w-full bg-transparent px-3.5 py-2.5 text-sm font-mono text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none resize-y leading-relaxed"
          />
        ) : (
          <div className="flex items-center pr-2">
            <input
              type="url"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste video URL here (e.g. https://www.youtube.com/watch?v=...)"
              className="w-full bg-transparent px-3.5 py-2.5 text-sm font-mono text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none"
            />
            {rawText && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-[#9CA3AF] hover:text-[#F87171] transition-colors cursor-pointer"
                title="Clear input"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="ml-1 flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#9CA3AF] hover:text-[#F9FAFB] bg-[#1F2937] hover:bg-[#374151] border border-[#374151] rounded-md transition-colors cursor-pointer shrink-0"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#60A5FA]" />
              <span>Paste</span>
            </button>
          </div>
        )}

        {isBatchMode && (
          <div className="flex items-center justify-between px-3.5 py-2 border-t border-[#1F2937] bg-[#111827]/60 rounded-b-lg">
            <span className="text-xs text-[#9CA3AF]">
              {parsedUrls.length} valid URL{parsedUrls.length === 1 ? "" : "s"} detected
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#9CA3AF] hover:text-[#F9FAFB] bg-[#1F2937] hover:bg-[#374151] border border-[#374151] rounded-md transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-[#60A5FA]" />
                <span>Paste</span>
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-[#9CA3AF] hover:text-[#F87171] bg-[#1F2937] border border-[#374151] rounded-md transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inline Preferences & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4 pt-3.5 border-t border-[#1F2937]">
        {/* Quality & Format Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <select
              value={selectedQuality}
              onChange={(e) => onQualityChange(e.target.value)}
              className="appearance-none bg-[#1F2937] hover:bg-[#374151] border border-[#374151] focus:border-[#2563EB] rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-[#F9FAFB] focus:outline-none transition-colors cursor-pointer"
            >
              <option value="best">Quality: Best Available</option>
              <option value="2160p">Quality: 2160p (4K UHD)</option>
              <option value="1440p">Quality: 1440p (2K QHD)</option>
              <option value="1080p">Quality: 1080p (Full HD)</option>
              <option value="720p">Quality: 720p (HD)</option>
              <option value="480p">Quality: 480p (SD)</option>
              <option value="audio_only">Quality: Audio Only (MP3)</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedContainer}
              onChange={(e) => onContainerChange(e.target.value)}
              className="appearance-none bg-[#1F2937] hover:bg-[#374151] border border-[#374151] focus:border-[#2563EB] rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-[#F9FAFB] focus:outline-none transition-colors cursor-pointer uppercase"
            >
              <option value="auto">Format: Auto</option>
              <option value="mp4">Format: MP4</option>
              <option value="mkv">Format: MKV</option>
              <option value="webm">Format: WebM</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Primary Download Action Button */}
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isEnqueuing || !rawText.trim()}
          className="flex items-center justify-center space-x-2 px-6 py-2 rounded-lg text-sm font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
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
