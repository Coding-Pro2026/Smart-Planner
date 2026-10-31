import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createApi } from './src/server/api';
import { resolveAiConfig } from './src/server/aiClient';

/**
 * Long-running Node entry (local dev, Docker, any VM/PaaS).
 * On Netlify the same API runs as a serverless function instead: see netlify/functions/api.ts.
 */
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = createApi();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // Works both from source (./dist next to server.ts) and from the bundled dist/server.mjs
    const distPath = path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`PlanGenie server running on http://0.0.0.0:${PORT}`);
    console.log(
      resolveAiConfig({ headers: {} } as express.Request)
        ? 'AI mode: BYOK (users bring their own key) + server default key; automatic local-engine fallback'
        : 'AI mode: BYOK — users add their own key in AI Settings; built-in engine until then'
    );
  });
  if (isProd && !process.env.ENCRYPTION_MASTER_KEY) {
    console.warn(
      '[config] ENCRYPTION_MASTER_KEY is not set — using a random per-process key (vault data will not survive restarts). Set a 32+ char secret.'
    );
  }
  if (isProd && process.env.ENCRYPTION_MASTER_KEY && process.env.ENCRYPTION_MASTER_KEY.length < 32) {
    console.error('[config] ENCRYPTION_MASTER_KEY must be at least 32 characters.');
    process.exit(1);
  }
  const shutdown = (signal: string) => {
    console.log(`${signal} received — shutting down gracefully`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  server.keepAliveTimeout = 65_000;
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use.` : err);
    process.exit(1);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[server] uncaught exception:', err);
});

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
