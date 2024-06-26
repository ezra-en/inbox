import { env } from './env';
import { Hono } from 'hono';
import { db } from '@u22n/database';
import { serve } from '@hono/node-server';
import { trpcMailBridgeRouter } from './trpc';
import { trpcServer } from '@hono/trpc-server';
import { eventApi } from './postal-routes/events';
import { inboundApi } from './postal-routes/inbound';
import { signatureMiddleware } from './postal-routes/signature-middleware';

const app = new Hono();

// Health check endpoint
app.get('/', (c) => c.json({ status: "I'm Alive 🏝️" }));

// TRPC handler
app.use(
  '/trpc/*',
  trpcServer({
    router: trpcMailBridgeRouter,
    createContext: (_, c) => {
      const authToken = c.req.header('Authorization');
      const isServiceAuthenticated = authToken === env.MAILBRIDGE_KEY;
      return { auth: isServiceAuthenticated, db, config: env, context: c };
    }
  })
);

// Postal endpoints
app.use('/postal/*', signatureMiddleware);
app.route('/postal', eventApi);
app.route('/postal', inboundApi);

// 404 handler
app.notFound((c) => c.json({ message: 'Not Found' }, 404));

serve({
  fetch: app.fetch,
  port: env.PORT
}).on('listening', () => {
  console.info(`Server listening on port ${env.PORT}`);
});
