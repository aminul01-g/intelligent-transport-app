# API App Setup — Task Tracker

## 1. Shared Types (`packages/shared-types/src/`)
- [x] Create `enums.ts`
- [x] Create `api.types.ts`
- [x] Create `live-bus.types.ts`
- [x] Update `index.ts` barrel exports

## 2. API Dependencies
- [x] Update `apps/api/package.json` (Express 5, helmet, morgan, compression, ioredis, socket.io, jsonwebtoken, zod, types)
- [x] Run `npm install`

## 3. API TypeScript Config
- [x] Override `tsconfig.json` for CommonJS + Node moduleResolution

## 4. API Source Files
- [x] `src/config/env.ts` — Zod env validation
- [x] `src/errors/AppError.ts` — typed error class + factories
- [x] `src/middleware/asyncHandler.ts` — async wrapper
- [x] `src/middleware/errorHandler.ts` — centralized error handler
- [x] `src/db/index.ts` — pg Pool + query/transaction/health
- [x] `src/cache/index.ts` — ioredis + subscriber + cache service
- [x] `src/realtime/index.ts` — Socket.IO + JWT auth + namespaces
- [x] `src/routes/v1/index.ts` — versioned router placeholder
- [x] `src/app.ts` — Express app + middleware stack
- [x] `src/index.ts` — server bootstrap + graceful shutdown

## 5. Env Example
- [x] Update `.env.example` with `CORS_ORIGIN`

## 6. Verification
- [x] `npm install` succeeds
- [x] `npm run build -w @transport/shared-types` succeeds
- [x] `npm run typecheck -w @transport/api` succeeds
- [x] `npm run build -w @transport/api` succeeds
