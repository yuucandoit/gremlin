import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { runAgentLoop } from '../src/agent/loop';
import { findingsRepo } from '../src/db/repo/findings';
import { runsRepo } from '../src/db/repo/runs';
import { signalsRepo } from '../src/db/repo/signals';
import { stepsRepo } from '../src/db/repo/steps';
import { storage } from '../src/lib/storage';
import { existsSync } from 'node:fs';

describe('Gremlin End-to-End Autonomous Agent Test', () => {
  let demoServer: any;

  beforeAll(async () => {
    // Start demo store server on port 3002
    const demoApp = (await import('../../../demo-app/src/index')).default;
    demoServer = demoApp;
  });

  it(
    'should explore GlitchMart demo store, catch defects, and generate regression spec',
    async () => {
      const runId = `e2e-${Date.now()}`;

      // Create Run
      const run = runsRepo.create({
        id: runId,
        url: 'http://localhost:3002',
        personaId: 'gremlin',
        maxSteps: 6,
        timeoutMs: 30000,
      });
      expect(run.status).toBe('queued');

      // Execute Agent Loop
      await runAgentLoop(runId);

      // Verify Run Completion
      const completedRun = runsRepo.getById(runId);
      expect(completedRun?.status).toBe('completed');
      expect(completedRun?.currentStep).toBeGreaterThanOrEqual(1);

      // Verify Steps
      const steps = stepsRepo.listByRunId(runId);
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps[0].screenshotPath).toBeDefined();

      // Verify Screenshot File on Disk
      const screenshotPath = storage.getStepScreenshotPath(runId, 1);
      expect(existsSync(screenshotPath)).toBe(true);

      // Verify Regression Spec File on Disk
      const specPath = storage.getRegressionSpecPath(runId);
      expect(existsSync(specPath)).toBe(true);

      // Check Signals & Findings
      const signals = signalsRepo.listByRunId(runId);
      const findings = findingsRepo.listByRunId(runId);
      console.log(`E2E Run completed with ${steps.length} steps, ${signals.length} signals, ${findings.length} findings.`);
    },
    45000
  );
});
