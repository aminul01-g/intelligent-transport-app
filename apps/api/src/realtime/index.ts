import http from 'http';
import { Server, Namespace } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Augment SocketData interface in socket.io to carry user info after auth.
declare module 'socket.io' {
  interface SocketData {
    user?: JwtPayload;
  }
}

// ──────────────────────────────────────────────
// Namespace references (exported for use in route handlers)
// ──────────────────────────────────────────────

export let io: Server;
export let passengerNs: Namespace;
export let driverNs: Namespace;
export let managerNs: Namespace;

// ──────────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────────

/**
 * Create the Socket.IO server attached to the provided HTTP server.
 *
 * - CORS mirrors the Express config (parsed from CORS_ORIGIN env var).
 * - JWT auth middleware runs during the handshake; unauthenticated
 *   connections are rejected with a descriptive error event.
 * - Three namespaces (/passenger, /driver, /manager) are created
 *   and exported for domain-specific event routing.
 */
export function initSocketIO(httpServer: http.Server): Server {
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── JWT auth middleware (applies to all namespaces) ──

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;

    if (!token) {
      const err = new Error('Authentication error: token missing');
      (err as Error & { data: unknown }).data = { code: 'AUTH_TOKEN_MISSING' };
      return next(err);
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch {
      const err = new Error('Authentication error: invalid token');
      (err as Error & { data: unknown }).data = { code: 'AUTH_TOKEN_INVALID' };
      next(err);
    }
  });

  // ── Namespaces ──

  passengerNs = io.of('/passenger');
  driverNs = io.of('/driver');
  managerNs = io.of('/manager');

  // Apply the same auth middleware to each namespace.
  for (const ns of [passengerNs, driverNs, managerNs]) {
    ns.use((socket, next) => {
      const token = socket.handshake.auth.token as string | undefined;

      if (!token) {
        const err = new Error('Authentication error: token missing');
        (err as Error & { data: unknown }).data = { code: 'AUTH_TOKEN_MISSING' };
        return next(err);
      }

      try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
        socket.data.user = decoded;
        next();
      } catch {
        const err = new Error('Authentication error: invalid token');
        (err as Error & { data: unknown }).data = { code: 'AUTH_TOKEN_INVALID' };
        next(err);
      }
    });

    ns.on('connection', (socket) => {
      const userId = socket.data.user?.sub ?? 'unknown';
      console.log(`[SOCKET] ${ns.name} — connected: userId=${userId} socketId=${socket.id}`);

      socket.on('disconnect', (reason) => {
        console.log(
          `[SOCKET] ${ns.name} — disconnected: userId=${userId} socketId=${socket.id} reason=${reason}`,
        );
      });
    });
  }

  // Default namespace logging
  io.on('connection', (socket) => {
    const userId = socket.data.user?.sub ?? 'unknown';
    console.log(`[SOCKET] / — connected: userId=${userId} socketId=${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(
        `[SOCKET] / — disconnected: userId=${userId} socketId=${socket.id} reason=${reason}`,
      );
    });
  });

  console.log('[SOCKET] Socket.IO initialised with namespaces: /passenger, /driver, /manager');

  return io;
}
