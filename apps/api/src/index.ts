import http from 'http';
import app from './app';
import { env } from './config/env';
import { db } from './db';
import { cache } from './cache';
import { initSocketIO } from './realtime';
import { initTelemetryGateway } from './modules/telemetry/telemetry.gateway';
import { telemetryService } from './modules/telemetry/telemetry.service';

// ──────────────────────────────────────────────
// Server bootstrap
// ──────────────────────────────────────────────

const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
initSocketIO(server);

// Attach telemetry gateway (registers event handlers)
initTelemetryGateway();

async function start(): Promise<void> {
  // Eagerly connect Redis (both main + subscriber)
  await cache.connect();
  console.log('[BOOT] Redis connected');

  // Start periodic flush of telemetry buffer
  telemetryService.startFlushLoop();

  server.listen(env.API_PORT, () => {
    console.log(
      `[BOOT] Server listening on port ${env.API_PORT} (${env.NODE_ENV})`,
    );
  });
}

start().catch((err) => {
  console.error('[BOOT] Failed to start server:', err);
  process.exit(1);
});

// ──────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[SHUTDOWN] ${signal} received — starting graceful shutdown`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('[SHUTDOWN] HTTP server closed');
  });

  // 2. Wait for in-flight requests to drain (max 10s)
  const forceExit = setTimeout(() => {
    console.error('[SHUTDOWN] Timed out waiting for connections to drain — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // 3. Flush any buffered telemetry records
    telemetryService.stopFlushLoop();
    await telemetryService.flushBuffer();

    // 4. Close infrastructure connections
    await Promise.all([db.close(), cache.close()]);
    
    console.log('[SHUTDOWN] All connections closed — exiting');
    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    console.error('[SHUTDOWN] Error during cleanup:', err);
    clearTimeout(forceExit);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
