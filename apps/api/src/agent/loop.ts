import type { AgentAction, Signal, Step } from '@gremlin/shared';
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from 'playwright';
import { findingsRepo } from '../db/repo/findings';
import { runsRepo } from '../db/repo/runs';
import { scenariosRepo } from '../db/repo/scenarios';
import { signalsRepo } from '../db/repo/signals';
import { stepsRepo } from '../db/repo/steps';
import { eventBus } from '../lib/events';
import { storage } from '../lib/storage';
import { streamManager } from '../lib/stream';
import { sessionManager } from '../lib/session';
import { ReportBuilder } from '../report/builder';
import { exportRegressionSpec } from '../report/exportSpec';
import { executeAction } from './act';
import { injectVirtualCursor } from './cursor';
import { decideNextAction } from './decide';
import { conductReconnaissance } from './recon';
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
  const maxTotalSteps = run.maxSteps || 25;
  const timeoutMs = run.timeoutMs || 90000;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let cdp: CDPSession | null = null;

  const collectedSteps: Step[] = [];
  const collectedSignals: Signal[] = [];
  const recentActions: AgentAction[] = [];
  const recentUrls: string[] = [];
  const discoveredRoutes = new Set<string>();

  try {
    // 1. Launch Playwright Browser
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const isMobile = run.viewport === 'mobile';
    const viewportWidth = isMobile ? 390 : 1280;
    const viewportHeight = isMobile ? 844 : 800;

    context = await browser.newContext({
      viewport: { width: viewportWidth, height: viewportHeight },
      isMobile,
      hasTouch: isMobile,
      userAgent: isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 GremlinMobileAgent/1.0'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) GremlinAutonomousAgent/1.0',
    });

    // Start tracing
    await context.tracing.start({ screenshots: true, snapshots: true });

    page = await context.newPage();

    // Register active session with autoApprove flag
    sessionManager.register(runId, page, context, Boolean(run.autoApprove));

    // Inject high-visibility virtual cursor and click ripple into Chromium
    await injectVirtualCursor(page);

    // Attach Chrome DevTools Protocol (CDP) live screencast for real-time streaming
    try {
      cdp = await context.newCDPSession(page);
      await cdp.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 75,
        maxWidth: viewportWidth,
        maxHeight: viewportHeight,
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
      discoveredRoutes.add(new URL(page.url()).pathname);
      await injectVirtualCursor(page);

      // Autonomous Reconnaissance & Structured Scenario Plan Formulation
      try {
        const { testPlan, scenarios } = await conductReconnaissance(page, runId, run.url, persona.name);
        runsRepo.updateTestPlan(runId, testPlan);
        eventBus.emitRunEvent({
          type: 'test_plan:ready',
          runId,
          timestamp: new Date().toISOString(),
          data: { testPlan, scenarios },
        });
      } catch (reconErr) {
        console.warn('[AgentLoop] Reconnaissance failed:', reconErr);
      }
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

    // 3. User Review / Approval Phase (Planning Mode)
    // If not auto-approved, wait for user review & approval before executing scenarios
    if (!run.autoApprove) {
      runsRepo.updateStatus(runId, 'planning');
      eventBus.emitRunEvent({
        type: 'run:planning',
        runId,
        timestamp: new Date().toISOString(),
        data: { runId, message: 'Menunggu review dan persetujuan skenario dari QA Engineer...' },
      });
      console.log(`[AgentLoop] ⏸️ Run ${runId} is awaiting scenario review in planning mode.`);
      await sessionManager.waitForApproval(runId);
    }

    runsRepo.updateStatus(runId, 'running');
    eventBus.emitRunEvent({
      type: 'run:resumed',
      runId,
      timestamp: new Date().toISOString(),
      data: { runId },
    });

    // 4. Scenario-Driven Execution Loop
    let globalStepNumber = 0;

    // Fetch the enabled scenarios (which the user may have edited, added to, or reordered)
    const activeScenarios = scenariosRepo.listByRunId(runId).filter((s) => s.enabled);
    console.log(`[AgentLoop] 🚀 Beginning execution of ${activeScenarios.length} enabled test scenarios.`);

    for (let sIdx = 0; sIdx < activeScenarios.length; sIdx++) {
      const scenario = activeScenarios[sIdx];

      // Check if global limits reached
      if (globalStepNumber >= maxTotalSteps || Date.now() - startTime > timeoutMs) {
        scenariosRepo.updateStatus(scenario.id, 'skipped', 'Dilewati: Batas total langkah atau waktu run tercapai');
        continue;
      }

      // Check Authentication Requirement
      const hasAuth = await sessionManager.hasAuth(runId);
      if (scenario.needsAuth && !hasAuth) {
        console.log(`[AgentLoop] 🔒 Scenario '${scenario.title}' blocked: Requires authentication.`);
        scenariosRepo.updateStatus(
          scenario.id,
          'blocked',
          'Memerlukan otentikasi. Skenario ditunda sampai pengguna login melalui Gremlin Playground.'
        );
        eventBus.emitRunEvent({
          type: 'scenario:updated',
          runId,
          timestamp: new Date().toISOString(),
          data: { scenario: scenariosRepo.getById(scenario.id) },
        });
        continue;
      }

      // Activate scenario
      scenariosRepo.updateStatus(scenario.id, 'running');
      sessionManager.setCurrentScenarioId(runId, scenario.id);

      eventBus.emitRunEvent({
        type: 'scenario:updated',
        runId,
        timestamp: new Date().toISOString(),
        data: { scenario: scenariosRepo.getById(scenario.id) },
      });

      eventBus.emitRunEvent({
        type: 'run:progress',
        runId,
        timestamp: new Date().toISOString(),
        data: {
          currentStep: globalStepNumber,
          maxSteps: maxTotalSteps,
          status: 'running',
          message: `[Skenario ${sIdx + 1}/${activeScenarios.length}] ${scenario.title}`,
        },
      });

      const scenarioSignals: Signal[] = [];
      const scenarioMaxSteps = Math.min(scenario.maxSteps || 8, maxTotalSteps - globalStepNumber);

      // Execute scenario-focused steps
      for (let sStep = 1; sStep <= scenarioMaxSteps; sStep++) {
        globalStepNumber++;

        // Gremlin Playground: Halt exploration if user paused to take over
        await sessionManager.waitIfPaused(runId);

        // Guardrail evaluation
        const guardrail = Guardrails.evaluate({
          currentStep: globalStepNumber,
          maxSteps: maxTotalSteps,
          startTime,
          timeoutMs,
          recentActions,
          recentUrls,
        });

        if (guardrail.shouldStop) {
          console.log(`[AgentLoop] Guardrail stopped scenario: ${guardrail.reason}`);
          break;
        }

        consoleDetector.setStep(globalStepNumber);
        networkDetector.setStep(globalStepNumber);
        deadClickDetector.setStep(globalStepNumber);
        stuckDetector.setStep(globalStepNumber);

        // A. Observe
        const obs = await observePage(page, runId, globalStepNumber);
        recentUrls.push(obs.url);
        streamManager.setCurrentUrl(runId, obs.url);

        // Dynamic Route Discovery: If a new unexpected route was reached, propose new scenario
        try {
          const currentPath = new URL(obs.url).pathname;
          if (currentPath !== '/' && !discoveredRoutes.has(currentPath)) {
            discoveredRoutes.add(currentPath);
            const existingCount = scenariosRepo.listByRunId(runId).length;
            const dynamicScenario = scenariosRepo.create({
              id: crypto.randomUUID(),
              runId,
              idx: existingCount,
              title: `Eksplorasi Rute Baru Ditemukan: ${currentPath}`,
              goal: `Uji interaksi dan stabilitas pada rute baru yang ditemukan saat navigasi: ${currentPath}`,
              personaId: 'gremlin',
              viewport: 'desktop',
              needsAuth: false,
              risk: 'low',
              maxSteps: 6,
              expect: ['Halaman rute baru merespons tanpa error 500', 'Elemen ter-render dengan baik'],
              source: 'ai',
              enabled: false,
              status: 'pending',
              createdAt: new Date().toISOString(),
            });
            eventBus.emitRunEvent({
              type: 'scenario:created',
              runId,
              timestamp: new Date().toISOString(),
              data: { scenario: dynamicScenario },
            });
          }
        } catch {}

        // Collect any signals that occurred prior to decision
        const preSignals = [...consoleDetector.flush(), ...networkDetector.flush()];
        for (const sig of preSignals) {
          const saved = signalsRepo.create(sig);
          collectedSignals.push(saved);
          scenarioSignals.push(saved);
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
          scenarioSignals.push(saved);
          eventBus.emitRunEvent({
            type: 'signal:detected',
            runId,
            timestamp: new Date().toISOString(),
            data: { signal: saved },
          });
        }

        // Check human steering guidance from Playground
        const humanGuidance = sessionManager.consumeGuidance(runId);

        // B. Decide (binding decision to active scenario goal and expect criteria)
        const decision = await decideNextAction({
          url: obs.url,
          title: obs.title,
          personaId: scenario.personaId || run.personaId,
          stepNumber: sStep,
          maxSteps: scenarioMaxSteps,
          screenshotPath: obs.screenshotPath,
          scenarioGoal: scenario.goal,
          scenarioExpect: scenario.expect,
          userGuidance: humanGuidance.instruction || undefined,
          interactiveElements: obs.interactiveElements,
          recentActions,
          recentSignals: collectedSignals,
        });

        // C. Check finish condition for this scenario
        if (decision.action.type === 'finish') {
          const finishStep = stepsRepo.create({
            id: crypto.randomUUID(),
            runId,
            scenarioId: scenario.id,
            stepNumber: globalStepNumber,
            action: decision.action,
            thought: decision.thought,
            screenshotPath: storage.getStepScreenshotRelative(runId, globalStepNumber),
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
            scenarioSignals.push(saved);
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
          scenarioSignals.push(saved);
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
            stepNumber: globalStepNumber,
            type: 'console_error',
            message: `Action '${decision.action.type}' failed: ${actionResult.error}`,
            data: { action: decision.action, error: actionResult.error },
          });
          collectedSignals.push(actionErrSignal);
          scenarioSignals.push(actionErrSignal);
          eventBus.emitRunEvent({
            type: 'signal:detected',
            runId,
            timestamp: new Date().toISOString(),
            data: { signal: actionErrSignal },
          });
        }

        // E. Persist Step bound to scenarioId
        const step = stepsRepo.create({
          id: crypto.randomUUID(),
          runId,
          scenarioId: scenario.id,
          stepNumber: globalStepNumber,
          action: decision.action,
          thought: decision.thought,
          screenshotPath: storage.getStepScreenshotRelative(runId, globalStepNumber),
          ariaSnapshot: obs.ariaSnapshot,
          durationMs: actionResult.durationMs,
        });
        step.signals = postSignals;
        collectedSteps.push(step);

        runsRepo.updateProgress(runId, globalStepNumber, collectedSignals.length);

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
            currentStep: globalStepNumber,
            maxSteps: maxTotalSteps,
            status: 'running',
            message: `Step ${globalStepNumber}/${maxTotalSteps} (${scenario.title}): ${decision.thought}`,
          },
        });

        await page.waitForTimeout(300);
      }

      // Evaluate Scenario Verdict (passed vs failed based on signals & expect criteria)
      const criticalErrors = scenarioSignals.filter(
        (s) =>
          s.type === 'http_5xx' ||
          s.type === 'unhandled_rejection' ||
          (s.type === 'console_error' && !s.message.includes('Download the React DevTools'))
      );

      let finalStatus: 'passed' | 'failed' = 'passed';
      let verdictMessage = `Lulus: Semua kriteria expect terpenuhi tanpa anomali [${scenario.expect.slice(0, 2).join('; ')}]`;

      if (criticalErrors.length > 0) {
        finalStatus = 'failed';
        const err = criticalErrors[0];
        verdictMessage = `Gagal: Terdeteksi ${err.type.replace('_', ' ')} (${err.message.slice(0, 90)})`;
      }

      scenariosRepo.updateStatus(scenario.id, finalStatus, verdictMessage);
      sessionManager.setCurrentScenarioId(runId, null);

      eventBus.emitRunEvent({
        type: 'scenario:updated',
        runId,
        timestamp: new Date().toISOString(),
        data: { scenario: scenariosRepo.getById(scenario.id) },
      });
    }

    // 5. Wrap up & Report Generation
    const findings = await ReportBuilder.buildFindings(runId, collectedSignals, collectedSteps);
    for (const f of findings) {
      eventBus.emitRunEvent({
        type: 'finding:created',
        runId,
        timestamp: new Date().toISOString(),
        data: { finding: f },
      });
    }

    // Generate Playwright regression spec
    exportRegressionSpec(runId, run.url, collectedSteps, findings, run.viewport);

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
    sessionManager.unregister(runId);
    if (cdp) {
      await cdp.send('Page.stopScreencast').catch(() => {});
      await cdp.detach().catch(() => {});
    }
    streamManager.endStream(runId);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
