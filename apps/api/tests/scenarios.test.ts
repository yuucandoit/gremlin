import { describe, expect, it } from 'bun:test';
import { runsRepo } from '../src/db/repo/runs';
import { scenariosRepo } from '../src/db/repo/scenarios';
import { stepsRepo } from '../src/db/repo/steps';
import { findingsRepo } from '../src/db/repo/findings';
import { sessionManager } from '../src/lib/session';
import { parseScenarioFromPrompt } from '../src/agent/recon';

describe('Plan-Driven Execution & Scenario Backbone', () => {
  it('should create and retrieve structured test scenarios', () => {
    const runId = `test-run-${Date.now()}`;
    runsRepo.create({
      id: runId,
      url: 'http://localhost:3002',
      personaId: 'gremlin',
      autoApprove: false,
    });

    const sId = crypto.randomUUID();
    const scenario = scenariosRepo.create({
      id: sId,
      runId,
      idx: 0,
      title: 'Checkout dengan klik ganda',
      goal: 'Selesaikan pembelian dan klik Place Order dua kali cepat',
      personaId: 'speed-demon',
      viewport: 'desktop',
      needsAuth: false,
      risk: 'low',
      maxSteps: 8,
      expect: ['hanya satu order terbuat', 'tidak ada error di console'],
      source: 'ai',
      enabled: true,
      status: 'pending',
      verdict: null,
      createdAt: new Date().toISOString(),
    });

    expect(scenario.id).toBe(sId);
    expect(scenario.expect.length).toBe(2);
    expect(scenario.enabled).toBe(true);
    expect(scenario.status).toBe('pending');

    const fetched = scenariosRepo.getById(sId);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Checkout dengan klik ganda');
    expect(fetched?.expect).toContain('hanya satu order terbuat');
  });

  it('should disable high risk scenarios by default', () => {
    const runId = `test-risk-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002', personaId: 'gremlin' });

    const sHighId = crypto.randomUUID();
    const highRiskScenario = scenariosRepo.create({
      id: sHighId,
      runId,
      idx: 1,
      title: 'Reset database dan hapus akun pengguna',
      goal: 'Lakukan penghapusan akun berulang kali',
      personaId: 'gremlin',
      viewport: 'desktop',
      needsAuth: true,
      risk: 'high',
      maxSteps: 5,
      expect: ['Konfirmasi muncul'],
      source: 'template',
      enabled: false, // Default off for high risk
      status: 'pending',
      verdict: null,
      createdAt: new Date().toISOString(),
    });

    expect(highRiskScenario.risk).toBe('high');
    expect(highRiskScenario.enabled).toBe(false);
  });

  it('should parse natural language prompts into structured scenarios', async () => {
    const runId = `test-parse-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002', personaId: 'gremlin' });

    // 1. Double click prompt -> speed_demon persona
    const s1 = await parseScenarioFromPrompt('coba checkout dengan klik cepat double submit', runId, 0);
    expect(s1.personaId).toBe('speed_demon');
    expect(s1.expect.length).toBeGreaterThan(0);
    expect(s1.source).toBe('user');

    // 2. High risk keyword prompt (bayar / hapus) -> risk 'high' and disabled by default
    const s2 = await parseScenarioFromPrompt('coba bayar tagihan dengan data dummy kartu kredit', runId, 1);
    expect(s2.risk).toBe('high');
    expect(s2.enabled).toBe(false);

    // 3. Negative testing / coupon keyword prompt -> skeptic persona
    const s3 = await parseScenarioFromPrompt('uji kupon diskon dengan nilai minus dan boundary', runId, 2);
    expect(s3.personaId).toBe('skeptic');
    expect(s3.enabled).toBe(true);
  });

  it('should bind steps and findings to specific scenarioIds', () => {
    const runId = `test-bind-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002', personaId: 'gremlin' });

    const sBindId = crypto.randomUUID();
    const scenario = scenariosRepo.create({
      id: sBindId,
      runId,
      idx: 0,
      title: 'Uji Keranjang Kosong',
      goal: 'Buka keranjang tanpa produk dan verifikasi tombol checkout',
      risk: 'low',
      needsAuth: false,
      maxSteps: 4,
      expect: ['Tombol checkout terdisable'],
      source: 'ai',
      enabled: true,
      status: 'running',
      createdAt: new Date().toISOString(),
    });

    // Step with scenarioId
    const step = stepsRepo.create({
      id: crypto.randomUUID(),
      runId,
      scenarioId: scenario.id,
      stepNumber: 1,
      actor: 'agent',
      action: { type: 'click', selector: '#cart-btn' },
      thought: 'Clicking empty cart',
      durationMs: 80,
    });
    expect(step.scenarioId).toBe(sBindId);

    // Finding with scenarioId
    const finding = findingsRepo.create({
      id: crypto.randomUUID(),
      runId,
      scenarioId: scenario.id,
      title: 'Checkout button active on empty cart',
      description: 'Button was not disabled',
      severity: 'MEDIUM',
      category: 'functional',
      reproductionSteps: ['1. Open cart', '2. See active checkout'],
      suggestedFix: 'Disable checkout button when count === 0',
      firstDetectedStep: 1,
    });
    expect(finding.scenarioId).toBe(sBindId);
  });

  it('should calculate coverage statistics accurately', () => {
    const runId = `test-cov-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002', personaId: 'gremlin' });

    // Scenario 1: Passed
    scenariosRepo.create({
      id: crypto.randomUUID(),
      runId,
      idx: 0,
      title: 'Scenario 1',
      goal: 'Goal 1',
      risk: 'low',
      needsAuth: false,
      maxSteps: 5,
      expect: ['OK'],
      source: 'ai',
      enabled: true,
      status: 'passed',
      verdict: 'Lulus: Semua kriteria expect terpenuhi',
      createdAt: new Date().toISOString(),
    });

    // Scenario 2: Failed
    scenariosRepo.create({
      id: crypto.randomUUID(),
      runId,
      idx: 1,
      title: 'Scenario 2',
      goal: 'Goal 2',
      risk: 'low',
      needsAuth: false,
      maxSteps: 5,
      expect: ['OK'],
      source: 'ai',
      enabled: true,
      status: 'failed',
      verdict: 'Gagal: HTTP 500 terdeteksi',
      createdAt: new Date().toISOString(),
    });

    // Scenario 3: Blocked (auth required)
    scenariosRepo.create({
      id: crypto.randomUUID(),
      runId,
      idx: 2,
      title: 'Scenario 3',
      goal: 'Goal 3',
      risk: 'medium',
      needsAuth: true,
      maxSteps: 5,
      expect: ['OK'],
      source: 'ai',
      enabled: true,
      status: 'blocked',
      verdict: 'Memerlukan otentikasi',
      createdAt: new Date().toISOString(),
    });

    // Scenario 4: Disabled
    scenariosRepo.create({
      id: crypto.randomUUID(),
      runId,
      idx: 3,
      title: 'Scenario 4',
      goal: 'Goal 4',
      risk: 'high',
      needsAuth: false,
      maxSteps: 5,
      expect: ['OK'],
      source: 'template',
      enabled: false,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    const cov = scenariosRepo.getCoverage(runId);
    expect(cov.total).toBe(4);
    expect(cov.enabled).toBe(3);
    expect(cov.passed).toBe(1);
    expect(cov.failed).toBe(1);
    expect(cov.blocked).toBe(1);
    expect(cov.percentage).toBe(100); // 3 of 3 enabled scenarios evaluated
  });

  it('should support planning review approval lifecycle', async () => {
    const runId = `test-appr-${Date.now()}`;
    const mockPage = {} as any;
    const mockContext = {} as any;

    sessionManager.register(runId, mockPage, mockContext, false);

    let resolved = false;
    const waitPromise = sessionManager.waitForApproval(runId).then(() => {
      resolved = true;
    });

    // Still waiting
    expect(resolved).toBe(false);

    // Approve
    const approved = sessionManager.approve(runId);
    expect(approved).toBe(true);

    await waitPromise;
    expect(resolved).toBe(true);

    sessionManager.unregister(runId);
  });
});

