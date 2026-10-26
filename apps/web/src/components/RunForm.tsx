'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createRun } from '../lib/api';
import { ArrowRight, Bot, Flame, Monitor, Play, Settings2, Smartphone, Sparkles } from 'lucide-react';

const PRESET_PERSONAS = [
  {
    id: 'gremlin',
    name: 'The Chaos Gremlin',
    avatar: '👾',
    badge: 'CHAOS 90%',
    tagline: 'Rapid clicks, double-click checkout, unicode/emoji injection',
    border: 'hover:border-purple-500 focus-within:border-purple-500',
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    avatar: '⚡',
    badge: 'RACE CONDITIONS',
    tagline: 'Impatient fast-clicking user uncovering double submit bugs',
    border: 'hover:border-amber-500 focus-within:border-amber-500',
  },
  {
    id: 'skeptic',
    name: 'Edge Case Skeptic',
    avatar: '🧐',
    badge: 'NEGATIVE TESTING',
    tagline: 'Tests coupon code 500s, negative numbers, boundary cases',
    border: 'hover:border-blue-500 focus-within:border-blue-500',
  },
  {
    id: 'shopper',
    name: 'Happy Path Shopper',
    avatar: '🛍️',
    badge: 'CONVERSION FLOW',
    tagline: 'Standard customer journey: add to cart & checkout',
    border: 'hover:border-emerald-500 focus-within:border-emerald-500',
  },
];

export function RunForm() {
  const router = useRouter();
  const [url, setUrl] = useState('http://localhost:3002');
  const [personaId, setPersonaId] = useState('gremlin');
  const [maxSteps, setMaxSteps] = useState(15);
  const [chaosMode, setChaosMode] = useState(true);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const run = await createRun({
        url,
        personaId,
        maxSteps,
        chaosMode,
        viewport,
      });

      router.push(`/runs/${run.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to start run');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-900/80 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Target URL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Bot className="w-4 h-4 text-gremlin-400" /> Target Web App URL
          </label>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setUrl('http://localhost:3002')}
              className="text-gremlin-400 hover:text-gremlin-300 underline font-medium"
            >
              Preset: GlitchMart Demo (Port 3002)
            </button>
          </div>
        </div>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com or http://localhost:3002"
          className="w-full bg-slate-900/90 border border-border focus:border-gremlin-400 rounded-xl px-4 py-3 text-white placeholder-slate-500 outline-none transition font-mono text-sm"
        />
        <p className="text-xs text-slate-400">
          The agent will launch headless Chromium and autonomously interact with this URL.
        </p>
      </div>

      {/* Persona Selection */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gremlin-400" /> Choose Testing Persona
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRESET_PERSONAS.map((p) => {
            const isSelected = personaId === p.id;
            return (
              <div
                key={p.id}
                onClick={() => setPersonaId(p.id)}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-gremlin-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-gremlin-400'
                    : 'bg-card border-border hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-semibold text-slate-100 text-sm">{p.name}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {p.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{p.tagline}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Device Viewport Emulation */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-gremlin-400" /> Device Viewport & Emulation
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div
            onClick={() => setViewport('desktop')}
            className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
              viewport === 'desktop'
                ? 'bg-slate-800/90 border-gremlin-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-gremlin-400'
                : 'bg-card border-border hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🖥️</span>
              <div>
                <div className="font-semibold text-sm text-slate-100">Desktop Viewport</div>
                <div className="text-xs text-slate-400 font-mono">1280 × 800 • Full Web</div>
              </div>
            </div>
            {viewport === 'desktop' && (
              <span className="w-2.5 h-2.5 rounded-full bg-gremlin-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}
          </div>

          <div
            onClick={() => setViewport('mobile')}
            className={`cursor-pointer p-3.5 rounded-xl border transition-all flex items-center justify-between ${
              viewport === 'mobile'
                ? 'bg-slate-800/90 border-gremlin-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-gremlin-400'
                : 'bg-card border-border hover:bg-slate-900/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <div className="font-semibold text-sm text-slate-100">Mobile Viewport</div>
                <div className="text-xs text-slate-400 font-mono">390 × 844 • Touch Emulation</div>
              </div>
            </div>
            {viewport === 'mobile' && (
              <span className="w-2.5 h-2.5 rounded-full bg-gremlin-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}
          </div>
        </div>
      </div>

      {/* Settings Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 rounded-xl bg-card border border-border">
        {/* Max Steps */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Max Exploration Steps</span>
            <span className="font-mono text-gremlin-400 font-bold">{maxSteps} steps</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={1}
            value={maxSteps}
            onChange={(e) => setMaxSteps(Number(e.target.value))}
            className="w-full accent-gremlin-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>5 (Quick test)</span>
            <span>15 (Recommended)</span>
            <span>30 (Deep chaos)</span>
          </div>
        </div>

        {/* Chaos Mode Toggle */}
        <div className="flex items-center justify-between self-center">
          <div>
            <div className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" /> Chaos Mode Injection
            </div>
            <p className="text-xs text-slate-400">
              Double-click buttons, rapid forms, and unexpected payloads
            </p>
          </div>
          <button
            type="button"
            onClick={() => setChaosMode(!chaosMode)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition ${
              chaosMode ? 'bg-gremlin-500 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="bg-white w-4 h-4 rounded-full shadow-md transform transition" />
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-4 px-6 rounded-xl bg-gremlin-500 hover:bg-gremlin-400 text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-gremlin-500/20 hover:shadow-gremlin-500/40 transition disabled:opacity-50 cursor-pointer"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            <span>Spawning Gremlin Agent...</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5 fill-slate-950" />
            <span>Start Autonomous Exploration</span>
            <ArrowRight className="w-5 h-5 ml-1" />
          </>
        )}
      </button>
    </form>
  );
}
