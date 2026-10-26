import { RunForm } from '../components/RunForm';
import { Bot, Bug, Cpu, ShieldAlert, Sparkles, Terminal } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gremlin-500/10 border border-gremlin-500/20 text-gremlin-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" /> Next-Gen Autonomous Exploratory & Chaos Testing
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Unleash <span className="text-gremlin-400">Gremlin</span> on your App
        </h1>
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Point Gremlin to any web application. The AI agent observes the DOM, plans exploratory
          steps, simulates realistic or chaotic user personas, and detects crashes, dead clicks,
          and race conditions.
        </p>
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Vision & ARIA Observe</h4>
            <p className="text-xs text-slate-400 mt-1">
              Takes high-res screenshots and accessibility trees to understand page context.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Real-time Anomaly Detectors</h4>
            <p className="text-xs text-slate-400 mt-1">
              Catches console errors, HTTP 500s, dead clicks, and focus/infinite loop traps.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Auto Regression Spec</h4>
            <p className="text-xs text-slate-400 mt-1">
              Generates executable Playwright test scripts reproducing discovered bugs.
            </p>
          </div>
        </div>
      </div>

      {/* Main Configuration Form Card */}
      <div className="bg-card/70 border border-border rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold text-white">Configure New Test Session</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select your target environment and persona to dispatch the agent.
            </p>
          </div>
          <span className="text-2xl">🤖</span>
        </div>

        <RunForm />
      </div>
    </div>
  );
}
