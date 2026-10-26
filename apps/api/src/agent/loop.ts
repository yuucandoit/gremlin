import type { AgentAction, Signal, Step } from '@gremlin/shared';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';
import { findingsRepo } from '../db/repo/findings';
import { runsRepo } from '../db/repo/runs';
import { signalsRepo } from '../db/repo/signals';
import { stepsRepo } from '../db/repo/steps';
import { eventBus } from '../lib/events';
import { storage } from '../lib/storage';
import { streamManager } from '../lib/stream';
import { ReportBuilder } from '../report/builder';
import { exportRegressionSpec } from '../report/exportSpec';
import { executeAction } from './act';
import { decideNextAction } from './decide';
import { ConsoleDetector } from './detectors/console';
import { DeadClickDetector } from './detectors/deadClick';
import { NetworkDetector } from './detectors/network';
import { StuckDetector } from './detectors/stuck';
import { Guardrails } from './guardrails';
import { observePage } from './observe';
import { getPersona } from './personas';

export async function runAgentLoop(runId: string): Promise<void> {
  const run = runsRepo.getById(runId);
  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  const persona = getPersona(run.personaId);
  const startTime = Date.now();
  const maxSteps = run.maxSteps || 20;
  const timeoutMs = run.timeoutMs || 60000;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  const collectedSteps: Step[] = [];
  const collectedSignals: Signal[] = [];
  const recentActions: AgentAction[] = [];
  const recentUrls: string[] = [];

  try {
    // 1. Launch Playwright Browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) GremlinAutonomousAgent/1.0',
    });

    // Start tracing
    await context.tracing.start({ screenshots: true, snapshots: true });

    page = await context.newPage();

    // Attach Chrome DevTools Protocol (CDP) live screencast for real-time streaming
    let cdp: CDPSession | null = null;
    try {
      cdp = await context.newCDPSession(page);
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: 1280,
        maxHeight: 800,
        everyNthFrame: 1,
      });

      cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
        streamManager.broadcastFrame(runId, data);
        await cdp?.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      });
    } catch (screencastErr) {
      console.warn('[AgentLoop] CDP Screencast failed to start:', screencastErr);
    }

    // 2. Initialize Detectors
    const consoleDetector = new ConsoleDetector(runId);
    const networkDetector = new NetworkDetector(runId);
    const deadClickDetector = new DeadClickDetector(runId);
    const stuckDetector = new StuckDetector(runId);

    consoleDetector.attach(page);
    networkDetector.attach(page);

    // Initial navigation
    try {
      await page.goto(run.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      recentUrls.push(page.url());
    } catch (err: any) {
      const navSignal = signalsRepo.create({
        id: crypto.randomUUID(),
        runId,
        stepNumber: 0,
        type: 'network_error',
        message: `Initial navigation to ${run.url} failed: ${err?.message || err}`,
      });
      collectedSignals.push(navSignal);
      eventBus.emitRunEvent({
        type: 'signal:detected',
        runId,
        timestamp: new Date().toISOString(),
        data: { signal: navSignal },
      });
    }

    // 3. Main Agent Exploration Loop
    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      // Guardrail evaluation
      const guardrail = Guardrails.evaluate({
        currentStep: stepNumber,
        maxSteps,
        startTime,
        timeoutMs,
        recentActions,
        recentUrls,
      });

      if (guardrail.shouldStop) {
        console.log(`[AgentLoop] Guardrail stopped run: ${guardrail.reason}`);
        break;
      }

      consoleDetector.setStep(stepNumber);
      networkDetector.setStep(stepNumber);
      deadClickDetector.setStep(stepNumber);
      stuckDetector.setStep(stepNumber);

      // A. Observe
      const obs = await observePage(page, runId, stepNumber);
      recentUrls.push(obs.url);
      streamManager.setCurrentUrl(runId, obs.url);

      // Collect any signals that occurred prior to decision
      const preSignals = [...consoleDetector.flush(), ...networkDetector.flush()];
      for (const sig of preSignals) {
        const saved = signalsRepo.create(sig);
        collectedSignals.push(saved);
        eventBus.emitRunEvent({
          type: 'signal:detected',
          runId,
          timestamp: new Date().toISOString(),
          data: { signal: saved },
        });
      }

      // Check stuck detector
      const stuckSig = stuckDetector.recordUrl(obs.url);
      if (stuckSig) {
        const saved = signalsRepo.create(stuckSig);
        collectedSignals.push(saved);
        eventBus.emitRunEvent({
          type: 'signal:detected',
          runId,
          timestamp: new Date().toISOString(),
          data: { signal: saved },
        });
      }

      // B. Decide
      const decision = await decideNextAction({
        url: obs.url,
        title: obs.title,
        personaId: run.personaId,
        stepNumber,
        maxSteps,
        interactiveElements: obs.interactiveElements,
        recentActions,
        recentSignals: collectedSignals,
      });

      // C. Check finish condition
      if (decision.action.type === 'finish') {
        const finishStep = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          stepNumber,
          action: decision.action,
          thought: decision.thought,
          screenshotPath: storage.getStepScreenshotRelative(runId, stepNumber),
          ariaSnapshot: obs.ariaSnapshot,
          durationMs: 0,
        });
        collectedSteps.push(finishStep);

        eventBus.emitRunEvent({
          type: 'step:acted',
          runId,
          timestamp: new Date().toISOString(),
          data: { step: finishStep },
        });
        break;
      }

      // D. Act
      recentActions.push(decision.action);

      // Pre-click snapshot for dead-click detection
      let preClickSnapshot = null;
      const isClick = decision.action.type === 'click' || decision.action.type === 'double_click';
      if (isClick) {
        preClickSnapshot = await deadClickDetector.capturePreClick(page);
      }

      const actionResult = await executeAction(page, decision.action);

      // Post-action dead click evaluation
      if (isClick && preClickSnapshot && 'selector' in decision.action) {
        const deadSig = await deadClickDetector.evaluatePostClick(
          page,
          preClickSnapshot,
          decision.action.selector,
          networkDetector.getRequestCount()
        );
        if (deadSig) {
          const saved = signalsRepo.create(deadSig);
          collectedSignals.push(saved);
          eventBus.emitRunEvent({
            type: 'signal:detected',
            runId,
            timestamp: new Date().toISOString(),
            data: { signal: saved },
          });
        }
      }

      // Collect post-action console / network signals
      const postSignals = [...consoleDetector.flush(), ...networkDetector.flush()];
      for (const sig of postSignals) {
        const saved = signalsRepo.create(sig);
        collectedSignals.push(saved);
        eventBus.emitRunEvent({
          type: 'signal:detected',
          runId,
          timestamp: new Date().toISOString(),
          data: { signal: saved },
        });
      }

      // If action failed, record error signal
      if (!actionResult.success && actionResult.error) {
        const actionErrSignal = signalsRepo.create({
          id: crypto.randomUUID(),
          runId,
          stepNumber,
          type: 'console_error',
          message: `Action '${decision.action.type}' failed: ${actionResult.error}`,
          data: { action: decision.action, error: actionResult.error },
        });
        collectedSignals.push(actionErrSignal);
        eventBus.emitRunEvent({
          type: 'signal:detected',
          runId,
          timestamp: new Date().toISOString(),
          data: { signal: actionErrSignal },
        });
      }

      // E. Persist Step
      const step = stepsRepo.create({
        id: crypto.randomUUID(),
        runId,
        stepNumber,
        action: decision.action,
        thought: decision.thought,
        screenshotPath: storage.getStepScreenshotRelative(runId, stepNumber),
        ariaSnapshot: obs.ariaSnapshot,
        durationMs: actionResult.durationMs,
      });
      step.signals = postSignals;
      collectedSteps.push(step);

      // Update progress in DB & emit SSE events
      runsRepo.updateProgress(runId, stepNumber, collectedSignals.length);

      eventBus.emitRunEvent({
        type: 'step:acted',
        runId,
        timestamp: new Date().toISOString(),
        data: { step },
      });

      eventBus.emitRunEvent({
        type: 'run:progress',
        runId,
        timestamp: new Date().toISOString(),
        data: {
          currentStep: stepNumber,
          maxSteps,
          status: 'running',
          message: `Step ${stepNumber}/${maxSteps}: ${decision.thought}`,
        },
      });

      // Small pacing pause between steps
      await page.waitForTimeout(400);
    }

    // 4. Wrap up & Report Generation
    const findings = await ReportBuilder.buildFindings(runId, collectedSignals, collectedSteps);
    for (const f of findings) {
      eventBus.emitRunEvent({
        type: 'finding:created',
        runId,
        timestamp: new Date().toISOString(),
        data: { finding: f },
      });
    }

    // 5. Generate Playwright regression spec
    exportRegressionSpec(runId, run.url, collectedSteps, findings);

    // Stop tracing and save trace.zip
    const tracePath = storage.getTracePath(runId);
    await context.tracing.stop({ path: tracePath }).catch(() => {});

    // Mark run as completed
    runsRepo.updateStatus(runId, 'completed');
    const updatedRun = runsRepo.getById(runId)!;

    eventBus.emitRunEvent({
      type: 'run:completed',
      runId,
      timestamp: new Date().toISOString(),
      data: {
        run: updatedRun,
        totalSteps: collectedSteps.length,
        totalSignals: collectedSignals.length,
        totalFindings: findings.length,
      },
    });
  } catch (err: any) {
    console.error(`[AgentLoop] Fatal error during run ${runId}:`, err);
    runsRepo.updateStatus(runId, 'failed', err?.message || String(err));
    eventBus.emitRunEvent({
      type: 'run:failed',
      runId,
      timestamp: new Date().toISOString(),
      data: { runId, error: err?.message || String(err) },
    });
    throw err;
  } finally {
    if (cdp) {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
    }
    streamManager.endStream(runId);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
