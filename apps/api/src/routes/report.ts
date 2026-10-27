import type { RunReport } from '@gremlin/shared';
import { Elysia } from 'elysia';
import { existsSync, readFileSync } from 'node:fs';
import { getPersona } from '../agent/personas';
import { findingsRepo } from '../db/repo/findings';
import { runsRepo } from '../db/repo/runs';
import { scenariosRepo } from '../db/repo/scenarios';
import { signalsRepo } from '../db/repo/signals';
import { stepsRepo } from '../db/repo/steps';
import { storage } from '../lib/storage';

export const reportRoutes = new Elysia({ prefix: '/runs' }).get(
  '/:id/report',
  ({ params: { id }, set }) => {
    const run = runsRepo.getById(id);
    if (!run) {
      set.status = 404;
      return { error: 'Run not found' };
    }

    const persona = getPersona(run.personaId);
    const steps = stepsRepo.listByRunId(id);
    const signals = signalsRepo.listByRunId(id);
    const findings = findingsRepo.listByRunId(id);
    const scenarios = scenariosRepo.listByRunId(id);
    const coverage = scenariosRepo.getCoverage(id);

    // Read regression spec if generated
    let regressionSpec = '';
    const specPath = storage.getRegressionSpecPath(id);
    if (existsSync(specPath)) {
      regressionSpec = readFileSync(specPath, 'utf-8');
    }

    const durationMs = steps.reduce((acc, s) => acc + (s.durationMs || 0), 0);

    const report: RunReport = {
      run,
      persona,
      scenarios,
      coverage,
      steps,
      signals,
      findings,
      regressionSpec,
      stats: {
        durationMs,
        totalSteps: steps.length,
        totalSignals: signals.length,
        totalFindings: findings.length,
        criticalCount: findings.filter((f) => f.severity === 'CRITICAL').length,
        highCount: findings.filter((f) => f.severity === 'HIGH').length,
        mediumCount: findings.filter((f) => f.severity === 'MEDIUM').length,
        lowCount: findings.filter((f) => f.severity === 'LOW').length,
        visualCount: findings.filter((f) => f.category === 'visual').length,
      },
    };

    return report;
  }
);
