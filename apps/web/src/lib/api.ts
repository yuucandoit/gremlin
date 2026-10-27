import type { CreateRunRequest, Run, RunReport, Scenario, ScenarioCoverage } from '@gremlin/shared';

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

export async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete run');
}

export async function clearAllRuns(): Promise<{ count: number }> {
  const res = await fetch(`${API_BASE}/runs`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear runs history');
  return res.json();
}

export async function pauseRun(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${id}/pause`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to pause run');
}

export async function resumeRun(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${id}/resume`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to resume run');
}

export async function sendPlaygroundInput(
  id: string,
  input: import('@gremlin/shared').InteractiveInputRequest
): Promise<any> {
  const res = await fetch(`${API_BASE}/runs/${id}/input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Input failed' }));
    throw new Error(err.error || 'Failed to dispatch input');
  }
  return res.json();
}

export async function inspectPlaygroundElement(
  id: string,
  x: number,
  y: number
): Promise<import('@gremlin/shared').InspectElementResult | null> {
  const res = await fetch(`${API_BASE}/runs/${id}/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y }),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function submitPlaygroundGuidance(
  id: string,
  instruction: string,
  targetSelector?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${id}/instruct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction, targetSelector }),
  });
  if (!res.ok) throw new Error('Failed to submit guidance instruction');
}

export function getArtifactUrl(runId: string, relativePath: string): string {
  return `${API_BASE}/runs/${runId}/artifacts/${relativePath}`;
}

export async function getScenarios(runId: string): Promise<{ scenarios: Scenario[]; coverage: ScenarioCoverage }> {
  const res = await fetch(`${API_BASE}/runs/${runId}/scenarios`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch scenarios');
  return res.json();
}

export async function approvePlan(runId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${runId}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to approve test plan');
}

export async function createScenario(runId: string, payload: any): Promise<Scenario> {
  const res = await fetch(`${API_BASE}/runs/${runId}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create scenario');
  return res.json();
}

export async function updateScenario(runId: string, scenarioId: string, partial: any): Promise<Scenario> {
  const res = await fetch(`${API_BASE}/runs/${runId}/scenarios/${scenarioId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });
  if (!res.ok) throw new Error('Failed to update scenario');
  return res.json();
}

export async function deleteScenario(runId: string, scenarioId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/runs/${runId}/scenarios/${scenarioId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete scenario');
}

export async function reorderScenarios(runId: string, scenarioIds: string[]): Promise<Scenario[]> {
  const res = await fetch(`${API_BASE}/runs/${runId}/scenarios/reorder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioIds }),
  });
  if (!res.ok) throw new Error('Failed to reorder scenarios');
  const data = await res.json();
  return data.scenarios;
}
