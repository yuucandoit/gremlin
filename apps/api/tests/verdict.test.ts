import { describe, expect, it } from 'bun:test';
import type { Scenario, Signal, Step } from '@gremlin/shared';
import { evaluateScenarioVerdict } from '../src/agent/verdict';

describe('Honest Scenario Verdict Evaluation (Zero Fake Passes)', () => {
  const baseScenario: Scenario = {
    id: 'sc-test-1',
    runId: 'run-verdict-1',
    idx: 0,
    title: 'Checkout Test',
    goal: 'Verifikasi checkout produk',
    personaId: 'gremlin',
    viewport: 'desktop',
    needsAuth: false,
    authMode: 'none',
    risk: 'low',
    maxSteps: 5,
    expect: ['hanya satu order terbuat', 'tidak ada error di console'],
    source: 'ai',
    enabled: true,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  it('should mark scenario as failed when deterministic critical signals (HTTP 500 / unhandled rejection) occur', async () => {
    const errorSignal: Signal = {
      id: 'sig-1',
      runId: 'run-verdict-1',
      stepNumber: 1,
      type: 'http_5xx',
      message: 'HTTP 500 Internal Server Error at /api/checkout',
      severity: 'critical',
      timestamp: new Date().toISOString(),
    };

    const res = await evaluateScenarioVerdict(baseScenario, [errorSignal], []);
    expect(res.status).toBe('failed');
    expect(res.verdict).toContain('Gagal:');
    expect(res.checks.some((c) => c.result === 'violated')).toBe(true);
  });

  it('should mark scenario as failed when severe console errors occur', async () => {
    const consoleErrorSignal: Signal = {
      id: 'sig-2',
      runId: 'run-verdict-1',
      stepNumber: 2,
      type: 'console_error',
      message: 'Uncaught TypeError: Cannot read properties of undefined',
      severity: 'high',
      timestamp: new Date().toISOString(),
    };

    const res = await evaluateScenarioVerdict(baseScenario, [consoleErrorSignal], []);
    expect(res.status).toBe('failed');
    expect(res.verdict).toContain('Gagal:');
  });

  it('should return inconclusive instead of fake passed when positive criteria cannot be verified without LLM', async () => {
    // Scenario requires proving positive claim: 'hanya satu order terbuat'
    const positiveScenario: Scenario = {
      ...baseScenario,
      expect: ['hanya satu order terbuat'],
    };

    const res = await evaluateScenarioVerdict(positiveScenario, [], []);
    expect(res.status).toBe('inconclusive');
    expect(res.verdict).toContain('Belum terverifikasi');
    expect(res.checks[0].result).toBe('unknown');
  });

  it('should return passed when all criteria are purely negative assertions and no violations occurred', async () => {
    const negativeScenario: Scenario = {
      ...baseScenario,
      expect: ['tidak ada error di console', 'tidak ada http 500'],
    };

    const res = await evaluateScenarioVerdict(negativeScenario, [], []);
    expect(res.status).toBe('passed');
    expect(res.verdict).toContain('Lulus');
    expect(res.checks.every((c) => c.result === 'met')).toBe(true);
  });
});

