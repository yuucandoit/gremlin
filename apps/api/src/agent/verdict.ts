import type { Scenario, Signal, Step, VerdictCheck } from '@gremlin/shared';
import { llmClient } from '../llm/client';

export interface VerdictEvaluation {
  status: 'passed' | 'failed' | 'inconclusive';
  verdict: string;
  checks: VerdictCheck[];
}

export async function evaluateScenarioVerdict(
  scenario: Scenario,
  scenarioSignals: Signal[],
  scenarioSteps: Step[],
  screenshotPath?: string | null
): Promise<VerdictEvaluation> {
  const checks: VerdictCheck[] = [];

  // 1. Collect deterministic error signals
  const criticalErrors = scenarioSignals.filter((s) => {
    if (s.type === 'http_5xx') return true;
    if (s.type === 'unhandled_rejection') return true;
    if (s.type === 'console_error') {
      const msg = s.message || '';
      if (msg.includes('Download the React DevTools')) return false;
      return true;
    }
    return false;
  });

  const deadClicks = scenarioSignals.filter((s) => s.type === 'dead_click');

  // 2. Evaluate each expect criterion
  const expectCriteria = scenario.expect && scenario.expect.length > 0
    ? scenario.expect
    : ['Tidak ada server crash atau console error'];

  let hasLLMEval = false;
  let llmResults: Record<string, { result: 'met' | 'violated' | 'unknown'; evidence: string }> = {};

  if (llmClient.hasLLMConfigured() && screenshotPath) {
    try {
      const prompt = `You are Meta Muse Spark QA Judge.
Evaluate whether the following expected criteria passed or failed for this scenario:
Scenario: "${scenario.title}"
Goal: "${scenario.goal}"
Expect Criteria: ${JSON.stringify(expectCriteria)}

Executed Steps:
${scenarioSteps.map((s, i) => `${i + 1}. [${s.actor}] ${s.thought}`).join('\n')}

Signals/Errors:
${scenarioSignals.map((s) => `- [${s.type}] ${s.message}`).join('\n') || 'None'}

Return JSON only:
{
  "evaluations": [
    {
      "criterion": "exact string",
      "result": "met" | "violated" | "unknown",
      "evidence": "brief factual explanation"
    }
  ]
}`;

      const res = await llmClient.generateReconPlan(prompt);
      if (res && Array.isArray(res.evaluations)) {
        hasLLMEval = true;
        for (const item of res.evaluations) {
          if (item.criterion && item.result) {
            llmResults[item.criterion] = {
              result: item.result,
              evidence: item.evidence || '',
            };
          }
        }
      }
    } catch {}
  }

  for (const criterion of expectCriteria) {
    const lower = criterion.toLowerCase();
    const isNegativeCheck =
      lower.includes('tidak ada') ||
      lower.includes('tidak terjadi') ||
      lower.includes('no crash') ||
      lower.includes('no error') ||
      lower.includes('tidak error') ||
      lower.includes('500');

    // If critical signals violated this criterion or general system stability
    if (criticalErrors.length > 0 && (isNegativeCheck || lower.includes('500') || lower.includes('crash'))) {
      const firstErr = criticalErrors[0];
      checks.push({
        criterion,
        result: 'violated',
        evidence: `Terdeteksi ${firstErr.type}: "${firstErr.message.slice(0, 90)}"`,
      });
      continue;
    }

    if (deadClicks.length > 0 && lower.includes('merespons')) {
      const firstDc = deadClicks[0];
      checks.push({
        criterion,
        result: 'violated',
        evidence: `Dead click terdeteksi pada ${firstDc.data?.selector || 'elemen interaktif'}`,
      });
      continue;
    }

    // Check LLM evaluation if available
    if (hasLLMEval && llmResults[criterion]) {
      checks.push({
        criterion,
        result: llmResults[criterion].result,
        evidence: llmResults[criterion].evidence,
      });
      continue;
    }

    // Deterministic fallback evaluation without LLM
    if (isNegativeCheck) {
      if (criticalErrors.length === 0) {
        checks.push({
          criterion,
          result: 'met',
          evidence: 'Tidak ada sinyal error runtime atau HTTP 500 terdeteksi.',
        });
      } else {
        checks.push({
          criterion,
          result: 'violated',
          evidence: `Terdeteksi error: ${criticalErrors[0].message.slice(0, 80)}`,
        });
      }
    } else {
      // Semantic positive criterion without LLM verification -> inconclusive
      checks.push({
        criterion,
        result: 'unknown',
        evidence: 'Memerlukan pemeriksaan semantik visual atau evaluasi model multimodal.',
      });
    }
  }

  // 3. Determine overall status
  const anyViolated = checks.some((c) => c.result === 'violated') || criticalErrors.length > 0;
  const anyUnknown = checks.some((c) => c.result === 'unknown');
  const allMet = checks.every((c) => c.result === 'met');

  let status: 'passed' | 'failed' | 'inconclusive' = 'passed';
  let verdict = '';

  if (anyViolated) {
    status = 'failed';
    const violated = checks.filter((c) => c.result === 'violated');
    verdict = violated.length > 0
      ? `Gagal: ${violated.map((v) => `${v.criterion} (${v.evidence})`).join('; ')}`
      : `Gagal: Terdeteksi error ${criticalErrors[0]?.message.slice(0, 80)}`;
  } else if (allMet) {
    status = 'passed';
    verdict = `Lulus: Semua ${checks.length} kriteria terverifikasi terpenuhi.`;
  } else if (anyUnknown) {
    status = 'inconclusive';
    const unknownChecks = checks.filter((c) => c.result === 'unknown');
    verdict = `Belum terverifikasi: ${unknownChecks.map((u) => u.criterion).join(', ')} memerlukan verifikasi lanjutan.`;
  }

  return {
    status,
    verdict,
    checks,
  };
}

