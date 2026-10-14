"use client";

import React, { useState, useMemo } from "react";
import {
  Link2,
  Search,
  Download,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";

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
  const [validationErrors, setValidationErrors] = useState<
    { url: string; error: string }[]
  >([]);

  // Real-time client-side URL parsing & deduplication preview
  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) {
      return { valid: [], invalid: [], totalTokens: 0 };
    }

    const tokens = rawText.split(/[\r\n,]+|\s{2,}/);
    const seen = new Set<string>();
    const valid: string[] = [];
    const invalid: { url: string; error: string }[] = [];
    let total = 0;

    for (const token of tokens) {
      const parts = token.trim().split(/\s+/);
      for (const p of parts) {
        const cleaned = p.trim().replace(/[\)\]\>\"\']+$/, "");
        if (!cleaned) continue;
        total++;

        if (seen.has(cleaned)) continue;
        seen.add(cleaned);

        // Simple client-side protocol check
        try {
          const urlObj = new URL(cleaned);
          if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
            valid.push(cleaned);
          } else {
            invalid.push({
              url: cleaned,
              error: `Invalid scheme '${urlObj.protocol}'. Only http:// and https:// are permitted.`,
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

    return { valid, invalid, totalTokens: total };
  }, [rawText]);

  const handleClear = () => {
    setRawText("");
    setValidationErrors([]);
  };

  const handleAnalyzeClick = async () => {
    if (!rawText.trim()) return;
    setValidationErrors([]);
    try {
      await onAnalyze(rawText);
    } catch (err: any) {
      setValidationErrors([{ url: "Batch", error: err.message || "Failed to analyze URLs" }]);
    }
  };

  const handleDownloadAllClick = async () => {
    if (parsedPreview.valid.length === 0) return;
    setValidationErrors([]);
    try {
      await onDownloadAll(parsedPreview.valid);
      // Clear input on successful enqueue
      setRawText("");
    } catch (err: any) {
      setValidationErrors([{ url: "Batch", error: err.message || "Failed to enqueue downloads" }]);
    }
  };

  const handleRemoveInvalid = (urlToRemove: string) => {
    // Remove the invalid URL from the raw text
    const lines = rawText.split("\n");
    const filtered = lines.filter((line) => !line.includes(urlToRemove));
    setRawText(filtered.join("\n"));
  };

  return (
    <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center space-x-2">
            <Link2 className="w-5 h-5 text-indigo-400" />
            <span>Download videos in batches</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Paste one or multiple video URLs (YouTube, Vimeo, direct MP4/MKV, etc.) separated by newlines or commas.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {parsedPreview.valid.length > 0 && (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{parsedPreview.valid.length} Valid URL{parsedPreview.valid.length === 1 ? "" : "s"}</span>
            </span>
          )}
          {parsedPreview.invalid.length > 0 && (
            <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span>{parsedPreview.invalid.length} Invalid</span>
            </span>
          )}
        </div>
      </div>

      {/* Textarea Input */}
      <div className="relative">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`https://www.youtube.com/watch?v=...\nhttps://vimeo.com/...\nhttps://example.com/stream.mp4\n(Paste spreadsheet rows or newline-separated links)`}
          rows={5}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono resize-y"
        />

        {rawText && (
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 text-xs text-zinc-400 hover:text-zinc-200 p-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg border border-zinc-700/60 transition-colors flex items-center space-x-1"
            title="Clear all URLs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Validation Errors Display */}
      {(parsedPreview.invalid.length > 0 || validationErrors.length > 0) && (
        <div className="mt-3 space-y-1.5">
          {parsedPreview.invalid.map((inv, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-900/40 text-rose-300"
            >
              <div className="flex items-center space-x-2 truncate mr-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-mono text-zinc-300 truncate max-w-[200px] sm:max-w-xs">
                  {inv.url}
                </span>
                <span className="text-rose-400">— {inv.error}</span>
              </div>
              <button
                onClick={() => handleRemoveInvalid(inv.url)}
                className="text-xs text-zinc-400 hover:text-rose-300 transition-colors shrink-0"
              >
                Remove
              </button>
            </div>
          ))}

          {validationErrors.map((err, idx) => (
            <div
              key={`err-${idx}`}
              className="flex items-center text-xs px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 space-x-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{err.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-4 pt-3 border-t border-zinc-800/80">
        <div className="text-xs text-zinc-500 flex items-center space-x-2">
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Max 50 URLs per batch • Duplicate links are auto-merged</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleAnalyzeClick}
            disabled={isAnalyzing || !rawText.trim()}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 border border-zinc-700/60 transition-all cursor-pointer"
          >
            <Search className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
            <span>{isAnalyzing ? "Inspecting Sources..." : "Analyze URLs"}</span>
          </button>

          <button
            onClick={handleDownloadAllClick}
            disabled={isEnqueuing || parsedPreview.valid.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer font-semibold"
          >
            <Download className={`w-4 h-4 ${isEnqueuing ? "animate-bounce" : ""}`} />
            <span>{isEnqueuing ? "Enqueueing..." : `Download All (${parsedPreview.valid.length})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
