import type { CreateRunRequest, Run, RunReport } from '@gremlin/shared';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function createRun(payload: CreateRunRequest): Promise<Run> {
  const res = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create run' }));
    throw new Error(error.error || 'Failed to start run');
  }

  return res.json();
}

export async function listRuns(): Promise<Run[]> {
  const res = await fetch(`${API_BASE}/runs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json();
}

export async function getRun(id: string): Promise<{
  run: Run;
  steps: any[];
  signals: any[];
  findings: any[];
}> {
  const res = await fetch(`${API_BASE}/runs/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch run details');
  return res.json();
}

export async function getRunReport(id: string): Promise<RunReport> {
  const res = await fetch(`${API_BASE}/runs/${id}/report`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch run report');
  return res.json();
}

export async function cancelRun(id: string): Promise<void> {
  await fetch(`${API_BASE}/runs/${id}/cancel`, { method: 'POST' });
}

export function getArtifactUrl(runId: string, relativePath: string): string {
  return `${API_BASE}/runs/${runId}/artifacts/${relativePath}`;
}
