import type { InspectElementResult, InteractiveInputRequest, Step } from '@gremlin/shared';
import type { BrowserContext, Page } from 'playwright';
import { existsSync } from 'node:fs';
import { runsRepo } from '../db/repo/runs';
import { scenariosRepo } from '../db/repo/scenarios';
import { stepsRepo } from '../db/repo/steps';
import { eventBus } from './events';
import { storage } from './storage';

export interface ActiveSession {
  runId: string;
  page: Page;
  context: BrowserContext;
  isPaused: boolean;
  pausePromise: Promise<void> | null;
  resumeResolver: (() => void) | null;
  approved: boolean;
  approvalPromise: Promise<void> | null;
  approvalResolver: (() => void) | null;
  authRequired: boolean;
  authDismissed: boolean;
  authPromise: Promise<void> | null;
  authResolver: (() => void) | null;
  authInfo?: {
    url: string;
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
    message?: string;
  } | null;
  currentScenarioId?: string | null;
  userInstruction?: string | null;
  targetSelector?: string | null;
}

class SessionManager {
  private sessions = new Map<string, ActiveSession>();

  register(runId: string, page: Page, context: BrowserContext, autoApprove: boolean = false): void {
    this.sessions.set(runId, {
      runId,
      page,
      context,
      isPaused: false,
      pausePromise: null,
      resumeResolver: null,
      approved: autoApprove,
      approvalPromise: null,
      approvalResolver: null,
      authRequired: false,
      authDismissed: false,
      authPromise: null,
      authResolver: null,
      authInfo: null,
      currentScenarioId: null,
      userInstruction: null,
      targetSelector: null,
    });
  }

  unregister(runId: string): void {
    const session = this.sessions.get(runId);
    if (session?.resumeResolver) {
      session.resumeResolver();
    }
    if (session?.approvalResolver) {
      session.approvalResolver();
    }
    if (session?.authResolver) {
      session.authResolver();
    }
    this.sessions.delete(runId);
  }

  getSession(runId: string): ActiveSession | undefined {
    return this.sessions.get(runId);
  }

  isPaused(runId: string): boolean {
    return this.sessions.get(runId)?.isPaused ?? false;
  }

  waitForApproval(runId: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (!session || session.approved) return Promise.resolve();

    if (!session.approvalPromise) {
      session.approvalPromise = new Promise<void>((resolve) => {
        session.approvalResolver = resolve;
      });
    }
    return session.approvalPromise;
  }

  approve(runId: string): boolean {
    const session = this.sessions.get(runId);
    if (!session) return false;

    session.approved = true;
    if (session.approvalResolver) {
      session.approvalResolver();
      session.approvalResolver = null;
      session.approvalPromise = null;
    }
    return true;
  }

  setCurrentScenarioId(runId: string, scenarioId: string | null): void {
    const session = this.sessions.get(runId);
    if (session) {
      session.currentScenarioId = scenarioId;
    }
  }

  getCurrentScenarioId(runId: string): string | null {
    return this.sessions.get(runId)?.currentScenarioId || null;
  }

  async hasAuth(runId: string): Promise<boolean> {
    const session = this.sessions.get(runId);
    if (!session) return false;

    try {
      const cookies = await session.context.cookies();
      const hasAuthCookie = cookies.some((c) => {
        const n = c.name.toLowerCase();
        return n.includes('token') || n.includes('session') || n.includes('auth') || n.includes('user');
      });
      if (hasAuthCookie) return true;

      const runDir = storage.getRunDir(runId);
      const authPath = `${runDir}/auth.json`;
      return existsSync(authPath);
    } catch {
      return false;
    }
  }

