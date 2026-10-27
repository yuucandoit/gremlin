import type { Run, RunStatus, TestPlan } from '@gremlin/shared';
import { db } from '../client';

export interface CreateRunInput {
  id: string;
  url: string;
  personaId: string;
  viewport?: 'desktop' | 'mobile';
  maxSteps?: number;
  timeoutMs?: number;
}

export const runsRepo = {
  create(input: CreateRunInput): Run {
    const query = db.prepare(`
      INSERT INTO runs (id, url, persona_id, viewport, status, max_steps, timeout_ms, current_step, total_signals, created_at, updated_at)
      VALUES ($id, $url, $personaId, $viewport, 'queued', $maxSteps, $timeoutMs, 0, 0, datetime('now'), datetime('now'))
    `);

    query.run({
      $id: input.id,
      $url: input.url,
      $personaId: input.personaId,
      $viewport: input.viewport || 'desktop',
      $maxSteps: input.maxSteps ?? 20,
      $timeoutMs: input.timeoutMs ?? 60000,
    });

    return runsRepo.getById(input.id)!;
  },

  getById(id: string): Run | null {
    const row = db
      .prepare(
        `SELECT id, url, persona_id as personaId, viewport, status, max_steps as maxSteps, timeout_ms as timeoutMs,
                current_step as currentStep, total_signals as totalSignals, test_plan_json as testPlanJson, error,
                created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
         FROM runs WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      ...row,
      testPlan: row.testPlanJson ? JSON.parse(row.testPlanJson) : undefined,
    };
  },

  list(limit = 50, offset = 0): Run[] {
    const rows = db
      .prepare(
        `SELECT id, url, persona_id as personaId, viewport, status, max_steps as maxSteps, timeout_ms as timeoutMs,
                current_step as currentStep, total_signals as totalSignals, test_plan_json as testPlanJson, error,
                created_at as createdAt, updated_at as updatedAt, completed_at as completedAt
         FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as any[];

    return rows.map((r) => ({
      ...r,
      testPlan: r.testPlanJson ? JSON.parse(r.testPlanJson) : undefined,
    }));
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

  updateTestPlan(id: string, testPlan: TestPlan): void {
    db.prepare(`
      UPDATE runs
      SET test_plan_json = $testPlanJson,
          updated_at = datetime('now')
      WHERE id = $id
    `).run({
      $id: id,
      $testPlanJson: JSON.stringify(testPlan),
    });
  },

  delete(id: string): boolean {
    const res = db.prepare('DELETE FROM runs WHERE id = ?').run(id);
    return res.changes > 0;
  },

  clearAll(): number {
    const res = db.prepare('DELETE FROM runs').run();
    return res.changes;
  },
};
