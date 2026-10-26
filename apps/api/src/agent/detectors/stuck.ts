import type { Signal } from '@gremlin/shared';

export class StuckDetector {
  private runId: string;
  private currentStep = 0;
  private consecutiveSameUrlCount = 0;
  private lastUrl = '';

  constructor(runId: string) {
    this.runId = runId;
  }

  setStep(step: number): void {
    this.currentStep = step;
  }

  recordUrl(currentUrl: string): Signal | null {
    if (currentUrl === this.lastUrl) {
      this.consecutiveSameUrlCount++;
    } else {
      this.consecutiveSameUrlCount = 1;
      this.lastUrl = currentUrl;
    }

    // If stuck on same page for 8 steps without progression
    if (this.consecutiveSameUrlCount >= 8) {
      return {
        id: crypto.randomUUID(),
        runId: this.runId,
        stepNumber: this.currentStep,
        type: 'stuck_loop',
        message: `Agent potentially stuck on '${currentUrl}' for ${this.consecutiveSameUrlCount} consecutive steps`,
        data: {
          url: currentUrl,
          consecutiveSteps: this.consecutiveSameUrlCount,
        },
        timestamp: new Date().toISOString(),
      };
    }

    return null;
  }
}
