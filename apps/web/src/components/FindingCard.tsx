'use client';

import type { Finding } from '@gremlin/shared';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Info, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

interface FindingCardProps {
  finding: Finding;
}

export function FindingCard({ finding }: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          card: 'border-rose-900/50 hover:border-rose-700/60',
          icon: <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0" />,
        };
      case 'HIGH':
        return {
          badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
          card: 'border-orange-900/50 hover:border-orange-700/60',
          icon: <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0" />,
        };
      case 'MEDIUM':
        return {
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          card: 'border-amber-900/50 hover:border-amber-700/60',
          icon: <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
        };
      default:
        return {
          badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
          card: 'border-blue-900/50 hover:border-blue-700/60',
          icon: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
        };
    }
  };

  const style = getSeverityStyle(finding.severity);

  return (
    <div
      className={`bg-card border rounded-xl p-5 transition-all shadow-lg ${style.card}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {style.icon}
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${style.badge}`}
              >
                {finding.severity}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700">
                {finding.category.toUpperCase()}
              </span>
              <span className="text-xs text-slate-400">
                First detected at step {finding.firstDetectedStep}
              </span>
            </div>
            <h4 className="font-semibold text-base text-slate-100">{finding.title}</h4>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition flex-shrink-0"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <p className="mt-3 text-sm text-slate-300 leading-relaxed">{finding.description}</p>

      {/* Suggested fix callout */}
      <div className="mt-4 p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start gap-2.5 text-xs text-slate-300">
        <CheckCircle2 className="w-4 h-4 text-gremlin-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-gremlin-400">Suggested Fix: </span>
          <span>{finding.suggestedFix}</span>
        </div>
      </div>

      {/* Expandable reproduction steps */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-800">
          <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Reproduction Steps
          </h5>
          <ol className="space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            {finding.reproductionSteps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>

          {finding.evidence && Object.keys(finding.evidence).length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Telemetry Evidence
              </h5>
              <pre className="text-xs text-slate-400 font-mono bg-slate-950/80 p-2.5 rounded border border-slate-800/80 overflow-x-auto">
                {JSON.stringify(finding.evidence, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