  triggerAuthRequired(
    runId: string,
    info: {
      url: string;
      emailSelector?: string;
      passwordSelector?: string;
      submitSelector?: string;
      message?: string;
    }
  ): void {
    const session = this.sessions.get(runId);
    if (!session || session.authDismissed) return;

    session.authRequired = true;
    session.authInfo = info;

    if (!session.authPromise) {
      session.authPromise = new Promise<void>((resolve) => {
        session.authResolver = resolve;
      });
    }

    eventBus.emitRunEvent({
      type: 'auth:required',
      runId,
      timestamp: new Date().toISOString(),
      data: {
        url: info.url,
        message: info.message || 'Form login terdeteksi pada halaman aktif',
        emailSelector: info.emailSelector,
        passwordSelector: info.passwordSelector,
        submitSelector: info.submitSelector,
      },
    });
  }

  dismissAuth(runId: string): void {
    const session = this.sessions.get(runId);
    if (!session) return;

    session.authDismissed = true;
    session.authRequired = false;
    session.authInfo = null;

    if (session.authResolver) {
      session.authResolver();
      session.authResolver = null;
      session.authPromise = null;
    }
  }

  async waitForAuthIfNeeded(runId: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session && session.authRequired && !session.authDismissed && session.authPromise) {
      await session.authPromise;
    }
  }

  async submitAuthCredentials(
    runId: string,
    emailOrUsername: string,
    password: string,
    submitSelector?: string
  ): Promise<{ success: boolean; message: string; redirectedUrl?: string }> {
    const session = this.sessions.get(runId);
    if (!session) {
      throw new Error(`Active browser session for run ${runId} not found`);
    }

    const { page } = session;

    try {
      const emailSelector =
        'input[type="email"], input[name="email"], input[id*="email"], input[name*="user"], input[id*="user"], input[type="text"]';
      const passwordSelector = 'input[type="password"], input[name="password"], input[id*="password"]';
      const btnSelector =
        submitSelector ||
        'button[type="submit"], input[type="submit"], #btn-login-submit, button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Masuk")';

      const emailEl = await page.$(emailSelector);
      if (!emailEl) {
        return { success: false, message: 'Form login tidak ditemukan pada halaman ini' };
      }

      await emailEl.fill(emailOrUsername);

      const passEl = await page.$(passwordSelector);
      if (passEl) {
        await passEl.fill(password);
      }

      const currentSteps = stepsRepo.listByRunId(runId);
      stepsRepo.create({
        id: crypto.randomUUID(),
        runId,
        scenarioId: session.currentScenarioId || null,
        stepNumber: currentSteps.length + 1,
        actor: 'human',
        action: { type: 'type', selector: emailSelector, text: emailOrUsername },
        thought: `[Human Co-Pilot Auth] Mengisi kredensial login akun untuk '${emailOrUsername}'`,
        durationMs: 150,
      });

      const submitBtn = await page.$(btnSelector);
      if (submitBtn) {
        await submitBtn.click().catch(() => {});
      } else {
        await page.keyboard.press('Enter').catch(() => {});
      }

      await page.waitForTimeout(1000);

      // Check if error alert was produced
      const errorText = await page
        .evaluate(() => {
          const alert = document.querySelector('.alert-danger, [role="alert"], .error-message, #login-alert');
          if (alert && alert.clientHeight > 0) {
            return alert.textContent?.trim() || null;
          }
          return null;
        })
        .catch(() => null);

      if (errorText && (errorText.toLowerCase().includes('failed') || errorText.toLowerCase().includes('invalid') || errorText.toLowerCase().includes('no account'))) {
        return { success: false, message: errorText };
      }

      // Save cookies and storageState
      await this.trySaveStorageState(runId);

      // Unblock auth scenarios
      const unblocked = scenariosRepo.unblockAuthScenarios(runId);
      for (const s of unblocked) {
        eventBus.emitRunEvent({
          type: 'scenario:updated',
          runId,
          timestamp: new Date().toISOString(),
          data: { scenario: s },
        });
      }

      // Resolve auth promise
      session.authRequired = false;
      session.authDismissed = false;
      if (session.authResolver) {
        session.authResolver();
        session.authResolver = null;
        session.authPromise = null;
      }

      eventBus.emitRunEvent({
        type: 'auth:resolved',
        runId,
        timestamp: new Date().toISOString(),
        data: {
          success: true,
          email: emailOrUsername,
          message: 'Berhasil login dan menyimpan sesi otentikasi.',
        },
      });

      return {
        success: true,
        message: 'Berhasil login! Sesi tersimpan dan skenario terblokir telah dibuka kembali.',
        redirectedUrl: page.url(),
      };
    } catch (err: any) {
      return { success: false, message: `Gagal mengirim form login: ${err?.message || err}` };
    }
  }

  pause(runId: string): boolean {
    const session = this.sessions.get(runId);
    if (!session || session.isPaused) return false;

    session.isPaused = true;
    session.pausePromise = new Promise<void>((resolve) => {
      session.resumeResolver = resolve;
    });

    runsRepo.updateStatus(runId, 'paused');
    eventBus.emitRunEvent({
      type: 'run:paused',
      runId,
      timestamp: new Date().toISOString(),
      data: { runId },
    });

    return true;
  }

  resume(runId: string): boolean {
    const session = this.sessions.get(runId);
    if (!session || !session.isPaused) return false;

    // Check if session navigated away from a login page or holds auth credentials
    this.trySaveStorageState(runId).catch(() => {});

    session.isPaused = false;
    const resolver = session.resumeResolver;
    session.pausePromise = null;
    session.resumeResolver = null;

    runsRepo.updateStatus(runId, 'running');
    eventBus.emitRunEvent({
      type: 'run:resumed',
      runId,
      timestamp: new Date().toISOString(),
      data: { runId },
    });

    if (resolver) {
      resolver();
    }

    return true;
  }

  async waitIfPaused(runId: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session && session.isPaused && session.pausePromise) {
      await session.pausePromise;
    }
  }

  async sendInput(runId: string, input: InteractiveInputRequest): Promise<Step | null> {
    const session = this.sessions.get(runId);
    if (!session) {
      throw new Error(`Active browser session for run ${runId} not found`);
    }

    if (!session.isPaused) {
      throw new Error(`Manual takeover input is only accepted while run is paused (Gremlin Playground mode)`);
    }

    const { page } = session;
    const vp = page.viewportSize() || { width: 1280, height: 800 };

    let px = 0;
    let py = 0;
    if (input.x !== undefined && input.y !== undefined) {
      px = input.x <= 1 ? Math.round(input.x * vp.width) : Math.round(input.x);
      py = input.y <= 1 ? Math.round(input.y * vp.height) : Math.round(input.y);
    }

    const currentSteps = stepsRepo.listByRunId(runId);
    const nextStepNum = currentSteps.length + 1;

    switch (input.type) {
      case 'click': {
        await page.mouse.move(px, py, { steps: 3 }).catch(() => {});
        await page.mouse.click(px, py).catch(() => {});

        // Resolve clean selector under clicked point
        const selector = await page
          .evaluate(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return 'manual_click';
            if (el.id) return `#${el.id}`;
            const tag = el.tagName.toLowerCase();
            const cls =
              el.className && typeof el.className === 'string'
                ? '.' + el.className.trim().split(/\s+/)[0]
                : '';
            return `${tag}${cls}`;
          }, [px, py])
          .catch(() => 'manual_click');

        const step = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          scenarioId: session.currentScenarioId || null,
          stepNumber: nextStepNum,
          actor: 'human',
          action: { type: 'click', selector },
          thought: `[Human Co-Pilot] Clicked at coordinates (${px}, ${py}) on '${selector}'`,
          durationMs: 50,
        });

        eventBus.emitRunEvent({
          type: 'step:acted',
          runId,
          timestamp: new Date().toISOString(),
          data: { step },
        });

        return step;
      }

      case 'double_click': {
        await page.mouse.move(px, py, { steps: 3 }).catch(() => {});
        await page.mouse.dblclick(px, py).catch(() => {});

        const selector = await page
          .evaluate(([x, y]) => {
            const el = document.elementFromPoint(x, y);
            if (!el) return 'manual_click';
            if (el.id) return `#${el.id}`;
            return el.tagName.toLowerCase();
          }, [px, py])
          .catch(() => 'manual_click');

        const step = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          scenarioId: session.currentScenarioId || null,
          stepNumber: nextStepNum,
          actor: 'human',
          action: { type: 'double_click', selector },
          thought: `[Human Co-Pilot] Double-clicked at coordinates (${px}, ${py}) on '${selector}'`,
          durationMs: 80,
        });

        eventBus.emitRunEvent({
          type: 'step:acted',
          runId,
          timestamp: new Date().toISOString(),
          data: { step },
        });

        return step;
      }

      case 'type': {
        if (!input.text) return null;
        await page.keyboard.type(input.text, { delay: 25 }).catch(() => {});

        const step = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          scenarioId: session.currentScenarioId || null,
          stepNumber: nextStepNum,
          actor: 'human',
          action: { type: 'type', selector: input.selector || 'activeElement', text: input.text },
          thought: `[Human Co-Pilot] Typed "${input.text}" into active element`,
          durationMs: input.text.length * 25,
        });

        eventBus.emitRunEvent({
          type: 'step:acted',
          runId,
          timestamp: new Date().toISOString(),
          data: { step },
        });

        return step;
      }

      case 'press_key': {
        if (!input.key) return null;
        await page.keyboard.press(input.key).catch(() => {});

        const step = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          scenarioId: session.currentScenarioId || null,
          stepNumber: nextStepNum,
          actor: 'human',
          action: { type: 'press_key', key: input.key },
          thought: `[Human Co-Pilot] Pressed key '${input.key}'`,
          durationMs: 20,
        });

        eventBus.emitRunEvent({
          type: 'step:acted',
          runId,
          timestamp: new Date().toISOString(),
          data: { step },
        });

        return step;
      }

      case 'scroll': {
        await page.mouse.wheel(input.deltaX || 0, input.deltaY || 300).catch(() => {});
        return null;
      }

      default:
        return null;
    }
  }

  async inspectAt(runId: string, normX: number, normY: number): Promise<InspectElementResult | null> {
    const session = this.sessions.get(runId);
    if (!session) return null;

    const { page } = session;
    const vp = page.viewportSize() || { width: 1280, height: 800 };
    const px = normX <= 1 ? Math.round(normX * vp.width) : Math.round(normX);
    const py = normY <= 1 ? Math.round(normY * vp.height) : Math.round(normY);

    try {
      const result = await page.evaluate(([x, y]) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;

        const rect = el.getBoundingClientRect();
        let selector = '';
        if (el.id) {
          selector = `#${el.id}`;
        } else {
          const tag = el.tagName.toLowerCase();
          const cls =
            el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.')
              : '';
          selector = `${tag}${cls}`;
        }

        const text = (el.textContent || '').trim().slice(0, 50);
        const role = el.getAttribute('role') || el.getAttribute('type') || undefined;

        return {
          selector,
          tagName: el.tagName.toLowerCase(),
          text,
          role,
          box: {
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            label: selector,
          },
        };
      }, [px, py]);

      return result;
    } catch {
      return null;
    }
  }

  setGuidance(runId: string, instruction: string, targetSelector?: string): void {
    const session = this.sessions.get(runId);
    if (session) {
      session.userInstruction = instruction;
      session.targetSelector = targetSelector || null;
    }
  }

  consumeGuidance(runId: string): { instruction?: string | null; targetSelector?: string | null } {
    const session = this.sessions.get(runId);
    if (!session) return {};

    const guidance = {
      instruction: session.userInstruction,
      targetSelector: session.targetSelector,
    };

    session.userInstruction = null;
    session.targetSelector = null;

    return guidance;
  }

  private async trySaveStorageState(runId: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (!session) return;

    try {
      const runDir = storage.getRunDir(runId);
      const authPath = `${runDir}/auth.json`;
      await session.context.storageState({ path: authPath });
    } catch {}
  }
}

export const sessionManager = new SessionManager();

