import type { Finding, FindingCategory, Severity, Signal, Step } from '@gremlin/shared';
import { findingsRepo } from '../db/repo/findings';
import { llmClient } from '../llm/client';
import { deduplicateSignals } from './dedupe';

export class ReportBuilder {
  static async buildFindings(
    runId: string,
    signals: Signal[],
    steps: Step[]
  ): Promise<Finding[]> {
    findingsRepo.clearByRunId(runId);

    const dedupedSignals = deduplicateSignals(signals);

    // 1. Try LLM synthesis if available
    let synthesizedFindings: any[] = [];
    try {
      synthesizedFindings = await llmClient.synthesizeFindings(dedupedSignals, steps);
    } catch {
      // Continue to deterministic fallback
    }

    if (Array.isArray(synthesizedFindings) && synthesizedFindings.length > 0) {
      const results: Finding[] = [];
      for (const item of synthesizedFindings) {
        const finding = findingsRepo.create({
          id: crypto.randomUUID(),
          runId,
          title: item.title || 'Detected Anomaly',
          description: item.description || '',
          severity: (item.severity?.toUpperCase() || 'MEDIUM') as Severity,
          category: (item.category?.toLowerCase() || 'functional') as FindingCategory,
          reproductionSteps: Array.isArray(item.reproductionSteps)
            ? item.reproductionSteps
            : ['1. Reproduce following recorded steps.'],
          suggestedFix: item.suggestedFix || 'Investigate stack trace and network logs.',
          firstDetectedStep: item.firstDetectedStep || 1,
          evidence: item.evidence || {},
        });
        results.push(finding);
      }
      return results;
    }

    // 2. Deterministic Rule-Based Finding Synthesis
    const findings: Finding[] = [];

    // Group signals by type
    const consoleErrors = dedupedSignals.filter(
      (s) => s.type === 'console_error' || s.type === 'unhandled_rejection'
    );
    const serverErrors = dedupedSignals.filter((s) => s.type === 'http_5xx');
    const deadClicks = dedupedSignals.filter((s) => s.type === 'dead_click');
    const networkErrors = dedupedSignals.filter((s) => s.type === 'network_error');
    const stuckLoops = dedupedSignals.filter((s) => s.type === 'stuck_loop');

    // Synthesis: Console Exceptions / Crashes
    for (const err of consoleErrors) {
      const isCritical =
        err.message.toLowerCase().includes('typeerror') ||
        err.message.toLowerCase().includes('uncaught') ||
        err.type === 'unhandled_rejection';

      const reproSteps = this.buildReproSteps(steps, err.stepNumber ?? 1);

      const finding = findingsRepo.create({
        id: crypto.randomUUID(),
        runId,
        title: isCritical
          ? `Unhandled Client Exception: ${err.message.slice(0, 60)}`
          : `Console Error: ${err.message.slice(0, 60)}`,
        description: `An uncaught JavaScript error occurred during step ${err.stepNumber ?? 1}.\nDetails: ${err.message}`,
        severity: isCritical ? 'CRITICAL' : 'HIGH',
        category: 'crash',
        reproductionSteps: reproSteps,
        suggestedFix:
          'Add error boundaries, sanitize inputs, and verify null checks on DOM elements and state handlers.',
        firstDetectedStep: err.stepNumber ?? 1,
        evidence: err.data,
      });
      findings.push(finding);
    }

    // Synthesis: HTTP 500 Server Errors
    for (const srv of serverErrors) {
      const reproSteps = this.buildReproSteps(steps, srv.stepNumber ?? 1);
      const url = srv.data?.url || 'API endpoint';

      const finding = findingsRepo.create({
        id: crypto.randomUUID(),
        runId,
        title: `Backend HTTP 500 Internal Server Error on ${url.replace(/https?:\/\/[^/]+/, '')}`,
        description: `Server responded with status code 500 when requesting ${url}. This indicates unhandled backend logic failure or crash.`,
        severity: 'HIGH',
        category: 'network',
        reproductionSteps: reproSteps,
        suggestedFix:
          'Wrap backend route handler in try/catch, log detailed stack traces, and validate payload schema before processing.',
        firstDetectedStep: srv.stepNumber ?? 1,
        evidence: srv.data,
      });
      findings.push(finding);
    }

    // Synthesis: Dead Clicks
    for (const dc of deadClicks) {
      const selector = dc.data?.selector || 'interactive element';
      const reproSteps = this.buildReproSteps(steps, dc.stepNumber ?? 1);

      const finding = findingsRepo.create({
        id: crypto.randomUUID(),
        runId,
        title: `Unresponsive UI Element (Dead Click): ${selector}`,
        description: `User clicked on '${selector}', but the application produced no DOM mutations, no URL change, and no network requests. The control appears dead or non-functional.`,
        severity: 'MEDIUM',
        category: 'ux',
        reproductionSteps: reproSteps,
        suggestedFix:
          `Ensure '${selector}' has an attached click event handler or disable the element when no action is available.`,
        firstDetectedStep: dc.stepNumber ?? 1,
        evidence: dc.data,
      });
      findings.push(finding);
    }

    // Synthesis: Network Errors
    for (const net of networkErrors) {
      const reproSteps = this.buildReproSteps(steps, net.stepNumber ?? 1);

      const finding = findingsRepo.create({
        id: crypto.randomUUID(),
        runId,
        title: `Failed Network Request: ${net.message.slice(0, 60)}`,
        description: `Network request failed or was aborted: ${net.message}`,
        severity: 'MEDIUM',
        category: 'network',
        reproductionSteps: reproSteps,
        suggestedFix:
          'Inspect CORS configuration, API endpoint availability, and request headers.',
        firstDetectedStep: net.stepNumber ?? 1,
        evidence: net.data,
      });
      findings.push(finding);
    }

    // Synthesis: Stuck Loop Trap
    for (const st of stuckLoops) {
      const reproSteps = this.buildReproSteps(steps, st.stepNumber ?? 1);

      const finding = findingsRepo.create({
        id: crypto.randomUUID(),
        runId,
        title: `Navigation / Workflow Trap Detected`,
        description: st.message,
        severity: 'HIGH',
        category: 'functional',
        reproductionSteps: reproSteps,
        suggestedFix:
          'Review routing transitions and state machine to ensure users can smoothly exit screens and advance tasks.',
        firstDetectedStep: st.stepNumber ?? 1,
        evidence: st.data,
      });
      findings.push(finding);
    }

    return findings;
  }

  private static buildReproSteps(steps: Step[], targetStep: number): string[] {
    const relevant = steps.filter((s) => s.stepNumber <= targetStep);
    if (relevant.length === 0) {
      return ['1. Open target application URL.'];
    }

    return relevant.map((s, idx) => {
      const action = s.action;
      if (action.type === 'navigate') return `${idx + 1}. Navigate to ${action.url}`;
      if (action.type === 'click') return `${idx + 1}. Click element '${action.selector}'`;
      if (action.type === 'double_click') return `${idx + 1}. Rapidly double-click element '${action.selector}'`;
      if (action.type === 'type') return `${idx + 1}. Type "${action.text}" into '${action.selector}'`;
      if (action.type === 'press_key') return `${idx + 1}. Press key '${action.key}'`;
      return `${idx + 1}. Execute action ${action.type}`;
    });
  }
}
