'use client';

import type { Run } from '@gremlin/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearAllRuns, deleteRun, listRuns } from '../../lib/api';
import { ArrowUpRight, CheckCircle2, Clock, Flame, Play, RefreshCw, Trash2, XCircle } from 'lucide-react';

export default function RunsHistoryPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const data = await listRuns();
      setRuns(data);
    } catch (err) {
      console.error('Failed fetching runs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete test run #${id.slice(0, 8)} and all associated artifacts?`)) return;

    try {
      setDeletingId(id);
      await deleteRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete run:', err);
      alert('Failed to delete run.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to delete ALL test runs history and artifacts? This cannot be undone.')) return;

    try {
      setClearing(true);
      await clearAllRuns();
      setRuns([]);
    } catch (err) {
      console.error('Failed to clear runs:', err);
      alert('Failed to clear runs history.');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            RUNNING
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">
            <Clock className="w-3.5 h-3.5" />
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Exploratory Runs History</h1>
          <p className="text-xs text-slate-400 mt-1">
            Browse all past and active AI testing sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runs.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="px-3 py-2 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/60 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearing ? 'Clearing...' : 'Clear All'}</span>
            </button>
          )}
          <button
            onClick={fetchRuns}
            className="px-3 py-2 rounded-lg bg-card border border-border hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {runs.length === 0 && !loading ? (
        <div className="p-12 text-center bg-card border border-border rounded-2xl">
          <span className="text-4xl">👾</span>
          <h3 className="mt-4 font-semibold text-slate-200">No test runs recorded yet</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Launch your first autonomous session to hunt bugs.
          </p>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-gremlin-500 hover:bg-gremlin-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-slate-950" /> Start First Run
          </Link>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  <th className="px-6 py-3.5">Run ID & Status</th>
                  <th className="px-6 py-3.5">Target Application</th>
                  <th className="px-6 py-3.5">Persona</th>
                  <th className="px-6 py-3.5">Steps</th>
                  <th className="px-6 py-3.5">Signals Found</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/50 transition">
                    <td className="px-6 py-4 font-mono font-medium">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(run.status)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 truncate max-w-[140px]">
                        {run.id}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sky-400 truncate max-w-xs">{run.url}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize font-medium text-slate-200 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">
                        {run.personaId}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-200">
                      {run.currentStep} / {run.maxSteps}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`font-mono font-bold ${
                          run.totalSignals > 0 ? 'text-rose-400' : 'text-slate-500'
                        }`}
                      >
                        {run.totalSignals} signals
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400" suppressHydrationWarning>
                      {new Date(run.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/runs/${run.id}`}
                          className="inline-flex items-center gap-1 text-gremlin-400 hover:text-gremlin-300 font-semibold"
                        >
                          Inspect <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={(e) => handleDelete(run.id, e)}
                          disabled={deletingId === run.id}
                          className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer disabled:opacity-40"
                          title="Delete run & artifacts"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
