// ──────────────────────────────────────────────
// Environment validation runs FIRST — before any other import
// can reference process.env values.
// ──────────────────────────────────────────────
import { env } from './config/env';

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { db } from './db';
import { cache } from './cache';
import { errorHandler } from './middleware/errorHandler';
import v1Router from './routes/v1';

// ──────────────────────────────────────────────
// Express application
// ──────────────────────────────────────────────

const app = express();

// ── 1. Helmet — security headers + CSP ──
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

// ── 2. CORS — strict allowlist from CORS_ORIGIN ──
const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (server-to-server, curl, health probes)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  }),
);

// ── 3. Morgan — HTTP request logging ──
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── 4. Compression ──
app.use(compression());

// ── 5. Body parsing ──
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────

// Versioned API router
app.use('/api/v1', v1Router);

// Health check — inline, returns DB + Redis status
app.get('/health', async (_req, res) => {
  const [dbHealthy, redisHealthy] = await Promise.all([
    db.isHealthy(),
    cache.isHealthy(),
  ]);

  const status = dbHealthy && redisHealthy ? 'healthy' : 'degraded';
  const statusCode = status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    success: true,
    data: {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
    },
  });
});

// ──────────────────────────────────────────────
// Centralised error handler — LAST middleware
// ──────────────────────────────────────────────

app.use(errorHandler);

export default app;
