import type { Signal } from '@gremlin/shared';
import type { Page } from 'playwright';

export interface PreClickSnapshot {
  url: string;
  bodyLength: number;
  timestamp: number;
}

export class DeadClickDetector {
  private runId: string;
  private currentStep = 0;

  constructor(runId: string) {
    this.runId = runId;
  }

  setStep(step: number): void {
    this.currentStep = step;
  }

  async capturePreClick(page: Page): Promise<PreClickSnapshot> {
    try {
      const state = await page.evaluate(() => ({
        url: window.location.href,
        bodyLength: document.body?.innerHTML?.length || 0,
        timestamp: Date.now(),
      }));
      return state;
    } catch {
      return { url: '', bodyLength: 0, timestamp: Date.now() };
    }
  }

  async evaluatePostClick(
    page: Page,
    pre: PreClickSnapshot,
    selector: string,
    networkRequestsTriggered: number
  ): Promise<Signal | null> {
    try {
      // Small pause to allow animations or reactions
      await page.waitForTimeout(300);

      const post = await page.evaluate(() => ({
        url: window.location.href,
        bodyLength: document.body?.innerHTML?.length || 0,
      }));

      const urlChanged = post.url !== pre.url;
      const domChanged = Math.abs(post.bodyLength - pre.bodyLength) > 5;
      const hasNetwork = networkRequestsTriggered > 0;

      // If nothing happened at all:
      if (!urlChanged && !domChanged && !hasNetwork) {
        return {
          id: crypto.randomUUID(),
          runId: this.runId,
          stepNumber: this.currentStep,
          type: 'dead_click',
          message: `Unresponsive interaction (Dead Click) detected on element: ${selector}`,
          data: {
            selector,
            preUrl: pre.url,
            domDifference: Math.abs(post.bodyLength - pre.bodyLength),
            networkRequests: networkRequestsTriggered,
          },
          timestamp: new Date().toISOString(),
        };
      }
    } catch {
      // Ignore evaluation errors if page closed or navigated
    }

    return null;
  }
}
