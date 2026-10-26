'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Flame,
  ListTree,
  Monitor,
  Radio,
  RefreshCw,
  ShieldAlert,
  Terminal,
  XCircle,
} from 'lucide-react';
import { cancelRun, getRun, getRunReport } from '../../../lib/api';
import { useRunEvents } from '../../../lib/useRunEvents';
import { LiveBrowserView } from '../../../components/LiveBrowserView';
import { StepTimeline } from '../../../components/StepTimeline';
import { FindingCard } from '../../../components/FindingCard';

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const runId = resolvedParams.id;

  const [activeTab, setActiveTab] = useState<'findings' | 'signals' | 'spec'>('findings');
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
      getRunReport(runId)
        .then((r) => setSpecCode(r.regressionSpec))
        .catch(() => {});
    }
  }, [liveState.run?.status, runId, specCode]);

  const currentRun = liveState.run || initialData?.run;
  const steps = liveState.steps.length > 0 ? liveState.steps : initialData?.steps || [];
  const signals = liveState.signals.length > 0 ? liveState.signals : initialData?.signals || [];
  const findings = liveState.findings.length > 0 ? liveState.findings : initialData?.findings || [];

  const isRunning = currentRun?.status === 'running' || currentRun?.status === 'queued';

  // Get current step thought & latest screenshot for fallback
  const lastStep = steps[steps.length - 1];
  const currentThought = liveState.currentProgress?.message || lastStep?.thought;
  const latestScreenshotPath = lastStep?.screenshotPath;

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
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-border/80">
        <div className="flex items-center gap-3">
          <Link
            href="/runs"
            className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to History
          </Link>
          <span className="text-slate-600">/</span>
          <div className="flex items-center gap-2">
            <span className="text-lg">👾</span>
            <span className="font-bold text-sm text-white font-mono">
              Run #{runId.slice(0, 8)}
            </span>
            {currentRun && (
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
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
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                Persona: {currentRun.personaId}
              </span>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              LIVE TELEMETRY ACTIVE
            </span>
            <button
              onClick={handleCancel}
              className="text-xs px-3 py-1 rounded-lg bg-rose-950/70 text-rose-300 border border-rose-900/70 hover:bg-rose-900 transition font-semibold"
            >
              Abort Run
            </button>
          </div>
        )}
      </div>

      {/* Main 2-Column Split Layout */}
      {/* Kiri/Tengah: Layar Live Chromium + Card Bawah */}
      {/* Kanan: List Step dan Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri/Tengah (7 cols on lg, 8 cols on xl) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* 1. Layar Live Chromium */}
          <div>
            <LiveBrowserView
              runId={runId}
              targetUrl={currentRun?.url || 'http://localhost:3002'}
              currentUrl={currentRun?.url}
              isRunning={isRunning}
              currentThought={currentThought}
              latestScreenshotPath={latestScreenshotPath}
              currentStep={steps.length}
              maxSteps={currentRun?.maxSteps || 20}
            />
          </div>

          {/* 2. Bawah Layar Live: Card Detail, Metrik & Findings */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
            {/* Header Card & Metrics Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-gremlin-400" />
                  Exploratory Session Telemetry & Findings
                </h2>
                {currentRun && (
                  <p className="text-xs font-mono text-sky-400 truncate max-w-md">
                    Target: <span className="underline">{currentRun.url}</span>
                  </p>
                )}
              </div>

              {/* Metrics Counters */}
              <div className="flex items-center gap-3">
                <div className="px-3.5 py-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Steps</div>
                  <div className="text-base font-bold font-mono text-white">
                    {steps.length} / {currentRun?.maxSteps || 20}
                  </div>
                </div>

                <div className="px-3.5 py-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Signals</div>
                  <div
                    className={`text-base font-bold font-mono ${
                      signals.length > 0 ? 'text-amber-400' : 'text-slate-300'
                    }`}
                  >
                    {signals.length}
                  </div>
                </div>

                <div className="px-3.5 py-2 bg-slate-900/80 rounded-xl border border-slate-800 text-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Bugs</div>
                  <div
                    className={`text-base font-bold font-mono ${
                      findings.length > 0 ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {findings.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Navigation Tabs under the live screen */}
            <div className="flex border-b border-border gap-2">
              <button
                onClick={() => setActiveTab('findings')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'findings'
                    ? 'border-rose-400 text-rose-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" /> Bug Findings ({findings.length})
              </button>

              <button
                onClick={() => setActiveTab('signals')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'signals'
                    ? 'border-amber-400 text-amber-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Radio className="w-4 h-4" /> Telemetry Signals ({signals.length})
              </button>

              <button
                onClick={() => setActiveTab('spec')}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition flex items-center gap-2 border-b-2 ${
                  activeTab === 'spec'
                    ? 'border-sky-400 text-sky-400 bg-slate-900/80'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-4 h-4" /> Playwright Regression Spec
              </button>
            </div>

            {/* Tab 1: Findings */}
            {activeTab === 'findings' && (
              <div className="space-y-4 pt-1">
                {findings.length === 0 ? (
                  <div className="p-10 text-center bg-slate-900/40 border border-border rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <h4 className="font-semibold text-slate-200 text-sm">
                      No Defect Findings Detected Yet
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {isRunning
                        ? 'Gremlin agent is still exploring... Bugs will be synthesized once anomalies are detected.'
                        : 'No critical crashes, dead clicks, or server errors detected in this session.'}
                    </p>
                  </div>
                ) : (
                  findings.map((f: any) => <FindingCard key={f.id} finding={f} />)
                )}
              </div>
            )}

            {/* Tab 2: Telemetry Signals */}
            {activeTab === 'signals' && (
              <div className="space-y-3 pt-1">
                {signals.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 bg-slate-900/40 rounded-xl border border-border text-xs">
                    No runtime telemetry errors captured.
                  </div>
                ) : (
                  signals.map((sig: any) => (
                    <div
                      key={sig.id}
                      className="bg-slate-900/80 border border-border rounded-xl p-4 flex items-start gap-3 shadow-sm"
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
                          <span className="text-[10px] text-slate-500 font-mono" suppressHydrationWarning>
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

            {/* Tab 3: Playwright Regression Spec */}
            {activeTab === 'spec' && (
              <div className="space-y-4 pt-1">
                <div className="flex items-center justify-between bg-slate-900/80 border border-border p-3.5 rounded-xl">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-gremlin-400" /> Executable Playwright Test
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Auto-saved at <code className="text-gremlin-400">data/runs/{runId}/regression.spec.ts</code>
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
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono overflow-x-auto leading-relaxed max-h-96">
                    <code>{specCode}</code>
                  </pre>
                ) : (
                  <div className="p-10 text-center bg-slate-900/40 border border-border rounded-xl text-slate-400 text-xs">
                    Regression spec will be generated automatically once the exploration session concludes.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Kolom Kanan: List Step dan Menu (5 cols on lg, 4 cols on xl) */}
        <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xl flex flex-col max-h-[calc(100vh-100px)]">
            {/* Header List Step & Menu */}
            <div className="pb-4 mb-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTree className="w-4 h-4 text-gremlin-400" />
                <h3 className="font-bold text-sm text-white">Execution Steps & Audit</h3>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {steps.length} {steps.length === 1 ? 'Step' : 'Steps'}
              </span>
            </div>

            {/* Scrollable Timeline Container */}
            <div className="flex-1 overflow-y-auto pr-1">
              <StepTimeline runId={runId} steps={steps} signals={signals} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
