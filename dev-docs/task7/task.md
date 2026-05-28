# Telemetry & ETA Engine — Task List

## Phase 0: Env Config Fix
- [x] Make GOOGLE_MAPS_API_KEY optional in env.ts

## Phase 1: Cache Module Enhancement
- [x] Add `psubscribe(pattern, handler)` method using subscriber client
- [x] Add `zadd(key, score, member)` sorted-set wrapper
- [x] Add `zremrangeByRank(key, start, stop)` sorted-set wrapper
- [x] Add `zrangeWithScores(key, start, stop)` sorted-set wrapper
- [x] Export all new methods in the `cache` object

## Phase 2: Occupancy Service
- [x] Create `apps/api/src/modules/telemetry/occupancy.service.ts`
- [x] Implement `calculateOccupancyLevel()` with division-by-zero guard
- [x] Export as named function

## Phase 3: Telemetry Service
- [x] Create `apps/api/src/modules/telemetry/telemetry.service.ts`
- [x] Define `IngestLocationParams` and `TelemetryRecord` types
- [x] Implement shift metadata cache (fetch + cache with 5min TTL)
- [x] Implement `ingestLocation()`:
  - [x] Fetch/cache shift metadata
  - [x] Calculate occupancy
  - [x] Build LiveBusPayload
  - [x] Publish to Redis channel
  - [x] Buffer telemetry record in memory
  - [x] Traffic anomaly detection (sorted set + cooldown)
- [x] Implement `startFlushLoop()` — 3-second interval
- [x] Implement `flushBuffer()` — batch INSERT with ON CONFLICT DO NOTHING
- [x] Implement `stopFlushLoop()` — clearInterval
- [x] Implement `getLatestPositions(routeId)` — cache read + DB fallback
- [x] Implement `calculateETA()` — Google Maps primary + Haversine fallback
- [x] Add Haversine distance helper function
- [x] Add cross-reference TODO comment for fleet.service.ts cache invalidation

## Phase 4: Telemetry Gateway (Socket.IO)
- [x] Create `apps/api/src/modules/telemetry/telemetry.gateway.ts`
- [x] Define Zod validation schemas (LocationUpdate, BreakdownSignal, TrackBus)
- [x] Wire Driver namespace `/driver`:
  - [x] `location:update` handler with Zod validation
  - [x] `breakdown:signal` handler with Zod validation
- [x] Wire Passenger namespace `/passenger`:
  - [x] `track:bus` handler with Zod validation
  - [x] `untrack:bus` handler
- [x] Implement Redis→Socket.IO bridge:
  - [x] Pattern subscribe to `bus:live:*`
  - [x] Emit `bus:position` to passenger rooms
  - [x] Update positions cache (GET → merge → SET TTL 60s)

## Phase 5: Incident Service Stub
- [x] Create `apps/api/src/modules/incidents/incident.service.ts`
- [x] Stub `handleTrafficJam()` with TODO
- [x] Stub `createBreakdown()` with TODO

## Phase 6: Wire into App Entry Point
- [x] Modify `apps/api/src/index.ts`:
  - [x] Import telemetryService and initTelemetryGateway
  - [x] Call `initTelemetryGateway()` after `initSocketIO()`
  - [x] Call `telemetryService.startFlushLoop()` after cache connect
  - [x] Add `telemetryService.stopFlushLoop()` + `flushBuffer()` to shutdown handler

## Phase 7: Verification
- [x] Run `npx tsc --noEmit` — all files compile
- [x] Write unit test for occupancy.service.ts
- [x] Write unit test for calculateETA Haversine fallback
