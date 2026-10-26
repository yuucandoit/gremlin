import type { Signal } from '@gremlin/shared';
import type { Page } from 'playwright';

export class ConsoleDetector {
  private signals: Signal[] = [];
  private runId: string;
  private currentStep = 0;

  constructor(runId: string) {
    this.runId = runId;
  }

  attach(page: Page): void {
    // 1. Console messages
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        const text = msg.text();
        // Ignore benign browser/dev noise if desired, but capture true errors
        this.signals.push({
          id: crypto.randomUUID(),
          runId: this.runId,
          stepNumber: this.currentStep,
          type: type === 'error' ? 'console_error' : 'console_warn',
          message: text,
          data: {
            location: msg.location(),
            type,
          },
          timestamp: new Date().toISOString(),
        });
      }
    });

    // 2. Uncaught exceptions on the page
    page.on('pageerror', (err) => {
      this.signals.push({
        id: crypto.randomUUID(),
        runId: this.runId,
        stepNumber: this.currentStep,
        type: 'unhandled_rejection',
        message: err.message || String(err),
        data: {
          name: err.name,
          stack: err.stack,
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  setStep(step: number): void {
    this.currentStep = step;
  }

  flush(): Signal[] {
    const batch = [...this.signals];
    this.signals = [];
    return batch;
  }
}
