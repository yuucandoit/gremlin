'use client';

import { use, useEffect, useState } from 'react';
import { cancelRun, getRun, getRunReport } from '../../../lib/api';
import { useRunEvents } from '../../../lib/useRunEvents';
import { StepTimeline } from '../../../components/StepTimeline';
import { FindingCard } from '../../../components/FindingCard';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Flame,
  Radio,
  RefreshCw,
  ShieldAlert,
  Terminal,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const runId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<'timeline' | 'findings' | 'signals' | 'spec'>(
    'timeline'
  );
  const [initialData, setInitialData] = useState<any>(null);
  const [specCode, setSpecCode] = useState<string>('');
  const [copiedSpec, setCopiedSpec] = useState(false);

  // Subscribe to live SSE events
  const liveState = useRunEvents(runId, initialData?.run);

  const fetchFullReport = async () => {
    try {
      const data = await getRun(runId);
      setInitialData(data);
      if (data.run.status === 'completed') {
        const report = await getRunReport(runId);
        setSpecCode(report.regressionSpec);
      }
    } catch (err) {
      console.error('Failed fetching run data:', err);
    }
  };

  useEffect(() => {
    fetchFullReport();
  }, [runId]);

  // Sync regression spec when completed
  useEffect(() => {
    if (liveState.run?.status === 'completed' && !specCode) {
      getRunReport(runId).then((r) => setSpecCode(r.regressionSpec)).catch(() => {});
    }
  }, [liveState.run?.status, runId, specCode]);

  const currentRun = liveState.run || initialData?.run;
  const steps = liveState.steps.length > 0 ? liveState.steps : initialData?.steps || [];
  const signals = liveState.signals.length > 0 ? liveState.signals : initialData?.signals || [];
  const findings = liveState.findings.length > 0 ? liveState.findings : initialData?.findings || [];

  const isRunning = currentRun?.status === 'running' || currentRun?.status === 'queued';

  const copySpec = () => {
    if (!specCode) return;
    navigator.clipboard.writeText(specCode);
    setCopiedSpec(true);
    setTimeout(() => setCopiedSpec(false), 2000);
  };

  const handleCancel = async () => {
    try {
      await cancelRun(runId);
      fetchFullReport();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/runs"
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to History
        </Link>

        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY STREAM
            </span>
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-900/60 hover:bg-rose-900 transition font-medium"
            >
              Abort Run
            </button>
          </div>
        )}
      </div>

      {/* Main Header Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xl">👾</span>
              <h1 className="text-xl font-bold text-white font-mono truncate max-w-md">
                Run #{runId.slice(0, 8)}
              </h1>
              {currentRun && (
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    currentRun.status === 'running'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse'
                      : currentRun.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {currentRun.status}
                </span>
              )}
              {currentRun && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  Persona: {currentRun.personaId}
                </span>
              )}
            </div>
            {currentRun && (
              <p className="text-xs font-mono text-sky-400 flex items-center gap-1">
                Target: <span className="underline">{currentRun.url}</span>
              </p>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-4 text-center">
            <div className="px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400">Steps Executed</div>
              <div className="text-lg font-bold font-mono text-white">
                {steps.length} / {currentRun?.maxSteps || 20}
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400">Signals Captured</div>
              <div
                className={`text-lg font-bold font-mono ${
                  signals.length > 0 ? 'text-amber-400' : 'text-slate-300'
                }`}
              >
                {signals.length}
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-900/80 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400">Bug Findings</div>
              <div
                className={`text-lg font-bold font-mono ${
                  findings.length > 0 ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {findings.length}
              </div>
            </div>
          </div>
        </div>

        {/* Live Thought / Status Message */}
        {liveState.currentProgress && isRunning && (
          <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-gremlin-500/30 flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-gremlin-400 animate-ping flex-shrink-0" />
            <p className="text-xs font-mono text-slate-200 truncate">
              {liveState.currentProgress.message}
            </p>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === 'timeline'
              ? 'border-gremlin-400 text-gremlin-400 bg-card'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" /> Agent Steps Timeline ({steps.length})
        </button>

        <button
          onClick={() => setActiveTab('findings')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === 'findings'
              ? 'border-rose-400 text-rose-400 bg-card'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Bug Findings ({findings.length})
        </button>

        <button
          onClick={() => setActiveTab('signals')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === 'signals'
              ? 'border-amber-400 text-amber-400 bg-card'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" /> Telemetry Signals ({signals.length})
        </button>

        <button
          onClick={() => setActiveTab('spec')}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
            activeTab === 'spec'
              ? 'border-sky-400 text-sky-400 bg-card'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4" /> Playwright Regression Spec
        </button>
      </div>

      {/* Tab 1: Timeline */}
      {activeTab === 'timeline' && (
        <div className="pt-2">
          <StepTimeline runId={runId} steps={steps} signals={signals} />
        </div>
      )}

      {/* Tab 2: Findings */}
      {activeTab === 'findings' && (
        <div className="space-y-4 pt-2">
          {findings.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded-xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h3 className="font-semibold text-slate-200">No Defect Findings Detected</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isRunning
                  ? 'Gremlin is still exploring... Findings will be synthesized upon completion.'
                  : 'All steps executed smoothly without unhandled exceptions or broken flows.'}
              </p>
            </div>
          ) : (
            findings.map((f: any) => <FindingCard key={f.id} finding={f} />)
          )}
        </div>
      )}

      {/* Tab 3: Signals */}
      {activeTab === 'signals' && (
        <div className="space-y-3 pt-2">
          {signals.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-card rounded-xl border border-border">
              No anomalies detected yet.
            </div>
          ) : (
            signals.map((sig: any) => (
              <div
                key={sig.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start gap-3 shadow-md"
              >
                <div
                  className={`p-2 rounded-lg ${
                    sig.type === 'console_error' || sig.type === 'unhandled_rejection'
                      ? 'bg-rose-500/10 text-rose-400'
                      : sig.type === 'http_5xx'
                        ? 'bg-orange-500/10 text-orange-400'
                        : 'bg-amber-500/10 text-amber-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold font-mono text-slate-300 uppercase">
                      {sig.type}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Step #{sig.stepNumber} • {new Date(sig.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-mono mt-1 break-words">
                    {sig.message}
                  </p>
                  {sig.data && (
                    <pre className="mt-2 text-[11px] bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-400 overflow-x-auto">
                      {JSON.stringify(sig.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Playwright Regression Spec */}
      {activeTab === 'spec' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between bg-card border border-border p-4 rounded-xl">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-gremlin-400" /> Auto-Generated Playwright Test
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Saved at <code className="text-gremlin-400">data/runs/{runId}/regression.spec.ts</code>
              </p>
            </div>
            <button
              onClick={copySpec}
              disabled={!specCode}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {copiedSpec ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy Test Code
                </>
              )}
            </button>
          </div>

          {specCode ? (
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono overflow-x-auto leading-relaxed">
              <code>{specCode}</code>
            </pre>
          ) : (
            <div className="p-12 text-center bg-card border border-border rounded-xl text-slate-400 text-xs">
              Regression spec will be generated automatically once the run finishes.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
