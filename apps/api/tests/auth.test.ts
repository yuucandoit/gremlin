import { describe, expect, it } from 'bun:test';
import { runsRepo } from '../src/db/repo/runs';
import { scenariosRepo } from '../src/db/repo/scenarios';
import { sessionManager } from '../src/lib/session';

describe('Interactive Authentication & Login Form Handling', () => {
  it('should trigger auth required and unblock scenarios upon login', async () => {
    const runId = `test-auth-${Date.now()}`;
    runsRepo.create({
      id: runId,
      url: 'http://localhost:3002/login',
      personaId: 'gremlin',
    });

    const scAuthId = crypto.randomUUID();
    const scenario = scenariosRepo.create({
      id: scAuthId,
      runId,
      idx: 0,
      title: 'Proteksi Rute Internal & Manajemen Sesi',
      goal: 'Akses halaman profil setelah login',
      needsAuth: true,
      risk: 'medium',
      maxSteps: 6,
      expect: ['Halaman profil terbuka'],
      source: 'template',
      enabled: true,
      status: 'blocked',
      verdict: 'Memerlukan otentikasi',
      createdAt: new Date().toISOString(),
    });

    expect(scenario.status).toBe('blocked');

    // 2. Mock page session
    let filledEmail = '';
    let filledPass = '';
    let clickedSubmit = false;

    const mockPage = {
      url: () => 'http://localhost:3002/login',
      $: async (selector: string) => {
        if (selector.includes('email') || selector.includes('user')) {
          return { fill: async (v: string) => { filledEmail = v; } };
        }
        if (selector.includes('password')) {
          return { fill: async (v: string) => { filledPass = v; } };
        }
        if (selector.includes('submit') || selector.includes('button')) {
          return { click: async () => { clickedSubmit = true; } };
        }
        return null;
      },
      evaluate: async () => null,
      waitForTimeout: async () => {},
      keyboard: { press: async () => {} },
    } as any;

    const mockContext = {
      cookies: async () => [{ name: 'auth_token', value: 'token-xyz' }],
      storageState: async () => ({ cookies: [], origins: [] }),
    } as any;

    sessionManager.register(runId, mockPage, mockContext, false);

    // 3. Trigger Auth Required
    sessionManager.triggerAuthRequired(runId, {
      url: 'http://localhost:3002/login',
      message: 'Form login terdeteksi pada /login',
    });

    const session = sessionManager.getSession(runId);
    expect(session?.authRequired).toBe(true);
    expect(session?.authInfo?.url).toBe('http://localhost:3002/login');

    // 4. Submit Credentials
    const result = await sessionManager.submitAuthCredentials(
      runId,
      'admin@glitchmart.com',
      'SuperSecret123!'
    );

    expect(result.success).toBe(true);
    expect(filledEmail).toBe('admin@glitchmart.com');
    expect(filledPass).toBe('SuperSecret123!');
    expect(clickedSubmit).toBe(true);

    // 5. Verify blocked scenarios have been unblocked!
    const updatedScenario = scenariosRepo.getById(scAuthId);
    expect(updatedScenario?.status).toBe('pending');
    expect(updatedScenario?.verdict).toBeNull();

    // 6. Verify auth status
    const hasAuth = await sessionManager.hasAuth(runId);
    expect(hasAuth).toBe(true);

    sessionManager.unregister(runId);
  });

  it('should support dismissing auth prompt when testing unauthenticated', () => {
    const runId = `test-dismiss-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002/login', personaId: 'gremlin' });
    const mockPage = {} as any;
    const mockContext = { cookies: async () => [] } as any;

    sessionManager.register(runId, mockPage, mockContext, false);
    sessionManager.triggerAuthRequired(runId, { url: 'http://localhost:3002/login' });

    let s = sessionManager.getSession(runId);
    expect(s?.authRequired).toBe(true);

    sessionManager.dismissAuth(runId);

    s = sessionManager.getSession(runId);
    expect(s?.authRequired).toBe(false);
    expect(s?.authDismissed).toBe(true);

    sessionManager.unregister(runId);
  });

  it('should support pre-reconnaissance login when target link redirects to login page', async () => {
    const runId = `test-prerecon-${Date.now()}`;
    runsRepo.create({ id: runId, url: 'http://localhost:3002/dashboard', personaId: 'gremlin' });

    let currentUrl = 'http://localhost:3002/login'; // redirected
    const mockPage = {
      url: () => currentUrl,
      $: async (selector: string) => ({
        fill: async () => {},
        click: async () => { currentUrl = 'http://localhost:3002/dashboard'; },
      }),
      evaluate: async () => null,
      waitForTimeout: async () => {},
      keyboard: { press: async () => {} },
    } as any;

    let savedState = false;
    const mockContext = {
      cookies: async () => [{ name: 'auth_token', value: 'secret-token-123' }],
      storageState: async () => { savedState = true; return { cookies: [], origins: [] }; },
    } as any;

    sessionManager.register(runId, mockPage, mockContext, false);

    // Initial navigation detected login wall before recon
    sessionManager.triggerAuthRequired(runId, {
      url: currentUrl,
      message: 'Aplikasi teralihkan ke form login sebelum recon',
    });

    const session = sessionManager.getSession(runId);
    expect(session?.authRequired).toBe(true);

    // User submits credentials
    const authResult = await sessionManager.submitAuthCredentials(runId, 'admin@glitchmart.com', 'SuperSecret123!');
    expect(authResult.success).toBe(true);
    expect(sessionManager.getSession(runId)?.authRequired).toBe(false);

    // Auth state saved
    const hasAuth = await sessionManager.hasAuth(runId);
    expect(hasAuth).toBe(true);
    expect(savedState).toBe(true);

    sessionManager.unregister(runId);
  });
});
