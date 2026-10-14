"use client";

import React, { useState } from "react";
import { Sliders, Sparkles, Layers, Cpu, FileText } from "lucide-react";

interface PreferencesBarProps {
  selectedQuality: string;
  onQualityChange: (quality: string) => void;
  selectedContainer: string;
  onContainerChange: (container: string) => void;
  concurrencyLimit: number;
  onConcurrencyChange: (concurrency: number) => void;
  filenameTemplate: string;
  onFilenameTemplateChange: (template: string) => void;
}

export const PreferencesBar: React.FC<PreferencesBarProps> = ({
  selectedQuality,
  onQualityChange,
  selectedContainer,
  onContainerChange,
  concurrencyLimit,
  onConcurrencyChange,
  filenameTemplate,
  onFilenameTemplateChange,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 sm:p-5 mt-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 flex-1">
          {/* Quality Option */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Quality</span>
            </label>
            <select
              value={selectedQuality}
              onChange={(e) => onQualityChange(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="best">Best Available (Preserve Original Stream)</option>
              <option value="2160p">2160p / 4K UHD</option>
              <option value="1440p">1440p QHD</option>
              <option value="1080p">1080p Full HD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p SD</option>
              <option value="audio_only">Audio Only (Highest Bitrate)</option>
            </select>
          </div>

          {/* Container Option */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Packaging Container</span>
            </label>
            <select
              value={selectedContainer}
              onChange={(e) => onContainerChange(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="auto">Auto (Native stream remux - No Transcoding)</option>
              <option value="mp4">MP4 (Universal Compatibility)</option>
              <option value="mkv">MKV (VP9/Opus & Multi-audio support)</option>
              <option value="webm">WebM (Open Media Standard)</option>
            </select>
          </div>

          {/* Concurrency Selector */}
          <div className="flex flex-col space-y-1.5">
            <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Parallel Downloads</span>
            </label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30 font-semibold"
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  {num}x {num === 2 ? "(Default)" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced Toggle */}
        <div className="flex items-end lg:items-center">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{showAdvanced ? "Hide Filename Format" : "Filename Format"}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filename Template */}
      {showAdvanced && (
        <div className="mt-4 pt-3.5 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="text-xs font-medium text-zinc-400 flex items-center space-x-1.5 shrink-0">
            <FileText className="w-3.5 h-3.5 text-zinc-400" />
            <span>Template:</span>
          </label>
          <input
            type="text"
            value={filenameTemplate}
            onChange={(e) => onFilenameTemplateChange(e.target.value)}
            placeholder="{title} [{resolution}].{ext}"
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-[11px] text-zinc-500">
            Variables: <code className="text-zinc-400">{`{title}`}</code>, <code className="text-zinc-400">{`{resolution}`}</code>, <code className="text-zinc-400">{`{ext}`}</code>
          </span>
        </div>
      )}
    </div>
  );
};
