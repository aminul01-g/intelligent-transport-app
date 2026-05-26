# API Setup Walkthrough

We have successfully set up the backend structure for the `/apps/api` service using **Express 5** and **TypeScript**, aligned with the strict monorepo architecture and all technical constraints.

## Changes Made

### 1. Shared Types Expanded (`packages/shared-types/src/`)
- [enums.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/enums.ts): Defined core domain enums like `UserRole`, `PassengerCategory`, `BusStatus`, and incident lifecycle enums (`IncidentType`, `IncidentSeverity`, `IncidentStatus`).
- [api.types.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/api.types.ts): Added generic type envelopes `ApiResponse<T>` and `PaginatedResponse<T>` for consistent API outputs.
- [live-bus.types.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/live-bus.types.ts): Designed the `LiveBusPayload` real-time contract.
- [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/packages/shared-types/src/index.ts): Exported new files via the index barrel.

### 2. Environment Validation (`apps/api/src/config/env.ts`)
- Integrated a comprehensive **Zod** schema validating all incoming server, DB, Redis, auth, SMTP, and VAPID configurations.
- Validation executes eagerly at module-load. On failure, it dumps **all** errors in a friendly layout and calls `process.exit(1)`.

### 3. Operational Errors (`apps/api/src/errors/AppError.ts`)
- Created `class AppError extends Error` carrying HTTP `statusCode`, custom error string `code` (e.g. `NOT_FOUND`), and an `isOperational` flag.
- Equipped with standard static factory helpers: `notFound()`, `unauthorized()`, `forbidden()`, `badRequest()`, and `conflict()`.

### 4. Robust Database Pool (`apps/api/src/db/index.ts`)
- Wrapped `pg.Pool` utilizing pool sizes configured via validation.
- Implemented a transactional helper `db.transaction<T>(fn)` that manages client acquisition, issues transactional queries (BEGIN/COMMIT/ROLLBACK), and releases the client cleanly.
- Added a `db.isHealthy()` probe running `SELECT 1`.

### 5. Redis Command & Pub/Sub Caching (`apps/api/src/cache/index.ts`)
- Established a main command client (`ioredis`) with exponential retry backoff (up to 10 retries).
- Deployed a **separate** dedicated `subscriber` client for listening to subscription events (strictly keeping commands and subscriptions isolated).
- Implemented a typed cache service interface for JSON serialisation (`get`, `set`, `del`), publishing (`publish`), and subscription handling (`subscribe`).

### 6. Namespace Realtime Socket.IO (`apps/api/src/realtime/index.ts`)
- Created a Socket.IO instance attached to the HTTP server matching standard CORS origins.
- Embedded handshake auth middleware verifying incoming JWT tokens and storing decoded payloads in a properly augmented type-safe `SocketData` (`socket.data.user`).
- Divided socket connections into three distinct namespaces: `/passenger`, `/driver`, and `/manager`.
- Wired namespace connection/disconnection logs reflecting active user IDs.

### 7. Express Middleware Pipeline & Bootstrap (`apps/api/src/app.ts`, `apps/api/src/index.ts`)
- Initialized Express 5 application with strict security middlewares: `helmet` (configured with customized Content-Security-Policy), strict origin checking `cors`, `morgan` logs, gzip `compression`, and body limit parsing (`10kb`).
- Mounted `/api/v1` router, alongside an inline `/health` check executing DB and Redis probes concurrently.
- Registered a centralised error handler as the last middleware to catch operational `AppError` and runtime errors gracefully.
- Configured clean, graceful shutdown hooks (`SIGINT`/`SIGTERM`) ensuring that in-flight requests are drained (max 10s timeout) and all DB pools/Redis clients are ended safely before exiting.

---

## Verification Results

We verified the build pipeline by running full typechecks and compilation runs:

```bash
# Shared Types built successfully:
> @transport/shared-types@1.0.0 build
> tsc

# API Server compiles clean with zero typescript warnings:
> @transport/api@1.0.0 typecheck
> tsc --noEmit

# API Server successfully compiles production build:
> @transport/api@1.0.0 build
> tsc
```
All checks passed successfully!
