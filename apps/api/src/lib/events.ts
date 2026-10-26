import type { RunEvent } from '@gremlin/shared';
import { EventEmitter } from 'node:events';
import { db } from '../db/client';

class RunEventBus extends EventEmitter {
  emitRunEvent(event: RunEvent): void {
    // 1. Persist to run_events table
    try {
      db.prepare(`
        INSERT INTO run_events (id, run_id, event_type, payload_json, created_at)
        VALUES ($id, $runId, $eventType, $payloadJson, datetime('now'))
      `).run({
        $id: crypto.randomUUID(),
        $runId: event.runId,
        $eventType: event.type,
        $payloadJson: JSON.stringify(event),
      });
    } catch (err) {
      console.error('[EventBus] Failed to persist event:', err);
    }

    // 2. Emit to memory listeners for specific run
    this.emit(`run:${event.runId}`, event);
    // 3. Emit wildcard
    this.emit('run:*', event);
  }

  subscribe(runId: string, listener: (event: RunEvent) => void): () => void {
    const channel = `run:${runId}`;
    this.on(channel, listener);
    return () => {
      this.off(channel, listener);
    };
  }

  getHistory(runId: string): RunEvent[] {
    const rows = db
      .prepare('SELECT payload_json FROM run_events WHERE run_id = ? ORDER BY created_at ASC')
      .all(runId) as { payload_json: string }[];

    return rows.map((r) => JSON.parse(r.payload_json));
  }
}

export const eventBus = new RunEventBus();
