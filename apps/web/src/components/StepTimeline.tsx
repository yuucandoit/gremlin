'use client';

import type { Signal, Step } from '@gremlin/shared';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  MousePointer,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { useState } from 'react';
import { getArtifactUrl } from '../lib/api';
import { ScreenshotViewer } from './ScreenshotViewer';

interface StepTimelineProps {
  runId: string;
  steps: Step[];
  signals?: Signal[];
}

export function StepTimeline({ runId, steps, signals = [] }: StepTimelineProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<{
    path: string;
    stepNumber: number;
    thought?: string;
  } | null>(null);

  const getActionBadge = (action: any) => {
    switch (action.type) {
      case 'double_click':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            DOUBLE CLICK
          </span>
        );
      case 'click':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
            CLICK
          </span>
        );
      case 'type':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            TYPE
          </span>
        );
      case 'navigate':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            NAVIGATE
          </span>
        );
      case 'scroll':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            SCROLL
          </span>
        );
      case 'finish':
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30">
            FINISH
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-700 text-slate-300">
            {String(action.type).toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
      {steps.length === 0 ? (
        <div className="p-8 text-center text-slate-500 bg-card rounded-xl border border-border">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin" />
          <p>Agent is initializing browser session...</p>
        </div>
      ) : (
        steps.map((step) => {
          const stepSignals = signals.filter((s) => s.stepNumber === step.stepNumber);
          const hasError = stepSignals.some(
            (s) =>
              s.type === 'console_error' ||
              s.type === 'unhandled_rejection' ||
              s.type === 'http_5xx'
          );

          return (
            <div key={step.id || step.stepNumber} className="relative group">
              {/* Node dot on timeline */}
              <div
                className={`absolute -left-[27px] top-4 w-4 h-4 rounded-full border-2 transition-transform group-hover:scale-125 ${
                  hasError
                    ? 'bg-rose-500 border-rose-900 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    : 'bg-gremlin-500 border-slate-900'
                }`}
              />

              {/* Step Card */}
              <div
                className={`bg-card border rounded-xl p-4 shadow-md transition-all hover:border-slate-600 ${
                  hasError ? 'border-rose-900/40 bg-rose-950/10' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      Step #{step.stepNumber}
                    </span>
                    {step.actor === 'human' ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 font-mono">
                        <span>👤</span> Human
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-mono">
                        <span>👾</span> AI
                      </span>
                    )}
                    {getActionBadge(step.action)}
                    {'selector' in step.action && (
                      <code className="text-xs text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/50 max-w-xs truncate">
                        {step.action.selector}
                      </code>
                    )}
                    {'text' in step.action && (
                      <span className="text-xs text-amber-300 italic max-w-xs truncate">
                        "{step.action.text}"
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" /> {step.durationMs}ms
                  </span>
                </div>

                {/* Agent Thought */}
                <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 text-xs text-slate-300">
                  <Sparkles className="w-3.5 h-3.5 text-gremlin-400 flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{step.thought}</p>
                </div>

                {/* Attached signals */}
                {stepSignals.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {stepSignals.map((sig) => (
                      <div
                        key={sig.id}
                        className={`text-xs px-2.5 py-1.5 rounded flex items-start gap-2 font-mono ${
                          sig.type === 'console_error' || sig.type === 'unhandled_rejection'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-900/50'
                            : sig.type === 'http_5xx'
                              ? 'bg-orange-950/60 text-orange-300 border border-orange-900/50'
                              : sig.type === 'dead_click'
                                ? 'bg-amber-950/60 text-amber-300 border border-amber-900/50'
                                : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        <span className="truncate">{sig.message}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Screenshot preview button */}
                {step.screenshotPath && (
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() =>
                        setSelectedScreenshot({
                          path: step.screenshotPath!,
                          stepNumber: step.stepNumber,
                          thought: step.thought,
                        })
                      }
                      className="text-xs flex items-center gap-1.5 text-slate-400 hover:text-gremlin-400 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Inspect Step Screenshot
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {step.screenshotPath}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <ScreenshotViewer
          runId={runId}
          screenshotPath={selectedScreenshot.path}
          stepNumber={selectedScreenshot.stepNumber}
          thought={selectedScreenshot.thought}
          onClose={() => setSelectedScreenshot(null)}
        />
      )}
    </div>
  );
}
