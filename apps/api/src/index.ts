import cors from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { runAgentLoop } from './agent/loop';
import { PERSONAS } from './agent/personas';
import { runMigrations } from './db/migrate';
import { runQueue } from './lib/queue';
import { eventsRoutes } from './routes/events';
import { reportRoutes } from './routes/report';
import { runsRoutes } from './routes/runs';

// 1. Initialize SQLite tables
runMigrations();

// 2. Wire queue worker to agent execution loop
runQueue.setHandler(async (runId: string) => {
  await runAgentLoop(runId);
});

// 3. Assemble Elysia Application
const port = Number(process.env.PORT) || 3001;

const app = new Elysia()
  .use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    })
  )
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'gremlin-api',
  }))
  .get('/personas', () => Object.values(PERSONAS))
  .use(runsRoutes)
  .use(eventsRoutes)
  .use(reportRoutes)
  .listen(port);

console.log(`👾 Gremlin API running on http://localhost:${port}`);

export type App = typeof app;
export { app };
