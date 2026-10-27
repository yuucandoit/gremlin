'use client';

import { useState } from 'react';
import type { Scenario, ScenarioCoverage, ScenarioRisk } from '@gremlin/shared';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Edit2,
  Flame,
  HelpCircle,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { approvePlan, createScenario, deleteScenario, reorderScenarios, updateScenario } from '../lib/api';

interface ScenarioPlanManagerProps {
  runId: string;
  scenarios: Scenario[];
  coverage?: ScenarioCoverage;
  runStatus: string;
  onRefresh?: () => void;
}

export function ScenarioPlanManager({
  runId,
  scenarios,
  coverage,
  runStatus,
  onRefresh,
}: ScenarioPlanManagerProps) {
  const [promptInput, setPromptInput] = useState('');
  const [submittingPrompt, setSubmittingPrompt] = useState(false);
  const [approving, setApproving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGoal, setEditGoal] = useState('');

  const isPlanningMode = runStatus === 'planning';
  const isRunning = runStatus === 'running';

  const enabledCount = scenarios.filter((s) => s.enabled).length;

  const handleToggleEnabled = async (scenario: Scenario) => {
    try {
      await updateScenario(runId, scenario.id, { enabled: !scenario.enabled });
      onRefresh?.();
    } catch (err) {
      console.error('Failed to toggle scenario:', err);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await approvePlan(runId);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to approve plan:', err);
    } finally {
      setApproving(false);
    }
  };

  const handleAddPromptScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;

    setSubmittingPrompt(true);
    try {
      await createScenario(runId, { prompt: promptInput.trim() });
      setPromptInput('');
      onRefresh?.();
    } catch (err) {
      console.error('Failed to create scenario from prompt:', err);
    } finally {
      setSubmittingPrompt(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await deleteScenario(runId, id);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to delete scenario:', err);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= scenarios.length) return;

    const reordered = [...scenarios];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    try {
      await reorderScenarios(runId, reordered.map((s) => s.id));
      onRefresh?.();
    } catch (err) {
      console.error('Failed to reorder scenarios:', err);
    }
  };

  const handleSaveEdit = async (scenario: Scenario) => {
    try {
      await updateScenario(runId, scenario.id, {
        title: editTitle || scenario.title,
        goal: editGoal || scenario.goal,
      });
      setEditingId(null);
      onRefresh?.();
    } catch (err) {
      console.error('Failed to save scenario edit:', err);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (scenario: Scenario) => {
    switch (scenario.status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Lulus
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Gagal
          </span>
        );
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menguji
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Lock className="w-3.5 h-3.5" /> Terblokir (Butuh Auth)
          </span>
        );
      case 'skipped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Dilewati
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800/80 text-slate-300 border border-slate-700">
            Menunggu
          </span>
        );
    }
  };

  const getPersonaBadge = (personaId?: string) => {
    const p = (personaId || 'gremlin').toLowerCase();
    if (p.includes('speed')) return { label: 'Speed Demon', icon: '⚡', color: 'text-amber-400 border-amber-500/20 bg-amber-500/10' };
    if (p.includes('skeptic')) return { label: 'Skeptic', icon: '🧐', color: 'text-blue-400 border-blue-500/20 bg-blue-500/10' };
    if (p.includes('pixel')) return { label: 'Pixel Auditor', icon: '🔍', color: 'text-purple-400 border-purple-500/20 bg-purple-500/10' };
    return { label: 'Chaos Gremlin', icon: '👾', color: 'text-gremlin-400 border-gremlin-500/20 bg-gremlin-500/10' };
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Header & Approval Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-gremlin-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">
              {isPlanningMode ? 'Perencanaan Pengujian Skenario' : 'Tulang Punggung Skenario & Cakupan'}
            </h2>
            {isPlanningMode && (
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                MENUNGGU PERSETUJUAN
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isPlanningMode
              ? 'AI telah memformulasikan rencana awal. Anda dapat mencentang, mengedit, menambah skenario manual, atau langsung mulai eksekusi.'
              : 'Eksekusi pengujian mengikat skenario secara berurutan dengan verifikasi kriteria expect & deteksi anomali.'}
          </p>
        </div>

        {/* Start / Approval Button */}
        {isPlanningMode && (
          <button
            onClick={handleApprove}
            disabled={approving || enabledCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-gremlin-500 to-emerald-500 hover:from-gremlin-400 hover:to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-gremlin-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {approving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Menyiapkan Eksekusi...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Mulai Eksekusi ({enabledCount} Skenario)
              </>
            )}
          </button>
        )}
      </div>

      {/* Coverage Bar & Summary Stats */}
      {coverage && coverage.total > 0 && (
        <div className="bg-slate-900/90 rounded-xl p-4 border border-border space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 text-slate-200">
              <Shield className="w-4 h-4 text-gremlin-400" />
              <span>Cakupan Pengujian (Test Coverage)</span>
            </div>
            <span className="font-mono text-gremlin-400 font-bold text-sm">
              {coverage.percentage}% Selesai
            </span>
          </div>

          {/* Progress Multi-bar */}
          <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden flex border border-slate-800">
            {coverage.passed > 0 && (
              <div
                style={{ width: `${(coverage.passed / coverage.total) * 100}%` }}
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`${coverage.passed} Lulus`}
              />
            )}
            {coverage.failed > 0 && (
              <div
                style={{ width: `${(coverage.failed / coverage.total) * 100}%` }}
                className="bg-rose-500 h-full transition-all duration-500"
                title={`${coverage.failed} Gagal`}
              />
            )}
            {coverage.blocked > 0 && (
              <div
                style={{ width: `${(coverage.blocked / coverage.total) * 100}%` }}
                className="bg-amber-500 h-full transition-all duration-500"
                title={`${coverage.blocked} Terblokir`}
              />
            )}
          </div>

          {/* Counter pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono font-medium">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ✓ {coverage.passed} Lulus
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              ✗ {coverage.failed} Gagal
            </span>
            {coverage.blocked > 0 && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                🔒 {coverage.blocked} Terblokir
              </span>
            )}
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              ⏳ {coverage.pending} Menunggu
            </span>
            <span className="ml-auto text-slate-400">
              Total {coverage.enabled} aktif dari {coverage.total} skenario
            </span>
          </div>
        </div>
      )}

      {/* Quick Add Custom Scenario Input Form */}
      <form onSubmit={handleAddPromptScenario} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Tambah skenario dengan kalimat biasa, misal: 'coba bayar dengan keranjang kosong'..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-gremlin-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none transition"
          />
          <Sparkles className="w-4 h-4 text-gremlin-400 absolute right-3 top-3 pointer-events-none opacity-60" />
        </div>
        <button
          type="submit"
          disabled={submittingPrompt || !promptInput.trim()}
          className="px-4 py-2.5 bg-slate-900 border border-slate-800 hover:border-gremlin-500 hover:text-gremlin-400 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{submittingPrompt ? 'Memproses...' : 'Tambah'}</span>
        </button>
      </form>

      {/* Scenario List */}
      <div className="space-y-3">
        {scenarios.map((scenario, index) => {
          const personaBadge = getPersonaBadge(scenario.personaId);
          const isExpanded = expandedId === scenario.id;
          const isEditing = editingId === scenario.id;
          const isHighRisk = scenario.risk === 'high';

          return (
            <div
              key={scenario.id}
              className={`rounded-xl border transition-all ${
                scenario.status === 'running'
                  ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/20'
                  : scenario.enabled
                  ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  : 'bg-slate-950/40 border-slate-900 opacity-60'
              }`}
            >
              {/* Row Header */}
              <div className="p-4 flex items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Enable / Disable Checkbox */}
                  <input
                    type="checkbox"
                    checked={scenario.enabled}
                    onChange={() => handleToggleEnabled(scenario)}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-gremlin-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                    title={scenario.enabled ? 'Nonaktifkan skenario' : 'Aktifkan skenario'}
                  />

                  {/* Index badge */}
                  <span className="font-mono text-xs text-slate-500 font-bold">
                    #{index + 1}
                  </span>

                  {/* Title & Goal Summary */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate max-w-md">
                        {scenario.title}
                      </span>

                      {/* High risk warning */}
                      {isHighRisk && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> HIGH RISK (OFF DEFAULT)
                        </span>
                      )}

                      {/* Auth requirement */}
                      {scenario.needsAuth && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> BUTUH LOGIN
                        </span>
                      )}

                      {/* Persona badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1 ${personaBadge.color}`}>
                        <span>{personaBadge.icon}</span>
                        <span>{personaBadge.label}</span>
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {scenario.goal}
                    </p>
                  </div>
                </div>

                {/* Right controls: Status, Actions, Expand */}
                <div className="flex items-center gap-2 shrink-0">
                  {renderStatusBadge(scenario)}

                  {/* Reorder buttons */}
                  {isPlanningMode && (
                    <div className="hidden sm:flex items-center gap-1">
                      <button
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Geser ke atas"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === scenarios.length - 1}
                        className="p-1 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Geser ke bawah"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Expand button */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                    className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
                    title="Lihat detail kriteria"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Card Details */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 space-y-3 bg-slate-950/40">
                  {/* Verdict notice if evaluated */}
                  {scenario.verdict && (
                    <div
                      className={`p-3 rounded-lg border text-xs font-mono leading-relaxed ${
                        scenario.status === 'passed'
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                          : scenario.status === 'failed'
                          ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                          : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5 mb-1">
                        <span>📢 Hasil Verifikasi Skenario:</span>
                      </div>
                      <p>{scenario.verdict}</p>
                    </div>
                  )}

                  {/* Edit mode or View mode */}
                  {isEditing ? (
                    <div className="space-y-2 pt-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Judul skenario"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                      <textarea
                        value={editGoal}
                        onChange={(e) => setEditGoal(e.target.value)}
                        placeholder="Tujuan spesifik skenario"
                        rows={2}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 text-xs text-slate-400 hover:text-white"
                        >
                          Batal
                        </button>
                        <button
                          onClick={() => handleSaveEdit(scenario)}
                          className="px-3 py-1 bg-gremlin-500 text-slate-950 font-bold text-xs rounded-lg hover:bg-gremlin-400"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Expected Criteria List */}
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex items-center gap-1.5">
                          <span>🎯</span> Kriteria Lulus (Expected Pass Criteria):
                        </div>
                        <ul className="space-y-1 font-mono text-xs text-slate-300">
                          {scenario.expect.map((exp, expIdx) => (
                            <li key={expIdx} className="flex items-start gap-2">
                              <span className="text-gremlin-400">•</span>
                              <span>{exp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs text-slate-500">
                        <span className="font-mono text-[10px]">
                          Maksimal: {scenario.maxSteps} Langkah · Sumber: {scenario.source.toUpperCase()}
                        </span>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setEditingId(scenario.id);
                              setEditTitle(scenario.title);
                              setEditGoal(scenario.goal);
                            }}
                            className="hover:text-sky-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteScenario(scenario.id)}
                            className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {scenarios.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
            Belum ada skenario pengujian. Reconnaissance sedang menganalisis atau Anda dapat menambahkan skenario manual di atas.
          </div>
        )}
      </div>
    </div>
  );
}

