import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env BEFORE validation so process.env is populated.
dotenv.config();

// ──────────────────────────────────────────────
// Schema
// ──────────────────────────────────────────────

const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // CORS — comma-separated origins
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().min(1),

  // SMTP
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),

  // VAPID
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1),
});

// ──────────────────────────────────────────────
// Validate at module load
// ──────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.flatten().fieldErrors;

  console.error('\n❌  Environment validation failed:\n');
  for (const [field, errors] of Object.entries(formatted)) {
    console.error(`   ${field}: ${(errors as string[]).join(', ')}`);
  }
  console.error('');

  // Exit immediately — the app cannot run with missing config.
  process.exit(1);
}

/**
 * Typed, validated environment variables.
 *
 * Import this object instead of reading `process.env` directly so that
 * every consumer gets compile-time safety and runtime guarantees.
 */
export const env = Object.freeze(parsed.data);

export type Env = z.infer<typeof envSchema>;
