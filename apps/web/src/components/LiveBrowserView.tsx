'use client';

import { useEffect, useRef, useState } from 'react';
import {
  API_BASE,
  getArtifactUrl,
  inspectPlaygroundElement,
  sendPlaygroundInput,
  submitPlaygroundGuidance,
} from '../lib/api';
import type { InspectElementResult } from '@gremlin/shared';
import {
  Check,
  Crosshair,
  ExternalLink,
  Globe,
  Keyboard,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  MousePointer,
  Pause,
  Play,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Target,
} from 'lucide-react';

interface LiveBrowserViewProps {
  runId: string;
  targetUrl: string;
  currentUrl?: string;
  isRunning: boolean;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onManualAction?: () => void;
  currentThought?: string;
  latestScreenshotPath?: string | null;
  currentStep?: number;
  maxSteps?: number;
  viewport?: 'desktop' | 'mobile';
}

export function LiveBrowserView({
  runId,
  targetUrl,
  currentUrl,
  isRunning,
  isPaused = false,
  onPause,
  onResume,
  onManualAction,
  currentThought,
  latestScreenshotPath,
  currentStep = 0,
  maxSteps = 20,
  viewport = 'desktop',
}: LiveBrowserViewProps) {
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Playground state
  const [activeTool, setActiveTool] = useState<'interact' | 'inspect'>('interact');
  const [typeInput, setTypeInput] = useState('');
  const [guidanceInput, setGuidanceInput] = useState('');
  const [guidanceSuccess, setGuidanceSuccess] = useState(false);
  const [inspectedElement, setInspectedElement] = useState<InspectElementResult | null>(null);
  const [localRipple, setLocalRipple] = useState<{ x: number; y: number } | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStreamKey(Date.now());
  }, []);

  // Live MJPEG stream URL
  const streamUrl = `${API_BASE}/runs/${runId}/stream${streamKey ? `?t=${streamKey}` : ''}`;

  // Fallback single frame or step screenshot URL
  const fallbackUrl = latestScreenshotPath
    ? getArtifactUrl(runId, latestScreenshotPath)
    : `${API_BASE}/runs/${runId}/stream/frame${streamKey ? `?t=${streamKey}` : ''}`;

  const displayUrl = currentUrl || targetUrl;

  const handleRefreshStream = () => {
    setStreamError(false);
    setStreamKey(Date.now());
  };

  // Handle direct clicks on the live stream during Playground mode
  const handleViewportClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPaused || isActionPending) return;
    const img = imageRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    if (clickX < 0 || clickY < 0 || clickX > rect.width || clickY > rect.height) return;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    if (activeTool === 'inspect') {
      setIsActionPending(true);
      try {
        const inspected = await inspectPlaygroundElement(runId, normX, normY);
        setInspectedElement(inspected);
      } catch (err) {
        console.warn('Inspect element failed:', err);
      } finally {
        setIsActionPending(false);
      }
    } else {
      // Manual interactive click
      setIsActionPending(true);
      setLocalRipple({ x: clickX, y: clickY });
      setTimeout(() => setLocalRipple(null), 600);

      try {
        await sendPlaygroundInput(runId, { type: 'click', x: normX, y: normY });
        onManualAction?.();
      } catch (err) {
        console.warn('Manual click failed:', err);
      } finally {
        setIsActionPending(false);
      }
    }
  };

  // Send keystrokes into currently focused element
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typeInput.trim() || !isPaused || isActionPending) return;

    setIsActionPending(true);
    try {
      await sendPlaygroundInput(runId, { type: 'type', text: typeInput });
      setTypeInput('');
      onManualAction?.();
    } catch (err) {
      console.warn('Manual type failed:', err);
    } finally {
      setIsActionPending(false);
    }
  };

  // Submit steering prompt to Meta Muse Spark
  const handleSendGuidance = async (e?: React.FormEvent, customInstruction?: string) => {
    if (e) e.preventDefault();
    const instruction = customInstruction || guidanceInput;
    if (!instruction.trim()) return;

    try {
      await submitPlaygroundGuidance(runId, instruction, inspectedElement?.selector);
      setGuidanceSuccess(true);
      if (!customInstruction) setGuidanceInput('');
      setTimeout(() => setGuidanceSuccess(false), 3000);
    } catch (err) {
      console.warn('Failed submitting steering guidance:', err);
    }
  };

  const isMobile = viewport === 'mobile';

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

          <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-xs">
            {isMobile ? (
              <Smartphone className="w-3.5 h-3.5 text-gremlin-400" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-gremlin-400" />
            )}
            <span className="font-semibold text-slate-200">
              {isMobile ? 'Mobile Chromium' : 'Chromium'}
            </span>
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

        {/* Right: Playground Pause/Resume, Status Badge & Controls */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume Playground Trigger */}
          {isRunning && !isPaused && onPause && (
            <button
              onClick={onPause}
              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Pause autonomous agent to take manual control"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>Pause & Take Over</span>
            </button>
          )}

          {isPaused && onResume && (
            <button
              onClick={onResume}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition animate-pulse cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.2)]"
              title="Resume autonomous Gremlin exploration"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-300" />
              <span>Resume Gremlin</span>
            </button>
          )}

          {/* Status Badge */}
          {isPaused ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              PLAYGROUND ACTIVE
            </span>
          ) : isRunning ? (
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
            {isMobile ? '390×844' : '1280×800'}
          </span>

          <button
            onClick={handleRefreshStream}
            title="Refresh Stream View"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
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

      {/* Main Screen Area with Interactive Canvas Overlay */}
      <div
        ref={containerRef}
        onClick={handleViewportClick}
        className={`relative w-full aspect-[16/10] bg-black flex items-center justify-center overflow-hidden ${
          isPaused ? (activeTool === 'inspect' ? 'cursor-help' : 'cursor-crosshair') : ''
        }`}
      >
        {/* Stream image */}
        {(isRunning || isPaused) && !streamError ? (
          <img
            ref={imageRef}
            src={streamUrl}
            alt="Chromium Live Stream"
            onError={() => setStreamError(true)}
            className="w-full h-full object-contain select-none"
            suppressHydrationWarning
          />
        ) : fallbackUrl ? (
          <img
            ref={imageRef}
            src={fallbackUrl}
            alt="Chromium Viewport"
            className="w-full h-full object-contain select-none"
            suppressHydrationWarning
          />
        ) : (
          <div className="text-center p-8 space-y-3">
            <div className="w-8 h-8 mx-auto border-2 border-gremlin-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-300">Connecting to Chromium Playwright session...</p>
            <p className="text-xs text-slate-500">Live viewport stream will render automatically.</p>
          </div>
        )}

        {/* Local Click Ripple Feedback when user clicks stream in Playground */}
        {localRipple && (
          <div
            className="absolute pointer-events-none w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/30 -translate-x-1/2 -translate-y-1/2 animate-ping"
            style={{ left: localRipple.x, top: localRipple.y }}
          />
        )}

        {/* Inspected Element Highlight Box Overlay */}
        {isPaused && inspectedElement && (
          <div
            className="absolute border-2 border-cyan-400 bg-cyan-500/15 pointer-events-none rounded shadow-[0_0_15px_rgba(6,182,212,0.4)] z-30 transition-all"
            style={{
              left: `${(inspectedElement.box.x / (isMobile ? 390 : 1280)) * 100}%`,
              top: `${(inspectedElement.box.y / (isMobile ? 844 : 800)) * 100}%`,
              width: `${(inspectedElement.box.width / (isMobile ? 390 : 1280)) * 100}%`,
              height: `${(inspectedElement.box.height / (isMobile ? 844 : 800)) * 100}%`,
            }}
          />
        )}

        {/* Playground Active Top Toolbar Overlay */}
        {isPaused && (
          <div className="absolute top-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 p-2.5 rounded-xl shadow-2xl flex flex-wrap items-center justify-between gap-3 z-40 text-xs">
            {/* Tool Toggles */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTool('interact');
                }}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTool === 'interact'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span>Click & Takeover</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTool('inspect');
                }}
                className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTool === 'inspect'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Inspect Component</span>
              </button>
            </div>

            {/* Quick Type Input Form */}
            <form
              onSubmit={handleSendText}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 flex-1 max-w-xs"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={typeInput}
                  onChange={(e) => setTypeInput(e.target.value)}
                  placeholder="Type into focused field..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!typeInput.trim() || isActionPending}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>

            {/* Quick Steering Input Form */}
            <form
              onSubmit={(e) => handleSendGuidance(e)}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 flex-1 max-w-sm"
            >
              <input
                type="text"
                value={guidanceInput}
                onChange={(e) => setGuidanceInput(e.target.value)}
                placeholder="Instruct Gremlin on what to test next..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none"
              />
              <button
                type="submit"
                disabled={!guidanceInput.trim()}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
              >
                {guidanceSuccess ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                <span>{guidanceSuccess ? 'Sent!' : 'Steer'}</span>
              </button>
            </form>
          </div>
        )}

        {/* Inspected Element Floating Card */}
        {isPaused && inspectedElement && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-16 left-4 right-4 bg-slate-900/95 border border-cyan-500/50 p-3 rounded-xl shadow-2xl flex items-center justify-between gap-4 z-40 text-xs backdrop-blur-md"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-cyan-400 font-mono text-sm">
                  {inspectedElement.selector}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                  &lt;{inspectedElement.tagName}&gt;
                </span>
              </div>
              <p className="text-slate-300 text-[11px] truncate">
                {inspectedElement.text ? `"${inspectedElement.text}"` : 'No text content'}
              </p>
            </div>

            <button
              onClick={() => {
                const prompt = `Focus exploratory chaos testing on element '${inspectedElement.selector}'`;
                handleSendGuidance(undefined, prompt);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 transition flex-shrink-0 cursor-pointer shadow-md"
            >
              <Target className="w-4 h-4" />
              <span>Target with Chaos Gremlin</span>
            </button>
          </div>
        )}

        {/* Floating Action Overlay on bottom */}
        {currentThought && !isPaused && (
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/85 backdrop-blur-md border border-border/80 px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs text-slate-200 pointer-events-none">
            <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1 truncate">
              <span className="font-semibold text-purple-400">🧠 AI Reasoning: </span>
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
