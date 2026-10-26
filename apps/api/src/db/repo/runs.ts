import type { Run, RunStatus } from '@gremlin/shared';
import { db } from '../client';

export interface CreateRunInput {
  id: string;
  url: string;
  personaId: string;
  maxSteps?: number;
  timeoutMs?: number;
}

export const runsRepo = {
  create(input: CreateRunInput): Run {
    const query = db.prepare(`
      INSERT INTO runs (id, url, persona_id, status, max_steps, timeout_ms, current_step, total_signals, created_at, updated_at)
      VALUES ($id, $url, $personaId, 'queued', $maxSteps, $timeoutMs, 0, 0, datetime('now'), datetime('now'))
    `);

    query.run({
      $id: input.id,
      $url: input.url,
      $personaId: input.personaId,
      $maxSteps: input.maxSteps ?? 20,
      $timeoutMs: input.timeoutMs ?? 60000,
    });

    return runsRepo.getById(input.id)!;
  },

  getById(id: string): Run | null {
    const row = db
      .prepare(
        `SELECT id, url, persona_id as personaId, status, max_steps as maxSteps, timeout_ms as timeoutMs,
                current_step as currentStep, total_signals as totalSignals, error,
                created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
         FROM runs WHERE id = ?`
      )
      .get(id) as Run | undefined;

    return row || null;
  },

  list(limit = 50, offset = 0): Run[] {
    const rows = db
      .prepare(
        `SELECT id, url, persona_id as personaId, status, max_steps as maxSteps, timeout_ms as timeoutMs,
                current_step as currentStep, total_signals as totalSignals, error,
                created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
         FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Run[];

    return rows;
  },

  updateStatus(id: string, status: RunStatus, error?: string | null): void {
    const isCompleted = status === 'completed' || status === 'failed' || status === 'cancelled';
    const completedAtSql = isCompleted ? `completed_at = datetime('now'),` : '';

    db.prepare(`
      UPDATE runs
      SET status = $status,
          error = $error,
          ${completedAtSql}
          updated_at = datetime('now')
      WHERE id = $id
    `).run({
      $id: id,
      $status: status,
      $error: error || null,
    });
  },

  updateProgress(id: string, currentStep: number, totalSignals: number): void {
    db.prepare(`
      UPDATE runs
      SET current_step = $currentStep,
          total_signals = $totalSignals,
          updated_at = datetime('now')
      WHERE id = $id
    `).run({
      $id: id,
      $currentStep: currentStep,
      $totalSignals: totalSignals,
    });
  },
};
