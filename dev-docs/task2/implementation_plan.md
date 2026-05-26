# Set Up `/apps/api` — Express 5 + TypeScript Backend

Build the full backend application for the Intelligent Transport Ecosystem on top of the existing monorepo scaffold (Prompt 1.1).

## User Review Required

> [!IMPORTANT]
> **Express 5 breaking change**: Express 5 (`express@^5.1`) has native promise-rejection handling in route handlers, so raw `async (req, res) => {}` routes automatically forward thrown errors to the error handler. An `asyncHandler` utility is still included as a safety net for middleware and for explicit error forwarding patterns.

> [!WARNING]
> **Module system override**: The base tsconfig uses `module: "ESNext"` / `moduleResolution: "bundler"`, which targets bundler toolchains. The API's [tsconfig.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/tsconfig.json) will be overridden to `module: "CommonJS"` / `moduleResolution: "node"` since it runs in Node.js via `ts-node`. This does **not** affect the web app or shared packages.

> [!IMPORTANT]
> **`redis` → `ioredis` swap**: The existing `package.json` lists `redis` (node-redis v4). The spec requires `ioredis` for its separate subscriber-client pattern. `redis` will be removed and replaced with `ioredis`.

## Open Questions

> [!IMPORTANT]
> **CORS_ORIGIN env var**: The spec says "strict allowlist from `CORS_ORIGIN` env var". I'll parse it as a comma-separated string (e.g. `http://localhost:3000,https://app.transport.com`). Is that acceptable, or do you prefer a different format?

## Proposed Changes

### Shared Types — `packages/shared-types/src/`

Expand the shared types package with the new enums and type contracts. The existing types in [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/index.ts) are preserved; new files are re-exported from the barrel.

#### [NEW] [enums.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/enums.ts)
- `UserRole`: PASSENGER, DRIVER, MANAGER, COMPANY_LEAD
- `PassengerCategory`: REGULAR, STUDENT, WORKER, GOVT_PERSONNEL
- `BusStatus`: ACTIVE, INACTIVE, BREAKDOWN, MAINTENANCE
- `IncidentType`: ACCIDENT, BREAKDOWN, DELAY, SECURITY, OTHER
- `IncidentSeverity`: LOW, MEDIUM, HIGH, CRITICAL
- `IncidentStatus`: REPORTED, ACKNOWLEDGED, INVESTIGATING, RESOLVED, CLOSED

#### [NEW] [api.types.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/api.types.ts)
- `ApiResponse<T>` — discriminated union `{ success: true; data: T } | { success: false; message: string; code: string }`
- `PaginatedResponse<T>` — `{ items: T[]; total: number; page: number; limit: number }`

#### [NEW] [live-bus.types.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/live-bus.types.ts)
- `LiveBusPayload` interface with all specified fields

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/index.ts)
- Add `export * from './enums';`, `export * from './api.types';`, `export * from './live-bus.types';`

---

### API Dependencies — `apps/api/package.json`

#### [MODIFY] [package.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/package.json)

**Add dependencies:**
| Package | Version | Purpose |
|---|---|---|
| `express` | `^5.1.0` | Express 5 (upgrade from 4) |
| `helmet` | `^8.1.0` | Security headers + CSP |
| `morgan` | `^1.10.0` | HTTP request logging |
| `compression` | `^1.8.0` | gzip response compression |
| `ioredis` | `^5.6.1` | Redis client + pub/sub |
| `socket.io` | `^4.8.0` | WebSocket server |
| `jsonwebtoken` | `^9.0.2` | JWT verification for Socket.IO |
| `zod` | `^3.25.0` | Env validation schema |

**Add devDependencies:**
| Package | Version |
|---|---|
| `@types/morgan` | `^1.9.9` |
| `@types/compression` | `^1.7.5` |
| `@types/jsonwebtoken` | `^9.0.9` |

**Remove:**
- `redis` (replaced by `ioredis`)

---

### API TypeScript Config

#### [MODIFY] [tsconfig.json](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/tsconfig.json)
- Override `module: "CommonJS"`, `moduleResolution: "node"` for Node.js runtime compatibility with ts-node
- Add `resolveJsonModule: true`

---

### API Source Files — `apps/api/src/`

All new files below. The existing [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/index.ts) will be replaced with a thin server bootstrap.

#### [NEW] [env.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/config/env.ts)
- Zod schema validating: `NODE_ENV`, `API_PORT`, `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`, `CORS_ORIGIN`, `GOOGLE_MAPS_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- Runs at module load; logs ALL errors and exits on failure
- Exports typed `env` object

#### [NEW] [AppError.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/errors/AppError.ts)
- `class AppError extends Error` with `statusCode`, `code` (string), `isOperational`
- Static factories: `notFound()`, `unauthorized()`, `forbidden()`, `badRequest()`, `conflict()`

#### [NEW] [asyncHandler.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/middleware/asyncHandler.ts)
- Wraps async Express handlers to catch rejections and forward to `next()`

#### [NEW] [errorHandler.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/middleware/errorHandler.ts)
- Catches `AppError` (operational) and unknown errors
- Returns `{ success: false, message, code, stack? }` (stack only in development)

#### [NEW] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/db/index.ts)
- `pg.Pool` with `min`/`max` from `env`
- `db.query<T>()` — typed wrapper
- `db.transaction<T>(fn)` — acquires client, BEGIN, fn, COMMIT/ROLLBACK
- `db.isHealthy()` — `SELECT 1`
- `db.close()` — drains pool

#### [NEW] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/cache/index.ts)
- Main `ioredis` client with exponential backoff retry (max 10)
- Separate `subscriber` client instance
- `cache.get<T>()`, `cache.set()`, `cache.del()`
- `cache.publish()`, `cache.subscribe()` (uses subscriber client, JSON parse)
- `cache.isHealthy()` — PING
- `cache.close()` — disconnects both clients

#### [NEW] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/realtime/index.ts)
- Attaches Socket.IO to HTTP server
- CORS config matching Express cors settings
- JWT auth middleware on handshake (`socket.handshake.auth.token`)
- Namespaces: `/passenger`, `/driver`, `/manager`
- Connect/disconnect logging with userId + namespace

#### [NEW] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/routes/v1/index.ts)
- Versioned router — placeholder with a `GET /` route returning API version info

#### [NEW] [app.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/app.ts)
- Imports `env` first (triggers validation)
- Middleware stack in order: helmet → cors → morgan → compression → json → urlencoded
- Mounts `/api/v1` router
- Inline `GET /health` — checks `db.isHealthy()` + `cache.isHealthy()`
- Error handler as last middleware

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/index.ts)
- Thin server bootstrap: creates HTTP server from `app`, attaches Socket.IO, listens
- Graceful shutdown on SIGTERM/SIGINT: stop accepting connections → wait for in-flight (10s timeout) → close DB pool → close Redis → exit

---

### API Env Example Update

#### [MODIFY] [.env.example](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/.env.example)
- Add `CORS_ORIGIN=http://localhost:3000`

---

## Verification Plan

### Automated Tests
```bash
# 1. Install all dependencies
cd /home/aminul/Development/Work/intelligent-transport-app && npm install

# 2. TypeScript compilation — shared-types
npm run build -w @transport/shared-types

# 3. TypeScript type-check — API (no emit, just validate)
npm run typecheck -w @transport/api

# 4. TypeScript build — API
npm run build -w @transport/api
```

### Manual Verification
- Verify the compiled output in `apps/api/dist/` contains all modules
- Spot-check that `@transport/shared-types` enums are importable from the API
