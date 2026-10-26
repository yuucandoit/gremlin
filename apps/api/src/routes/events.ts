import type { RunEvent } from '@gremlin/shared';
import { Elysia } from 'elysia';
import { eventBus } from '../lib/events';

export const eventsRoutes = new Elysia({ prefix: '/runs' }).get(
  '/:id/events',
  ({ params: { id }, set }) => {
    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';
    set.headers['Access-Control-Allow-Origin'] = '*';

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        function sendEvent(evt: RunEvent) {
          const payload = `event: ${evt.type}\ndata: ${JSON.stringify(evt)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        }

        // 1. Replay historical events for this run
        const history = eventBus.getHistory(id);
        for (const evt of history) {
          sendEvent(evt);
        }

        // 2. Subscribe to live events
        const unsubscribe = eventBus.subscribe(id, (evt) => {
          sendEvent(evt);
        });

        // 3. Heartbeat timer
        const timer = setInterval(() => {
          try {
            sendEvent({
              type: 'heartbeat',
              runId: id,
              timestamp: new Date().toISOString(),
              data: { count: Date.now() },
            });
          } catch {
            clearInterval(timer);
          }
        }, 15000);

        // Cleanup when client disconnects
        return () => {
          clearInterval(timer);
          unsubscribe();
        };
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
);
