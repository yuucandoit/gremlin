import type { TestPlan } from '@gremlin/shared';
import type { Page } from 'playwright';
import { llmClient } from '../llm/client';

export async function conductReconnaissance(
  page: Page,
  targetUrl: string,
  personaName: string
): Promise<TestPlan> {
  const pageTitle = await page.title().catch(() => '');
  const pageUrl = page.url();

  // Inspect page characteristics
  const pageAnalysis = await page
    .evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      const hasAuth =
        text.includes('login') ||
        text.includes('sign in') ||
        text.includes('masuk') ||
        !!document.querySelector('input[type="password"]');
      const hasCart =
        text.includes('cart') ||
        text.includes('checkout') ||
        text.includes('keranjang') ||
        text.includes('order');
      const hasForms = document.querySelectorAll('form, input').length > 0;

      return { hasAuth, hasCart, hasForms, textSample: text.slice(0, 300) };
    })
    .catch(() => ({ hasAuth: false, hasCart: false, hasForms: false, textSample: '' }));

  // Generate test plan via Muse Spark / LLM
  if (llmClient.hasLLMConfigured()) {
    try {
      const prompt = `You are Meta Muse Spark, an autonomous QA strategist.
Analyze this target web application:
URL: ${pageUrl}
Title: ${pageTitle}
Detected Auth: ${pageAnalysis.hasAuth}
Detected Cart/Checkout: ${pageAnalysis.hasCart}
Persona: ${personaName}

Formulate a concise testing plan in JSON:
{
  "overview": "Brief 1-sentence description of the application scope",
  "authDetected": ${pageAnalysis.hasAuth},
  "phases": [
    "Phase 1: ...",
    "Phase 2: ...",
    "Phase 3: ..."
  ],
  "riskAreas": [
    "Risk 1: ...",
    "Risk 2: ..."
  ]
}
Return raw JSON only.`;

      const plan = await llmClient.generateReconPlan(prompt);
      if (plan && plan.phases) {
        return plan;
      }
    } catch (err) {
      console.warn('[Recon] LLM test plan generation failed, using heuristic strategy:', err);
    }
  }

  // Fallback Deterministic Reconnaissance Plan
  return {
    overview: pageAnalysis.hasCart
      ? `Online storefront with interactive checkout flow and product catalog.`
      : `Interactive web application at ${pageUrl}.`,
    authDetected: pageAnalysis.hasAuth,
    phases: [
      pageAnalysis.hasAuth
        ? 'Phase 1: Recon & Authentication Security (verify credentials & enumeration leaks)'
        : 'Phase 1: Landing Page Discovery & Visual Contrast Audit',
      pageAnalysis.hasCart
        ? 'Phase 2: Shopping Funnel & Boundary Testing (negative quantities, coupon validation)'
        : 'Phase 2: Navigation & Form Input Boundary Fuzzing',
      'Phase 3: Chaos Injection & Race Condition Probing (rapid clicks, double submit)',
      'Phase 4: Synthesis & Playwright Regression Test Generation',
    ],
    riskAreas: [
      pageAnalysis.hasCart ? 'Race condition on double-click checkout' : 'Unresponsive interactive elements',
      'Unhandled client-side Unicode/Emoji rendering exceptions',
      'Server-side 500 exceptions on boundary coupon inputs',
    ],
  };
}

