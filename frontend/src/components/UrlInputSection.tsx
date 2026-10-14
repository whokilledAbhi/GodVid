"use client";

import React, { useState, useMemo } from "react";
import {
  Link2,
  Search,
  Download,
  Trash2,
  ClipboardPaste,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

interface UrlInputSectionProps {
  onAnalyze: (rawUrls: string) => Promise<void>;
  onDownloadAll: (urls: string[]) => Promise<void>;
  isAnalyzing: boolean;
  isEnqueuing: boolean;
}

export const UrlInputSection: React.FC<UrlInputSectionProps> = ({
  onAnalyze,
  onDownloadAll,
  isAnalyzing,
  isEnqueuing,
}) => {
  const [rawText, setRawText] = useState("");
  const [serverErrors, setServerErrors] = useState<{ url: string; error: string }[]>([]);

  // Parse and preview URLs in real time
  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) {
      return { valid: [], invalid: [], totalCount: 0 };
    }

    const tokens = rawText.split(/[\r\n,]+|\s{2,}/);
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: { url: string; error: string }[] = [];
    let count = 0;

    for (const token of tokens) {
      const parts = token.trim().split(/\s+/);
      for (const p of parts) {
        const cleaned = p.trim().replace(/[\)\]\>\"\']+$/, "");
        if (!cleaned) continue;
        count++;

        if (seen.has(cleaned)) continue;
        seen.add(cleaned);

        try {
          const urlObj = new URL(cleaned);
          if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
            valid.push(cleaned);
          } else {
            invalid.push({
              url: cleaned,
              error: `Unsupported scheme '${urlObj.protocol}'. Only http:// and https:// are permitted.`,
            });
          }
        } catch {
          invalid.push({
            url: cleaned,
            error: "Malformed URL syntax.",
          });
        }
      }
    }

    return { valid, invalid, totalCount: count };
  }, [rawText]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev ? `${prev}\n${text}` : text));
        toast.success("URLs pasted from clipboard");
      }
    } catch {
      toast.error("Clipboard access denied. Please paste directly using Ctrl+V / Cmd+V.");
    }
  };

  const handleClear = () => {
    setRawText("");
    setServerErrors([]);
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    const lines = rawText.split("\n");
    const filtered = lines.filter((line) => !line.includes(urlToRemove));
    setRawText(filtered.join("\n"));
  };

  const handleAnalyzeClick = async () => {
    if (!rawText.trim()) return;
    setServerErrors([]);
    try {
      await onAnalyze(rawText);
      toast.success("Source analysis completed");
    } catch (err: any) {
      const msg = err.message || "Failed to analyze URLs";
      setServerErrors([{ url: "Batch Analysis", error: msg }]);
      toast.error(msg);
    }
  };

  const handleDownloadAllClick = async () => {
    if (parsedPreview.valid.length === 0) return;
    setServerErrors([]);
    try {
      await onDownloadAll(parsedPreview.valid);
      toast.success(`Queued ${parsedPreview.valid.length} video(s) for download`);
      setRawText("");
    } catch (err: any) {
      const msg = err.message || "Failed to enqueue downloads";
      setServerErrors([{ url: "Batch Download", error: msg }]);
      toast.error(msg);
    }
  };

  return (
    <div className="bg-[#121720] border border-[#273041] rounded-2xl p-6 sm:p-7 shadow-xl">
      {/* Title & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F2F5FA] flex items-center space-x-3">
            <span>Download videos in batches</span>
          </h2>
          <p className="text-sm text-[#9AA6B8] mt-1.5 leading-relaxed max-w-2xl">
            Inspect source media streams, preserve original quality without lossy re-encoding, and queue multiple video URLs (YouTube, Vimeo, direct MP4/MKV files).
          </p>
        </div>

        {/* Real-time counters */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {parsedPreview.valid.length > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#35D49A]/10 text-[#35D49A] border border-[#35D49A]/25">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{parsedPreview.valid.length} Valid URL{parsedPreview.valid.length === 1 ? "" : "s"}</span>
            </div>
          )}

          {parsedPreview.invalid.length > 0 && (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#FF6B78]/10 text-[#FF6B78] border border-[#FF6B78]/25">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{parsedPreview.invalid.length} Invalid</span>
            </div>
          )}
        </div>
      </div>

      {/* Large Input Area */}
      <div className="relative rounded-xl border border-[#273041] bg-[#0B0D12] focus-within:border-[#7185FF] focus-within:ring-2 focus-within:ring-[#7185FF]/20 transition-all">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Paste video page URLs or direct media links separated by newlines, commas, or spaces:\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\nhttps://vimeo.com/76979871\nhttps://example.com/videos/media_master_1080p.mp4`}
          rows={6}
          className="w-full bg-transparent px-4 py-3.5 text-sm font-mono text-[#F2F5FA] placeholder-[#6B778D] focus:outline-none resize-y leading-relaxed"
        />

        {/* Quick Toolbar (Paste / Clear) */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#273041]/70 bg-[#121720]/60 rounded-b-xl">
          <div className="flex items-center space-x-2 text-xs text-[#9AA6B8]">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#6B778D]" />
            <span className="hidden sm:inline">Spreadsheet rows, newline lists, and comma-separated URLs are supported</span>
            <span className="sm:hidden">Max 50 URLs per batch</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-[#9AA6B8] hover:text-[#F2F5FA] bg-[#171D28] hover:bg-[#1E2534] border border-[#273041] rounded-md transition-colors cursor-pointer"
              title="Paste from clipboard"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-[#7185FF]" />
              <span>Paste</span>
            </button>

            {rawText && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium text-[#9AA6B8] hover:text-[#FF6B78] bg-[#171D28] hover:bg-[#FF6B78]/10 border border-[#273041] hover:border-[#FF6B78]/30 rounded-md transition-colors cursor-pointer"
                title="Clear all text"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation Feedback Callouts */}
      {(parsedPreview.invalid.length > 0 || serverErrors.length > 0) && (
        <div className="mt-3.5 space-y-2">
          {parsedPreview.invalid.map((inv, idx) => (
            <div
              key={`inv-${idx}`}
              className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-lg bg-[#FF6B78]/10 border border-[#FF6B78]/25 text-[#FF6B78]"
            >
              <div className="flex items-center space-x-2 truncate mr-3">
                <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B78]" />
                <span className="font-mono text-[#F2F5FA] truncate max-w-xs sm:max-w-md">
                  {inv.url}
                </span>
                <span className="text-[#FF6B78]/90 font-medium">— {inv.error}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveUrl(inv.url)}
                className="text-xs text-[#9AA6B8] hover:text-[#FF6B78] underline cursor-pointer shrink-0"
              >
                Remove
              </button>
            </div>
          ))}

          {serverErrors.map((err, idx) => (
            <div
              key={`serr-${idx}`}
              className="flex items-center text-xs px-3.5 py-2.5 rounded-lg bg-[#FF6B78]/10 border border-[#FF6B78]/25 text-[#FF6B78] space-x-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-[#FF6B78]" />
              <span className="font-semibold">{err.url}:</span>
              <span>{err.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 mt-5 pt-4 border-t border-[#273041]">
        <div className="text-xs text-[#9AA6B8] flex items-center space-x-2">
          <Layers className="w-3.5 h-3.5 text-[#7185FF]" />
          <span>Configurable max batch size: <strong>50 URLs</strong></span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Analyze URLs Action */}
          <button
            type="button"
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing || !rawText.trim()}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#171D28] hover:bg-[#1E2534] disabled:opacity-40 disabled:cursor-not-allowed text-[#F2F5FA] border border-[#273041] hover:border-[#3A4760] transition-all cursor-pointer shadow-sm"
          >
            <Search className={`w-4 h-4 text-[#7185FF] ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? "Inspecting Sources..." : "Analyze URLs"}</span>
          </button>

          {/* Download All Primary Action */}
          <button
            type="button"
            onClick={handleDownloadAllClick}
            disabled={isEnqueuing || parsedPreview.valid.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-[#7185FF] hover:bg-[#8294FF] disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-[#7185FF]/25 hover:shadow-[#7185FF]/35 transition-all cursor-pointer"
          >
            <Download className={`w-4 h-4 ${isEnqueuing ? "animate-bounce" : ""}`} />
            <span>
              {isEnqueuing
                ? "Enqueueing..."
                : `Download All (${parsedPreview.valid.length})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
