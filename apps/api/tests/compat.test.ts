import { describe, expect, it } from 'bun:test';
import { app } from '../src/index';
import { runsRepo } from '../src/db/repo/runs';
import { stepsRepo } from '../src/db/repo/steps';
import { signalsRepo } from '../src/db/repo/signals';
import { findingsRepo } from '../src/db/repo/findings';
import { eventBus } from '../src/lib/events';
import { storage } from '../src/lib/storage';

describe('Gremlin Compatibility & API Tests', () => {
  it('should respond 200 OK on /health', async () => {
    const res = await app.handle(new Request('http://localhost:3001/health'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('gremlin-api');
  });

  it('should list available personas on /personas', async () => {
    const res = await app.handle(new Request('http://localhost:3001/personas'));
    expect(res.status).toBe(200);
    const personas = await res.json();
    expect(Array.isArray(personas)).toBe(true);
    expect(personas.length).toBeGreaterThanOrEqual(4);
    const gremlin = personas.find((p: any) => p.id === 'gremlin');
    expect(gremlin).toBeDefined();
    expect(gremlin.chaosLevel).toBe(0.9);
  });

  it('should perform CRUD operations on SQLite repositories', () => {
    const testRunId = `test-${Date.now()}`;

    // 1. Create Run
    const run = runsRepo.create({
      id: testRunId,
      url: 'http://localhost:3000',
      personaId: 'gremlin',
      maxSteps: 5,
    });
    expect(run.id).toBe(testRunId);
    expect(run.status).toBe('queued');

    // 2. Add Step
    const step = stepsRepo.create({
      id: `step-${Date.now()}`,
      runId: testRunId,
      stepNumber: 1,
      action: { type: 'click', selector: '#btn-submit' },
      thought: 'Testing click action',
      durationMs: 120,
    });
    expect(step.runId).toBe(testRunId);
    expect(step.stepNumber).toBe(1);

    // 3. Add Signal
    const signal = signalsRepo.create({
      id: `sig-${Date.now()}`,
      runId: testRunId,
      stepNumber: 1,
      type: 'console_error',
      message: 'Uncaught TypeError in chunk.js',
    });
    expect(signal.type).toBe('console_error');

    // 4. Add Finding
    const finding = findingsRepo.create({
      id: `find-${Date.now()}`,
      runId: testRunId,
      title: 'Crash on Button Click',
      description: 'Unhandled TypeError on click',
      severity: 'CRITICAL',
      category: 'crash',
      reproductionSteps: ['1. Click #btn-submit'],
      suggestedFix: 'Add null check',
      firstDetectedStep: 1,
    });
    expect(finding.severity).toBe('CRITICAL');

    // Query listings
    const retrievedRun = runsRepo.getById(testRunId);
    expect(retrievedRun).not.toBeNull();
    expect(stepsRepo.listByRunId(testRunId).length).toBe(1);
    expect(signalsRepo.listByRunId(testRunId).length).toBe(1);
    expect(findingsRepo.listByRunId(testRunId).length).toBe(1);
  });

  it('should handle eventBus pub/sub and persistence', () => {
    const testRunId = `bus-test-${Date.now()}`;
    // Insert run to satisfy foreign key constraint
    runsRepo.create({
      id: testRunId,
      url: 'http://localhost:3000',
      personaId: 'gremlin',
    });

    let received = false;

    const unsubscribe = eventBus.subscribe(testRunId, (evt) => {
      if (evt.type === 'run:started') {
        received = true;
      }
    });

    eventBus.emitRunEvent({
      type: 'run:started',
      runId: testRunId,
      timestamp: new Date().toISOString(),
      data: { run: { id: testRunId, url: 'http://localhost:3000' } as any },
    });

    unsubscribe();
    expect(received).toBe(true);

    const history = eventBus.getHistory(testRunId);
    expect(history.length).toBeGreaterThanOrEqual(1);
  });

  it('should generate valid storage paths', () => {
    const runId = 'test-run-storage';
    const screenshotPath = storage.getStepScreenshotPath(runId, 1);
    expect(screenshotPath).toContain('runs/test-run-storage/steps/001.png');
    const specPath = storage.getRegressionSpecPath(runId);
    expect(specPath).toContain('regression.spec.ts');
  });
});
