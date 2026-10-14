"use client";

import React, { useState } from "react";
import { Sparkles, Layers, Cpu, Sliders, FileText, ChevronDown } from "lucide-react";

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
    <div className="bg-[#121720] border border-[#273041] rounded-2xl p-5 sm:p-6 mt-6 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Settings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          {/* Quality Selector */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-[#9AA6B8] flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-[#F5BD59]" />
              <span>Target Quality</span>
            </label>
            <div className="relative">
              <select
                value={selectedQuality}
                onChange={(e) => onQualityChange(e.target.value)}
                className="w-full appearance-none bg-[#171D28] hover:bg-[#1E2534] border border-[#273041] hover:border-[#3A4760] focus:border-[#7185FF] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#F2F5FA] focus:outline-none transition-all cursor-pointer pr-9"
              >
                <option value="best">Best Available (Preserve Original Stream)</option>
                <option value="2160p">2160p / 4K UHD</option>
                <option value="1440p">1440p QHD</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
                <option value="480p">480p SD</option>
                <option value="audio_only">Audio Only (Highest Bitrate)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#9AA6B8] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Container Selector */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-[#9AA6B8] flex items-center space-x-2">
              <Layers className="w-3.5 h-3.5 text-[#7185FF]" />
              <span>Container Packaging</span>
            </label>
            <div className="relative">
              <select
                value={selectedContainer}
                onChange={(e) => onContainerChange(e.target.value)}
                className="w-full appearance-none bg-[#171D28] hover:bg-[#1E2534] border border-[#273041] hover:border-[#3A4760] focus:border-[#7185FF] rounded-xl px-3.5 py-2.5 text-xs font-medium text-[#F2F5FA] focus:outline-none transition-all cursor-pointer pr-9"
              >
                <option value="auto">Auto (Remux Native Streams — No Transcoding)</option>
                <option value="mp4">MP4 (Universal Device Compatibility)</option>
                <option value="mkv">MKV (VP9, AV1, Opus & Multi-track)</option>
                <option value="webm">WebM (Open Web Format)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-[#9AA6B8] absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Parallel Downloads Segmented Pill */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-semibold text-[#9AA6B8] flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-[#35D49A]" />
              <span>Parallel Downloads</span>
            </label>
            <div className="flex items-center space-x-1.5 p-1 bg-[#0B0D12] border border-[#273041] rounded-xl">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onConcurrencyChange(num)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    concurrencyLimit === num
                      ? "bg-[#7185FF] text-white shadow-md shadow-[#7185FF]/25 font-bold"
                      : "text-[#9AA6B8] hover:text-[#F2F5FA] hover:bg-[#171D28]"
                  }`}
                >
                  {num}x {num === 2 ? "(Default)" : ""}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filename Format Trigger */}
        <div className="flex items-end lg:items-center">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#273041] hover:border-[#3A4760] bg-[#171D28] hover:bg-[#1E2534] text-xs font-medium text-[#9AA6B8] hover:text-[#F2F5FA] transition-all cursor-pointer w-full sm:w-auto justify-center"
          >
            <Sliders className="w-3.5 h-3.5 text-[#7185FF]" />
            <span>{showAdvanced ? "Hide Filename Format" : "Filename Format"}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filename Template Expansion */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-[#273041] flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in duration-200">
          <label className="text-xs font-semibold text-[#9AA6B8] flex items-center space-x-2 shrink-0">
            <FileText className="w-3.5 h-3.5 text-[#7185FF]" />
            <span>Output Pattern:</span>
          </label>
          <input
            type="text"
            value={filenameTemplate}
            onChange={(e) => onFilenameTemplateChange(e.target.value)}
            placeholder="{title} [{resolution}].{ext}"
            className="flex-1 bg-[#0B0D12] border border-[#273041] focus:border-[#7185FF] rounded-lg px-3.5 py-2 text-xs font-mono text-[#F2F5FA] focus:outline-none"
          />
          <div className="flex flex-wrap gap-1 text-[11px] text-[#6B778D]">
            <span>Tags:</span>
            <span className="font-mono text-[#9AA6B8] bg-[#171D28] px-1.5 py-0.5 rounded border border-[#273041]">{`{title}`}</span>
            <span className="font-mono text-[#9AA6B8] bg-[#171D28] px-1.5 py-0.5 rounded border border-[#273041]">{`{resolution}`}</span>
            <span className="font-mono text-[#9AA6B8] bg-[#171D28] px-1.5 py-0.5 rounded border border-[#273041]">{`{ext}`}</span>
          </div>
        </div>
      )}
    </div>
  );
};
