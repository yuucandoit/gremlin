'use client';

import { X, ZoomIn } from 'lucide-react';
import { getArtifactUrl } from '../lib/api';

interface ScreenshotViewerProps {
  runId: string;
  screenshotPath: string | null;
  stepNumber: number;
  thought?: string;
  onClose: () => void;
}

export function ScreenshotViewer({
  runId,
  screenshotPath,
  stepNumber,
  thought,
  onClose,
}: ScreenshotViewerProps) {
  if (!screenshotPath) return null;

  const url = getArtifactUrl(runId, screenshotPath);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative max-w-5xl w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-900/60">
          <div>
            <h3 className="font-semibold text-lg text-white">Step {stepNumber} Screenshot</h3>
            {thought && <p className="text-sm text-slate-400 truncate max-w-xl">{thought}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Image Display */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50">
          <img
            src={url}
            alt={`Step ${stepNumber} screenshot`}
            className="rounded-lg shadow-md max-w-full max-h-[70vh] object-contain border border-slate-800"
          />
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-border bg-slate-900/60 flex items-center justify-between text-xs text-slate-400">
          <span>Path: {screenshotPath}</span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-gremlin-400 hover:underline"
          >
            <ZoomIn className="w-4 h-4" /> Open Full Resolution
          </a>
        </div>
      </div>
    </div>
  );
}
