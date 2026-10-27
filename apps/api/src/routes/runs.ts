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
import { streamManager } from '../lib/stream';
import { sessionManager } from '../lib/session';

export const runsRoutes = new Elysia({ prefix: '/runs' })
  // List all runs
  .get('/', () => {
    return runsRepo.list();
  })

  // Delete all runs from history
  .delete('/', () => {
    const count = runsRepo.clearAll();
    storage.clearAllRunsDir();
    return { success: true, count, message: `Cleared ${count} run(s) from history.` };
  })

  // Create a new run
  .post(
    '/',
    async ({ body, set }) => {
      const { url, personaId, maxSteps, timeoutMs, viewport } = body as CreateRunRequest;

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
        viewport: viewport || 'desktop',
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
        viewport: t.Optional(t.Union([t.Literal('desktop'), t.Literal('mobile')])),
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

  // Delete a specific run and its artifacts
  .delete('/:id', ({ params: { id }, set }) => {
    const run = runsRepo.getById(id);
    if (!run) {
      set.status = 404;
      return { error: 'Run not found' };
    }

    sessionManager.unregister(id);
    if (run.status === 'running' || run.status === 'queued' || run.status === 'paused') {
      runsRepo.updateStatus(id, 'cancelled');
    }

    const deleted = runsRepo.delete(id);
    storage.deleteRunDir(id);

    return { success: deleted, message: 'Run and associated artifacts deleted successfully' };
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

  // Pause active run (Gremlin Playground Mode)
  .post('/:id/pause', ({ params: { id }, set }) => {
    const success = sessionManager.pause(id);
    if (!success) {
      set.status = 400;
      return { error: 'Unable to pause run (not active or already paused)' };
    }
    return { success: true, status: 'paused', message: 'Gremlin Playground active. Manual takeover enabled.' };
  })

  // Resume paused run
  .post('/:id/resume', ({ params: { id }, set }) => {
    const success = sessionManager.resume(id);
    if (!success) {
      set.status = 400;
      return { error: 'Unable to resume run (not paused)' };
    }
    return { success: true, status: 'running', message: 'Autonomous agent resumed.' };
  })

  // Manual interactive input in Playground
  .post(
    '/:id/input',
    async ({ params: { id }, body, set }) => {
      try {
        const step = await sessionManager.sendInput(id, body as any);
        return { success: true, step };
      } catch (err: any) {
        set.status = 400;
        return { error: err?.message || String(err) };
      }
    },
    {
      body: t.Object({
        type: t.Union([
          t.Literal('click'),
          t.Literal('double_click'),
          t.Literal('type'),
          t.Literal('press_key'),
          t.Literal('scroll'),
        ]),
        x: t.Optional(t.Number()),
        y: t.Optional(t.Number()),
        selector: t.Optional(t.String()),
        text: t.Optional(t.String()),
        key: t.Optional(t.String()),
        deltaX: t.Optional(t.Number()),
        deltaY: t.Optional(t.Number()),
      }),
    }
  )

  // Inspect element under coordinate
  .post(
    '/:id/inspect',
    async ({ params: { id }, body, set }) => {
      const { x, y } = body as { x: number; y: number };
      const result = await sessionManager.inspectAt(id, x, y);
      if (!result) {
        set.status = 404;
        return { error: 'No element detected at coordinates' };
      }
      return result;
    },
    {
      body: t.Object({
        x: t.Number(),
        y: t.Number(),
      }),
    }
  )

  // Submit steering guidance prompt
  .post(
    '/:id/instruct',
    ({ params: { id }, body }) => {
      const { instruction, targetSelector } = body as { instruction: string; targetSelector?: string };
      sessionManager.setGuidance(id, instruction, targetSelector);
      return { success: true, message: 'Steering instruction received by Meta Muse Spark' };
    },
    {
      body: t.Object({
        instruction: t.String(),
        targetSelector: t.Optional(t.String()),
      }),
    }
  )

  // Live MJPEG Chromium stream
  .get('/:id/stream', ({ params: { id }, set }) => {
    set.headers['Content-Type'] = 'multipart/x-mixed-replace; boundary=--frame';
    set.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    set.headers['Connection'] = 'keep-alive';
    set.headers['Pragma'] = 'no-cache';
    set.headers['Access-Control-Allow-Origin'] = '*';

    let cleanup: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        cleanup = streamManager.registerClient(id, controller);
      },
      cancel() {
        if (cleanup) cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
      },
    });
  })

  // Single latest snapshot frame or fallback screenshot
  .get('/:id/stream/frame', ({ params: { id }, set }) => {
    const frame = streamManager.getLatestFrame(id);
    if (frame) {
      set.headers['Content-Type'] = 'image/jpeg';
      set.headers['Cache-Control'] = 'no-cache';
      return new Response(frame);
    }

    // Fallback to the latest step screenshot if exists
    const steps = stepsRepo.listByRunId(id);
    const lastStep = [...steps].reverse().find((s) => s.screenshotPath);
    if (lastStep?.screenshotPath) {
      const filePath = join(storage.getRunDir(id), lastStep.screenshotPath);
      if (existsSync(filePath)) {
        set.headers['Content-Type'] = 'image/png';
        return Bun.file(filePath);
      }
    }

    set.status = 404;
    return 'No frame available';
  })

  // Active stream status info
  .get('/:id/stream/status', ({ params: { id } }) => {
    const run = runsRepo.getById(id);
    const hasFrame = !!streamManager.getLatestFrame(id);
    return {
      runId: id,
      isRunning: run?.status === 'running',
      currentUrl: streamManager.getCurrentUrl(id) || run?.url,
      hasFrame,
    };
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
    } else if (filePath.endsWith('.svg')) {
      set.headers['Content-Type'] = 'image/svg+xml';
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
      set.headers['Content-Type'] = 'text/plain; charset=utf-8';
    } else if (filePath.endsWith('.zip')) {
      set.headers['Content-Type'] = 'application/zip';
    }

    return Bun.file(filePath);
  });
