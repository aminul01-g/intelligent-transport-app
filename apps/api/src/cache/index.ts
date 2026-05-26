import Redis from 'ioredis';
import { env } from '../config/env';

// ──────────────────────────────────────────────
// Retry strategy (shared by both clients)
// ──────────────────────────────────────────────

const MAX_RETRIES = 10;

function retryStrategy(times: number): number | null {
  if (times > MAX_RETRIES) {
    console.error(`[REDIS] Exceeded ${MAX_RETRIES} reconnection attempts — giving up`);
    return null; // stop retrying
  }
  // Exponential backoff: 100ms, 200ms, 400ms … capped at 30s
  const delay = Math.min(100 * Math.pow(2, times - 1), 30_000);
  console.warn(`[REDIS] Reconnecting in ${delay}ms (attempt ${times}/${MAX_RETRIES})`);
  return delay;
}

// ──────────────────────────────────────────────
// Clients
// ──────────────────────────────────────────────

/** Main command client — used for GET / SET / DEL / PUBLISH. */
const redis = new Redis(env.REDIS_URL, {
  retryStrategy,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

/**
 * Dedicated subscriber client.
 *
 * ioredis requires a separate connection for SUBSCRIBE because once a
 * client enters subscriber mode it can no longer issue regular commands.
 */
const subscriber = new Redis(env.REDIS_URL, {
  retryStrategy,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Log lifecycle events
for (const [name, client] of [['redis', redis], ['subscriber', subscriber]] as const) {
  client.on('connect', () => console.log(`[REDIS] ${name} connected`));
  client.on('error', (err) => console.error(`[REDIS] ${name} error:`, err.message));
}

// ──────────────────────────────────────────────
// Typed cache service
// ──────────────────────────────────────────────

async function get<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

async function set(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  const serialised = JSON.stringify(value);
  if (ttlSeconds !== undefined) {
    await redis.set(key, serialised, 'EX', ttlSeconds);
  } else {
    await redis.set(key, serialised);
  }
}

async function del(key: string): Promise<void> {
  await redis.del(key);
}

// ──────────────────────────────────────────────
// Pub / Sub
// ──────────────────────────────────────────────

async function publish(channel: string, message: unknown): Promise<void> {
  await redis.publish(channel, JSON.stringify(message));
}

async function subscribe(
  channel: string,
  handler: (message: unknown) => void,
): Promise<void> {
  await subscriber.subscribe(channel);
  subscriber.on('message', (ch, raw) => {
    if (ch !== channel) return;
    try {
      handler(JSON.parse(raw));
    } catch {
      handler(raw);
    }
  });
}

// ──────────────────────────────────────────────
// Health & lifecycle
// ──────────────────────────────────────────────

async function isHealthy(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

async function close(): Promise<void> {
  await Promise.all([redis.quit(), subscriber.quit()]);
  console.log('[REDIS] Both clients disconnected');
}

/**
 * Eagerly open both connections.  Call once at server startup.
 */
async function connect(): Promise<void> {
  await Promise.all([redis.connect(), subscriber.connect()]);
}

export const cache = {
  get,
  set,
  del,
  publish,
  subscribe,
  isHealthy,
  close,
  connect,
} as const;
