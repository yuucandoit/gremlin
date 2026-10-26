import type { Finding, FindingCategory, Severity } from '@gremlin/shared';
import { db } from '../client';

export interface CreateFindingInput {
  id: string;
  runId: string;
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  reproductionSteps: string[];
  suggestedFix: string;
  firstDetectedStep: number;
  evidence?: Record<string, any>;
}

export const findingsRepo = {
  create(input: CreateFindingInput): Finding {
    db.prepare(`
      INSERT INTO findings (id, run_id, title, description, severity, category, reproduction_steps_json, suggested_fix, first_detected_step, evidence_json, created_at)
      VALUES ($id, $runId, $title, $description, $severity, $category, $reproductionStepsJson, $suggestedFix, $firstDetectedStep, $evidenceJson, datetime('now'))
    `).run({
      $id: input.id,
      $runId: input.runId,
      $title: input.title,
      $description: input.description,
      $severity: input.severity,
      $category: input.category,
      $reproductionStepsJson: JSON.stringify(input.reproductionSteps),
      $suggestedFix: input.suggestedFix,
      $firstDetectedStep: input.firstDetectedStep,
      $evidenceJson: input.evidence ? JSON.stringify(input.evidence) : null,
    });

    return findingsRepo.getById(input.id)!;
  },

  getById(id: string): Finding | null {
    const row = db
      .prepare(
        `SELECT id, run_id as runId, title, description, severity, category,
                reproduction_steps_json as reproductionStepsJson, suggested_fix as suggestedFix,
                first_detected_step as firstDetectedStep, evidence_json as evidenceJson,
                created_at as timestamp
         FROM findings WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      runId: row.runId,
      title: row.title,
      description: row.description,
      severity: row.severity,
      category: row.category,
      reproductionSteps: JSON.parse(row.reproductionStepsJson),
      suggestedFix: row.suggestedFix,
      firstDetectedStep: row.firstDetectedStep,
      evidence: row.evidenceJson ? JSON.parse(row.evidenceJson) : undefined,
      timestamp: row.timestamp,
    };
  },

  listByRunId(runId: string): Finding[] {
    const rows = db
      .prepare(
        `SELECT id, run_id as runId, title, description, severity, category,
                reproduction_steps_json as reproductionStepsJson, suggested_fix as suggestedFix,
                first_detected_step as firstDetectedStep, evidence_json as evidenceJson,
                created_at as timestamp
         FROM findings WHERE run_id = ? ORDER BY
          CASE severity
            WHEN 'CRITICAL' THEN 1
            WHEN 'HIGH' THEN 2
            WHEN 'MEDIUM' THEN 3
            WHEN 'LOW' THEN 4
            ELSE 5
          END ASC`
      )
      .all(runId) as any[];

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      title: row.title,
      description: row.description,
      severity: row.severity,
      category: row.category,
      reproductionSteps: JSON.parse(row.reproductionStepsJson),
      suggestedFix: row.suggestedFix,
      firstDetectedStep: row.firstDetectedStep,
      evidence: row.evidenceJson ? JSON.parse(row.evidenceJson) : undefined,
      timestamp: row.timestamp,
    }));
  },

  clearByRunId(runId: string): void {
    db.prepare('DELETE FROM findings WHERE run_id = ?').run(runId);
  },
};
