import type { Scenario, ScenarioCoverage, ScenarioStatus } from '@gremlin/shared';
import { db } from '../client';

export const scenariosRepo = {
  create(scenario: Scenario): Scenario {
    db.prepare(`
      INSERT INTO scenarios (
        id, run_id, idx, title, goal, persona_id, viewport, needs_auth,
        risk, max_steps, expect_json, source, enabled, status, verdict, created_at
      )
      VALUES (
        $id, $runId, $idx, $title, $goal, $personaId, $viewport, $needsAuth,
        $risk, $maxSteps, $expectJson, $source, $enabled, $status, $verdict, datetime('now')
      )
    `).run({
      $id: scenario.id,
      $runId: scenario.runId,
      $idx: scenario.idx,
      $title: scenario.title,
      $goal: scenario.goal,
      $personaId: scenario.personaId || 'gremlin',
      $viewport: scenario.viewport || 'desktop',
      $needsAuth: scenario.needsAuth ? 1 : 0,
      $risk: scenario.risk || 'low',
      $maxSteps: scenario.maxSteps || 8,
      $expectJson: JSON.stringify(scenario.expect || []),
      $source: scenario.source || 'ai',
      $enabled: scenario.enabled ? 1 : 0,
      $status: scenario.status || 'pending',
      $verdict: scenario.verdict ?? null,
    });

    return scenariosRepo.getById(scenario.id)!;
  },

  bulkCreate(scenarios: Scenario[]): Scenario[] {
    const insert = db.prepare(`
      INSERT INTO scenarios (
        id, run_id, idx, title, goal, persona_id, viewport, needs_auth,
        risk, max_steps, expect_json, source, enabled, status, verdict, created_at
      )
      VALUES (
        $id, $runId, $idx, $title, $goal, $personaId, $viewport, $needsAuth,
        $risk, $maxSteps, $expectJson, $source, $enabled, $status, $verdict, datetime('now')
      )
    `);

    db.transaction(() => {
      for (const s of scenarios) {
        insert.run({
          $id: s.id,
          $runId: s.runId,
          $idx: s.idx,
          $title: s.title,
          $goal: s.goal,
          $personaId: s.personaId || 'gremlin',
          $viewport: s.viewport || 'desktop',
          $needsAuth: s.needsAuth ? 1 : 0,
          $risk: s.risk || 'low',
          $maxSteps: s.maxSteps || 8,
          $expectJson: JSON.stringify(s.expect || []),
          $source: s.source || 'ai',
          $enabled: s.enabled ? 1 : 0,
          $status: s.status || 'pending',
          $verdict: s.verdict ?? null,
        });
      }
    })();

    return scenarios.map((s) => scenariosRepo.getById(s.id)!);
  },

  getById(id: string): Scenario | null {
    const row = db
      .prepare(
        `SELECT id, run_id as runId, idx, title, goal, persona_id as personaId,
                viewport, needs_auth as needsAuth, risk, max_steps as maxSteps,
                expect_json as expectJson, source, enabled, status, verdict,
                created_at as createdAt
         FROM scenarios WHERE id = ?`
      )
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      runId: row.runId,
      idx: row.idx,
      title: row.title,
      goal: row.goal,
      personaId: row.personaId,
      viewport: row.viewport,
      needsAuth: Boolean(row.needsAuth),
      risk: row.risk,
      maxSteps: row.maxSteps,
      expect: JSON.parse(row.expectJson || '[]'),
      source: row.source,
      enabled: Boolean(row.enabled),
      status: row.status,
      verdict: row.verdict,
      createdAt: row.createdAt,
    };
  },

  listByRunId(runId: string): Scenario[] {
    const rows = db
      .prepare(
        `SELECT id, run_id as runId, idx, title, goal, persona_id as personaId,
                viewport, needs_auth as needsAuth, risk, max_steps as maxSteps,
                expect_json as expectJson, source, enabled, status, verdict,
                created_at as createdAt
         FROM scenarios WHERE run_id = ? ORDER BY idx ASC`
      )
      .all(runId) as any[];

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      idx: row.idx,
      title: row.title,
      goal: row.goal,
      personaId: row.personaId,
      viewport: row.viewport,
      needsAuth: Boolean(row.needsAuth),
      risk: row.risk,
      maxSteps: row.maxSteps,
      expect: JSON.parse(row.expectJson || '[]'),
      source: row.source,
      enabled: Boolean(row.enabled),
      status: row.status,
      verdict: row.verdict,
      createdAt: row.createdAt,
    }));
  },

  update(id: string, partial: Partial<Scenario>): Scenario | null {
    const current = scenariosRepo.getById(id);
    if (!current) return null;

    const updated: Scenario = {
      ...current,
      ...partial,
      expect: partial.expect !== undefined ? partial.expect : current.expect,
    };

    db.prepare(`
      UPDATE scenarios
      SET title = $title,
          goal = $goal,
          persona_id = $personaId,
          viewport = $viewport,
          needs_auth = $needsAuth,
          risk = $risk,
          max_steps = $maxSteps,
          expect_json = $expectJson,
          enabled = $enabled,
          status = $status,
          verdict = $verdict
      WHERE id = $id
    `).run({
      $id: id,
      $title: updated.title,
      $goal: updated.goal,
      $personaId: updated.personaId || 'gremlin',
      $viewport: updated.viewport || 'desktop',
      $needsAuth: updated.needsAuth ? 1 : 0,
      $risk: updated.risk,
      $maxSteps: updated.maxSteps,
      $expectJson: JSON.stringify(updated.expect),
      $enabled: updated.enabled ? 1 : 0,
      $status: updated.status,
      $verdict: updated.verdict ?? null,
    });

    return scenariosRepo.getById(id);
  },

  updateStatus(id: string, status: ScenarioStatus, verdict?: string | null): Scenario | null {
    db.prepare(`
      UPDATE scenarios
      SET status = $status,
          verdict = $verdict
      WHERE id = $id
    `).run({
      $id: id,
      $status: status,
      $verdict: verdict !== undefined ? verdict : null,
    });

    return scenariosRepo.getById(id);
  },

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM scenarios WHERE id = ?').run(id);
    return result.changes > 0;
  },

  reorder(runId: string, orderedIds: string[]): Scenario[] {
    const update = db.prepare('UPDATE scenarios SET idx = ? WHERE id = ? AND run_id = ?');
    db.transaction(() => {
      orderedIds.forEach((id, idx) => {
        update.run(idx, id, runId);
      });
    })();

    return scenariosRepo.listByRunId(runId);
  },

  getCoverage(runId: string): ScenarioCoverage {
    const scenarios = scenariosRepo.listByRunId(runId);
    const total = scenarios.length;
    const enabled = scenarios.filter((s) => s.enabled).length;
    const passed = scenarios.filter((s) => s.status === 'passed').length;
    const failed = scenarios.filter((s) => s.status === 'failed').length;
    const blocked = scenarios.filter((s) => s.status === 'blocked').length;
    const skipped = scenarios.filter((s) => s.status === 'skipped').length;
    const pending = scenarios.filter((s) => s.status === 'pending').length;

    const evaluated = passed + failed + blocked;
    const percentage = enabled > 0 ? Math.round((evaluated / enabled) * 100) : 0;

    return {
      total,
      enabled,
      passed,
      failed,
      blocked,
      skipped,
      pending,
      percentage,
    };
  },
};
