import type { Signal, SignalType } from '@gremlin/shared';
import { db } from '../client';

export interface CreateSignalInput {
  id: string;
  runId: string;
  stepNumber?: number | null;
  type: SignalType;
  message: string;
  data?: Record<string, any>;
}

export const signalsRepo = {
  create(input: CreateSignalInput): Signal {
    db.prepare(`
      INSERT INTO signals (id, run_id, step_number, type, message, data_json, created_at)
      VALUES ($id, $runId, $stepNumber, $type, $message, $dataJson, datetime('now'))
    `).run({
      $id: input.id,
      $runId: input.runId,
      $stepNumber: input.stepNumber ?? null,
      $type: input.type,
      $message: input.message,
      $dataJson: input.data ? JSON.stringify(input.data) : null,
    });

    return signalsRepo.getById(input.id)!;
  },

  getById(id: string): Signal | null {
    const row = db
      .prepare(
        `SELECT id, run_id as runId, step_number as stepNumber, type,
                message, data_json as dataJson, created_at as timestamp
         FROM signals WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      runId: row.runId,
      stepNumber: row.stepNumber,
      type: row.type,
      message: row.message,
      data: row.dataJson ? JSON.parse(row.dataJson) : undefined,
      timestamp: row.timestamp,
    };
  },

  listByRunId(runId: string): Signal[] {
    const rows = db
      .prepare(
        `SELECT id, run_id as runId, step_number as stepNumber, type,
                message, data_json as dataJson, created_at as timestamp
         FROM signals WHERE run_id = ? ORDER BY created_at ASC`
      )
      .all(runId) as any[];

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      stepNumber: row.stepNumber,
      type: row.type,
      message: row.message,
      data: row.dataJson ? JSON.parse(row.dataJson) : undefined,
      timestamp: row.timestamp,
    }));
  },

  countByRunId(runId: string): number {
    const row = db.prepare('SELECT COUNT(*) as count FROM signals WHERE run_id = ?').get(runId) as {
      count: number;
    };
    return row?.count ?? 0;
  },
};
