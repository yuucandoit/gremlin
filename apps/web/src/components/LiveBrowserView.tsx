'use client';

import { useEffect, useState } from 'react';
import { API_BASE, getArtifactUrl } from '../lib/api';
import {
  ExternalLink,
  Globe,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface LiveBrowserViewProps {
  runId: string;
  targetUrl: string;
  currentUrl?: string;
  isRunning: boolean;
  currentThought?: string;
  latestScreenshotPath?: string | null;
  currentStep?: number;
  maxSteps?: number;
}

export function LiveBrowserView({
  runId,
  targetUrl,
  currentUrl,
  isRunning,
  currentThought,
  latestScreenshotPath,
  currentStep = 0,
  maxSteps = 20,
}: LiveBrowserViewProps) {
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live MJPEG stream URL
  const streamUrl = `${API_BASE}/runs/${runId}/stream?t=${streamKey}`;

  // Fallback single frame or step screenshot URL
  const fallbackUrl = latestScreenshotPath
    ? getArtifactUrl(runId, latestScreenshotPath)
    : `${API_BASE}/runs/${runId}/stream/frame?t=${streamKey}`;

  const displayUrl = currentUrl || targetUrl;

  const handleRefreshStream = () => {
    setStreamError(false);
    setStreamKey(Date.now());
  };

  return (
    <div
      className={`flex flex-col bg-slate-950 border border-border rounded-2xl overflow-hidden shadow-2xl transition-all ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-[0_0_50px_rgba(0,0,0,0.9)]' : 'w-full'
      }`}
    >
      {/* Browser Window Header Bar */}
      <div className="bg-slate-900/90 border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 select-none">
        {/* Left: Window Controls & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block border border-rose-600" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block border border-amber-600" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block border border-emerald-600" />
          </div>

          <div className="hidden sm:flex items-center gap-1 text-slate-400 text-xs">
            <Monitor className="w-3.5 h-3.5 text-gremlin-400" />
            <span className="font-semibold text-slate-200">Chromium Headless</span>
          </div>
        </div>

        {/* Center: Fake URL / Address Bar */}
        <div className="flex-1 max-w-lg mx-auto">
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1 flex items-center gap-2 text-xs font-mono text-slate-300">
            {displayUrl.startsWith('https') ? (
              <Lock className="w-3 h-3 text-emerald-400 flex-shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-sky-400 flex-shrink-0" />
            )}
            <span className="truncate text-[11px] text-slate-300">{displayUrl}</span>
          </div>
        </div>

        {/* Right: Stream Status Badge & Controls */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-slate-800 text-slate-400 border border-slate-700">
              COMPLETED
            </span>
          )}

          <span className="hidden md:inline-block text-[10px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            1280×800
          </span>

          <button
            onClick={handleRefreshStream}
            title="Refresh Stream View"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open URL in New Tab"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main Screen Area */}
      <div className="relative w-full aspect-[16/10] bg-black flex items-center justify-center overflow-hidden">
        {isRunning && !streamError ? (
          /* Live Stream via MJPEG directly from Playwright Chromium */
          <img
            src={streamUrl}
            alt="Chromium Live Stream"
            onError={() => setStreamError(true)}
            className="w-full h-full object-contain select-none"
          />
        ) : fallbackUrl ? (
          /* Fallback or Completed Screenshot */
          <img
            src={fallbackUrl}
            alt="Chromium Viewport"
            className="w-full h-full object-contain select-none"
          />
        ) : (
          /* Placeholder while browser launches */
          <div className="text-center p-8 space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-gremlin-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300">
              Connecting to Chromium Playwright session...
            </p>
            <p className="text-xs text-slate-500">
              Live viewport stream will render automatically as soon as navigation begins.
            </p>
          </div>
        )}

        {/* Floating Action Overlay on bottom */}
        {currentThought && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md border border-border/80 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs text-slate-200">
            <Sparkles className="w-4 h-4 text-gremlin-400 flex-shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-gremlin-400">Agent Thought: </span>
              <span className="text-slate-300">{currentThought}</span>
            </div>
            {currentStep > 0 && (
              <span className="font-mono text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex-shrink-0">
                Step {currentStep}/{maxSteps}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
