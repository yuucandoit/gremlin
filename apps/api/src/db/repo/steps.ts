import type { Step } from '@gremlin/shared';
import { db } from '../client';

export interface CreateStepInput {
  id: string;
  runId: string;
  stepNumber: number;
  action: any;
  thought: string;
  screenshotPath?: string | null;
  ariaSnapshot?: string | null;
  durationMs: number;
}

export const stepsRepo = {
  create(input: CreateStepInput): Step {
    db.prepare(`
      INSERT INTO steps (id, run_id, step_number, action_json, thought, screenshot_path, aria_snapshot, duration_ms, created_at)
      VALUES ($id, $runId, $stepNumber, $actionJson, $thought, $screenshotPath, $ariaSnapshot, $durationMs, datetime('now'))
    `).run({
      $id: input.id,
      $runId: input.runId,
      $stepNumber: input.stepNumber,
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
        `SELECT id, run_id as runId, step_number as stepNumber, action_json as actionJson,
                thought, screenshot_path as screenshotPath, aria_snapshot as ariaSnapshot,
                duration_ms as durationMs, created_at as timestamp
         FROM steps WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      runId: row.runId,
      stepNumber: row.stepNumber,
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
        `SELECT id, run_id as runId, step_number as stepNumber, action_json as actionJson,
                thought, screenshot_path as screenshotPath, aria_snapshot as ariaSnapshot,
                duration_ms as durationMs, created_at as timestamp
         FROM steps WHERE run_id = ? ORDER BY step_number ASC`
      )
      .all(runId) as any[];

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      stepNumber: row.stepNumber,
      action: JSON.parse(row.actionJson),
      thought: row.thought,
      screenshotPath: row.screenshotPath,
      ariaSnapshot: row.ariaSnapshot,
      durationMs: row.durationMs,
      timestamp: row.timestamp,
    }));
  },
};
