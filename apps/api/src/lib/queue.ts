import { runsRepo } from '../db/repo/runs';
import { eventBus } from './events';

type RunHandler = (runId: string) => Promise<void>;

class RunQueue {
  private queue: string[] = [];
  private activeRuns = new Set<string>();
  private concurrency = 2;
  private handler: RunHandler | null = null;

  setHandler(handler: RunHandler): void {
    this.handler = handler;
  }

  enqueue(runId: string): void {
    if (this.activeRuns.has(runId) || this.queue.includes(runId)) {
      return;
    }
    this.queue.push(runId);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.activeRuns.size >= this.concurrency) {
      return;
    }

    const runId = this.queue.shift();
    if (!runId) return;

    if (!this.handler) {
      console.warn('[RunQueue] No handler registered for run:', runId);
      return;
    }

    this.activeRuns.add(runId);

    try {
      runsRepo.updateStatus(runId, 'running');
      const run = runsRepo.getById(runId);
      if (run) {
        eventBus.emitRunEvent({
          type: 'run:started',
          runId,
          timestamp: new Date().toISOString(),
          data: { run },
        });
      }

      await this.handler(runId);
    } catch (err: any) {
      console.error(`[RunQueue] Run ${runId} execution failed:`, err);
      runsRepo.updateStatus(runId, 'failed', err?.message || 'Unknown agent execution error');
      eventBus.emitRunEvent({
        type: 'run:failed',
        runId,
        timestamp: new Date().toISOString(),
        data: { runId, error: err?.message || 'Run failed unexpectedly' },
      });
    } finally {
      this.activeRuns.delete(runId);
      // Trigger next job in queue
      this.processNext();
    }
  }

  isProcessing(runId: string): boolean {
    return this.activeRuns.has(runId);
  }

  getActiveCount(): number {
    return this.activeRuns.size;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

export const runQueue = new RunQueue();
