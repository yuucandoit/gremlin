import type { Finding, Step } from '@gremlin/shared';
import { storage } from '../lib/storage';

export function exportRegressionSpec(
  runId: string,
  targetUrl: string,
  steps: Step[],
  findings: Finding[],
  viewport?: 'desktop' | 'mobile'
): string {
  const primaryFinding = findings[0];
  const testTitle = primaryFinding
    ? `Regression: ${primaryFinding.title}`
    : `Regression Run ${runId}`;

  const isMobile = viewport === 'mobile';
  const generatedSteps: string[] = [];

  for (const step of steps) {
    const act = step.action;
    const actorLabel = step.actor === 'human' ? 'HUMAN CO-PILOT' : 'GREMLIN AI';
    switch (act.type) {
      case 'navigate':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Navigate`);
        generatedSteps.push(`  await page.goto('${act.url}', { waitUntil: 'domcontentloaded' });`);
        break;

      case 'click':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Click`);
        generatedSteps.push(`  await page.locator('${act.selector}').first().click();`);
        break;

      case 'double_click':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Double Click`);
        generatedSteps.push(`  await page.locator('${act.selector}').first().dblclick({ delay: 50 });`);
        break;

      case 'type':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Type`);
        if (act.clearFirst) {
          generatedSteps.push(`  await page.locator('${act.selector}').first().fill('');`);
        }
        generatedSteps.push(
          `  await page.locator('${act.selector}').first().pressSequentially(${JSON.stringify(act.text)});`
        );
        break;

      case 'press_key':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Press Key`);
        if (act.selector) {
          generatedSteps.push(`  await page.locator('${act.selector}').first().focus();`);
        }
        generatedSteps.push(`  await page.keyboard.press('${act.key}');`);
        break;

      case 'wait':
        generatedSteps.push(`  // Step ${step.stepNumber} [${actorLabel}]: Wait`);
        generatedSteps.push(`  await page.waitForTimeout(${act.ms});`);
        break;
    }
  }

  const specContent = `/**
 * Gremlin Autonomous QA Test Runner
 * Auto-generated Regression Spec for Run: ${runId}
 * Target URL: ${targetUrl}
 * Generated At: ${new Date().toISOString()}
 * Findings Count: ${findings.length}
 */

import { test, expect } from '@playwright/test';

test.describe('Gremlin Automated Regression Suite', () => {
  test('${testTitle.replace(/'/g, "\\'")}', async ({ page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: number[] = [];

    // Telemetry capture
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 500) {
        serverErrors.push(res.status());
      }
    });

    // Initial navigation
    ${isMobile ? "await page.setViewportSize({ width: 390, height: 844 });\n    " : ''}await page.goto('${targetUrl}', { waitUntil: 'networkidle' });

${generatedSteps.join('\n\n')}

    // Assertions: Ensure no fatal errors occur during regression
    expect(serverErrors, 'Server should not return HTTP 5xx errors').toHaveLength(0);
    expect(consoleErrors, 'Client application should not throw unhandled errors').toHaveLength(0);
  });
});
`;

  storage.saveRegressionSpec(runId, specContent);
  return specContent;
}
