import { describe, expect, it } from 'bun:test';
import { runsRepo } from '../src/db/repo/runs';
import { stepsRepo } from '../src/db/repo/steps';
import { sessionManager } from '../src/lib/session';
import { exportRegressionSpec } from '../src/report/exportSpec';

describe('Gremlin Playground (Interactive Co-Pilot & Pause-and-Click Takeover)', () => {
  it('should persist steps with actor="human" and actor="agent"', () => {
    const runId = `test-pg-${Date.now()}`;
    runsRepo.create({
      id: runId,
      url: 'http://localhost:3002',
      personaId: 'gremlin',
      maxSteps: 5,
    });

    // 1. Agent step
    const agentStep = stepsRepo.create({
      id: crypto.randomUUID(),
      runId,
      stepNumber: 1,
      actor: 'agent',
      action: { type: 'navigate', url: 'http://localhost:3002' },
      thought: 'Initial exploration step by Meta Muse Spark',
      durationMs: 120,
    });
    expect(agentStep.actor).toBe('agent');

    // 2. Human step
    const humanStep = stepsRepo.create({
      id: crypto.randomUUID(),
      runId,
      stepNumber: 2,
      actor: 'human',
      action: { type: 'click', selector: '#btn-view-cart' },
      thought: '[Human Co-Pilot] Clicked at coordinates (450, 320) on #btn-view-cart',
      durationMs: 50,
    });
    expect(humanStep.actor).toBe('human');

    // 3. Query list
    const steps = stepsRepo.listByRunId(runId);
    expect(steps.length).toBe(2);
    expect(steps[0].actor).toBe('agent');
    expect(steps[1].actor).toBe('human');
  });

  it('should generate Playwright regression spec differentiating human co-pilot vs agent steps', () => {
    const runId = `test-spec-${Date.now()}`;
    const steps = [
      {
        id: '1',
        runId,
        stepNumber: 1,
        actor: 'agent' as const,
        action: { type: 'navigate' as const, url: 'http://localhost:3002' },
        thought: 'Agent navigated to store',
        durationMs: 100,
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        runId,
        stepNumber: 2,
        actor: 'human' as const,
        action: { type: 'click' as const, selector: '#nav-login' },
        thought: 'Human clicked Sign In',
        durationMs: 50,
        timestamp: new Date().toISOString(),
      },
      {
        id: '3',
        runId,
        stepNumber: 3,
        actor: 'human' as const,
        action: { type: 'type' as const, selector: '#input-login-email', text: 'admin@glitchmart.com' },
        thought: 'Human entered credentials',
        durationMs: 200,
        timestamp: new Date().toISOString(),
      },
    ];

    const spec = exportRegressionSpec(runId, 'http://localhost:3002', steps as any, [], 'mobile');
    expect(spec).toContain('[GREMLIN AI]: Navigate');
    expect(spec).toContain('[HUMAN CO-PILOT]: Click');
    expect(spec).toContain('[HUMAN CO-PILOT]: Type');
    expect(spec).toContain('await page.setViewportSize({ width: 390, height: 844 });');
  });

  it('should handle pause, resume, and guidance storage in sessionManager', () => {
    const testRunId = `session-test-${Date.now()}`;
    runsRepo.create({
      id: testRunId,
      url: 'http://localhost:3002',
      personaId: 'gremlin',
      maxSteps: 5,
    });

    // Mock page & context
    const mockPage: any = {
      viewportSize: () => ({ width: 1280, height: 800 }),
    };
    const mockContext: any = {};

    sessionManager.register(testRunId, mockPage, mockContext);
    expect(sessionManager.isPaused(testRunId)).toBe(false);

    // Pause
    const paused = sessionManager.pause(testRunId);
    expect(paused).toBe(true);
    expect(sessionManager.isPaused(testRunId)).toBe(true);

    const updatedRun = runsRepo.getById(testRunId);
    expect(updatedRun?.status).toBe('paused');

    // Steering guidance
    sessionManager.setGuidance(testRunId, 'Test negative quantity in cart', '#btn-dec-qty-1');
    const guidance = sessionManager.consumeGuidance(testRunId);
    expect(guidance.instruction).toBe('Test negative quantity in cart');
    expect(guidance.targetSelector).toBe('#btn-dec-qty-1');

    // Consumed guidance should be cleared
    const emptyGuidance = sessionManager.consumeGuidance(testRunId);
    expect(emptyGuidance.instruction).toBeNull();

    // Resume
    const resumed = sessionManager.resume(testRunId);
    expect(resumed).toBe(true);
    expect(sessionManager.isPaused(testRunId)).toBe(false);

    const resumedRun = runsRepo.getById(testRunId);
    expect(resumedRun?.status).toBe('running');

    sessionManager.unregister(testRunId);
  });
});
