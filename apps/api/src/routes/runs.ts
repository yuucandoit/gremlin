import type { CreateRunRequest } from '@gremlin/shared';
import { Elysia, t } from 'elysia';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findingsRepo } from '../db/repo/findings';
import { runsRepo } from '../db/repo/runs';
import { signalsRepo } from '../db/repo/signals';
import { stepsRepo } from '../db/repo/steps';
import { runQueue } from '../lib/queue';
import { storage } from '../lib/storage';

export const runsRoutes = new Elysia({ prefix: '/runs' })
  // List all runs
  .get('/', () => {
    return runsRepo.list();
  })

  // Create a new run
  .post(
    '/',
    async ({ body, set }) => {
      const { url, personaId, maxSteps, timeoutMs } = body as CreateRunRequest;

      if (!url) {
        set.status = 400;
        return { error: 'Target URL is required' };
      }

      const id = crypto.randomUUID();
      const run = runsRepo.create({
        id,
        url,
        personaId: personaId || 'gremlin',
        maxSteps: maxSteps || 20,
        timeoutMs: timeoutMs || 60000,
      });

      // Enqueue the run for background execution
      runQueue.enqueue(id);

      set.status = 201;
      return run;
    },
    {
      body: t.Object({
        url: t.String(),
        personaId: t.Optional(t.String()),
        maxSteps: t.Optional(t.Number()),
        timeoutMs: t.Optional(t.Number()),
        chaosMode: t.Optional(t.Boolean()),
      }),
    }
  )

  // Get run detail with steps and findings
  .get('/:id', ({ params: { id }, set }) => {
    const run = runsRepo.getById(id);
    if (!run) {
      set.status = 404;
      return { error: 'Run not found' };
    }

    const steps = stepsRepo.listByRunId(id);
    const signals = signalsRepo.listByRunId(id);
    const findings = findingsRepo.listByRunId(id);

    return {
      run,
      steps,
      signals,
      findings,
    };
  })

  // Cancel an active run
  .post('/:id/cancel', ({ params: { id }, set }) => {
    const run = runsRepo.getById(id);
    if (!run) {
      set.status = 404;
      return { error: 'Run not found' };
    }

    if (run.status === 'running' || run.status === 'queued') {
      runsRepo.updateStatus(id, 'cancelled');
    }

    return { success: true, message: 'Run cancelled' };
  })

  // Serve run artifacts (screenshots, regression spec)
  .get('/:id/artifacts/*', ({ params, set }) => {
    const runId = params.id;
    const wildcard = (params as any)['*'] as string;
    const filePath = join(storage.getRunDir(runId), wildcard);

    if (!existsSync(filePath)) {
      set.status = 404;
      return 'Artifact not found';
    }

    if (filePath.endsWith('.png')) {
      set.headers['Content-Type'] = 'image/png';
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      set.headers['Content-Type'] = 'text/plain; charset=utf-8';
    } else if (filePath.endsWith('.zip')) {
      set.headers['Content-Type'] = 'application/zip';
    }

    return Bun.file(filePath);
  });
