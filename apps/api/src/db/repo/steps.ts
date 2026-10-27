import type { Step } from '@gremlin/shared';
import { db } from '../client';

export interface CreateStepInput {
  id: string;
  runId: string;
  scenarioId?: string | null;
  stepNumber: number;
  actor?: 'agent' | 'human';
  action: any;
  thought: string;
  screenshotPath?: string | null;
  ariaSnapshot?: string | null;
  durationMs: number;
}

export const stepsRepo = {
  create(input: CreateStepInput): Step {
    db.prepare(`
      INSERT INTO steps (id, run_id, scenario_id, step_number, actor, action_json, thought, screenshot_path, aria_snapshot, duration_ms, created_at)
      VALUES ($id, $runId, $scenarioId, $stepNumber, $actor, $actionJson, $thought, $screenshotPath, $ariaSnapshot, $durationMs, datetime('now'))
    `).run({
      $id: input.id,
      $runId: input.runId,
      $scenarioId: input.scenarioId ?? null,
      $stepNumber: input.stepNumber,
      $actor: input.actor || 'agent',
      $actionJson: JSON.stringify(input.action),
      $thought: input.thought,
      $screenshotPath: input.screenshotPath ?? null,
      $ariaSnapshot: input.ariaSnapshot ?? null,
      $durationMs: input.durationMs,
    });

    return stepsRepo.getById(input.id)!;
  },

  getById(id: string): Step | null {
    const row = db
      .prepare(
        `SELECT id, run_id as runId, scenario_id as scenarioId, step_number as stepNumber, actor, action_json as actionJson,
                thought, screenshot_path as screenshotPath, aria_snapshot as ariaSnapshot,
                duration_ms as durationMs, created_at as timestamp
         FROM steps WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      runId: row.runId,
      scenarioId: row.scenarioId || null,
      stepNumber: row.stepNumber,
      actor: row.actor || 'agent',
      action: JSON.parse(row.actionJson),
      thought: row.thought,
      screenshotPath: row.screenshotPath,
      ariaSnapshot: row.ariaSnapshot,
      durationMs: row.durationMs,
      timestamp: row.timestamp,
    };
  },

  listByRunId(runId: string): Step[] {
    const rows = db
      .prepare(
        `SELECT id, run_id as runId, scenario_id as scenarioId, step_number as stepNumber, actor, action_json as actionJson,
                thought, screenshot_path as screenshotPath, aria_snapshot as ariaSnapshot,
                duration_ms as durationMs, created_at as timestamp
         FROM steps WHERE run_id = ? ORDER BY step_number ASC`
      )
      .all(runId) as any[];

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      scenarioId: row.scenarioId || null,
      stepNumber: row.stepNumber,
      actor: row.actor || 'agent',
      action: JSON.parse(row.actionJson),
      thought: row.thought,
      screenshotPath: row.screenshotPath,
      ariaSnapshot: row.ariaSnapshot,
      durationMs: row.durationMs,
      timestamp: row.timestamp,
    }));
  },
};
