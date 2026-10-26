import type { Signal } from '@gremlin/shared';
import type { Page } from 'playwright';

export class NetworkDetector {
  private signals: Signal[] = [];
  private runId: string;
  private currentStep = 0;
  private recentRequestsCount = 0;

  constructor(runId: string) {
    this.runId = runId;
  }

  attach(page: Page): void {
    // 1. Failed requests (network errors, CORS, aborted)
    page.on('requestfailed', (req) => {
      const failure = req.failure();
      this.signals.push({
        id: crypto.randomUUID(),
        runId: this.runId,
        stepNumber: this.currentStep,
        type: 'network_error',
        message: `Request failed: ${req.method()} ${req.url()} (${failure?.errorText || 'Unknown'})`,
        data: {
          url: req.url(),
          method: req.method(),
          errorText: failure?.errorText,
          resourceType: req.resourceType(),
        },
        timestamp: new Date().toISOString(),
      });
    });

    // 2. HTTP responses (detect 4xx and 5xx status codes)
    page.on('response', (res) => {
      this.recentRequestsCount++;
      const status = res.status();
      if (status >= 500) {
        this.signals.push({
          id: crypto.randomUUID(),
          runId: this.runId,
          stepNumber: this.currentStep,
          type: 'http_5xx',
          message: `HTTP ${status} Server Error on ${res.request().method()} ${res.url()}`,
          data: {
            url: res.url(),
            method: res.request().method(),
            status,
            statusText: res.statusText(),
          },
          timestamp: new Date().toISOString(),
        });
      } else if (status >= 400 && status !== 404) {
        // Capture 4xx client errors (400, 401, 403, 422, etc.)
        this.signals.push({
          id: crypto.randomUUID(),
          runId: this.runId,
          stepNumber: this.currentStep,
          type: 'network_error',
          message: `HTTP ${status} Client Error on ${res.request().method()} ${res.url()}`,
          data: {
            url: res.url(),
            method: res.request().method(),
            status,
            statusText: res.statusText(),
          },
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  setStep(step: number): void {
    this.currentStep = step;
    this.recentRequestsCount = 0;
  }

  getRequestCount(): number {
    return this.recentRequestsCount;
  }

  flush(): Signal[] {
    const batch = [...this.signals];
    this.signals = [];
    return batch;
  }
}
