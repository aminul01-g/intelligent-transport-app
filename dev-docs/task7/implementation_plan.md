# Telemetry & ETA Engine

Build the real-time telemetry ingestion pipeline, Socket.IO gateway, occupancy calculator, and ETA service for the intelligent transport system.

## User Review Required

> [!IMPORTANT]
> **Google Maps API key optionality** — ✅ RESOLVED: `GOOGLE_MAPS_API_KEY` in [env.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/config/env.ts#L36) will be changed from `z.string().min(1)` to `z.string().optional().default('')` so the Haversine fallback activates when no key is provided, per the spec.

> [!WARNING]
> **Incident service stub** — No `incidentService` exists yet. This plan creates a minimal stub file (`modules/incidents/incident.service.ts`) with `handleTrafficJam()` and `createBreakdown()` as TODOs. The full incident module will be built in a later prompt.

## Open Questions

1. **Traffic jam threshold** — The spec says "all 5 entries below 5 km/h". Should there be a cooldown period to avoid spamming `handleTrafficJam` on every ingest while the bus remains stuck? This plan adds a **60-second cooldown** via a Redis key `traffic:cooldown:{shiftId}` (TTL 60s). Let me know if you prefer a different duration or no cooldown.

2. **Redis subscriber for pattern subscribe** — The current [cache/index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/cache/index.ts) only exposes `subscribe(channel, handler)` using `subscriber.subscribe()`. The gateway needs **pattern-based** subscription (`PSUBSCRIBE 'bus:live:*'`). This plan adds a `psubscribe(pattern, handler)` method to the cache module. Confirm this is acceptable.

---

## Proposed Changes

### Cache Module Enhancement

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/cache/index.ts)

Add the following capabilities to the existing cache service:

- **`psubscribe(pattern, handler)`** — Uses the dedicated subscriber client's `psubscribe()` for pattern-based subscriptions (needed for `bus:live:*`). Listens on the `'pmessage'` event, parses JSON, and calls the handler with `(channel, parsedMessage)`.
- **`zadd(key, score, member)`** — Thin wrapper around `redis.zadd()` for the speed history sorted set.
- **`zremrangeByRank(key, start, stop)`** — Wrapper for pruning sorted set to last N entries.
- **`zrangeWithScores(key, start, stop)`** — Wrapper to read sorted set entries with scores for the anomaly check.
- **Expose raw `redis` client as `cache.client`** — Needed only for sorted-set pipeline operations. Alternatively, the wrappers above are sufficient.

```diff
+async function psubscribe(
+  pattern: string,
+  handler: (channel: string, message: unknown) => void,
+): Promise<void> {
+  await subscriber.psubscribe(pattern);
+  subscriber.on('pmessage', (_pattern, ch, raw) => {
+    try {
+      handler(ch, JSON.parse(raw));
+    } catch {
+      handler(ch, raw);
+    }
+  });
+}
+
+// Sorted-set wrappers for telemetry anomaly detection
+async function zadd(key: string, score: number, member: string): Promise<void> {
+  await redis.zadd(key, score, member);
+}
+
+async function zremrangeByRank(key: string, start: number, stop: number): Promise<void> {
+  await redis.zremrangebyrank(key, start, stop);
+}
+
+async function zrangeWithScores(key: string, start: number, stop: number): Promise<Array<{ member: string; score: number }>> {
+  const results = await redis.zrange(key, start, stop, 'WITHSCORES');
+  // ioredis returns flat array: [member1, score1, member2, score2, ...]
+  const entries: Array<{ member: string; score: number }> = [];
+  for (let i = 0; i < results.length; i += 2) {
+    entries.push({ member: results[i]!, score: Number(results[i + 1]) });
+  }
+  return entries;
+}
```

---

### Occupancy Service (New File)

#### [NEW] [occupancy.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/occupancy.service.ts)

Pure function, no dependencies:

```typescript
type OccupancyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

function calculateOccupancyLevel(passengerCount: number, capacity: number): OccupancyLevel {
  if (capacity === 0) return 'LOW';
  const ratio = passengerCount / capacity;
  if (ratio < 0.30) return 'LOW';
  if (ratio <= 0.70) return 'MEDIUM';
  return 'HIGH';
}
```

---

### Telemetry Service

#### [NEW] [telemetry.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/telemetry.service.ts)

Class `TelemetryService` — constructor receives `db`, `cache`, `incidentService`.

**Data structures:**

| Concern | Redis Key | Structure | TTL |
|---------|-----------|-----------|-----|
| Shift metadata | `shift:meta:{shiftId}` | JSON object with busId, routeId, capacity, driverName, driverRating, routeManagerName | 5 min |
| Speed history | `speed:history:{shiftId}` | Sorted set (score=timestamp, member=speed string) | — (pruned to 5) |
| Traffic cooldown | `traffic:cooldown:{shiftId}` | `"1"` | 60s |
| ETA cache | `eta:{busLat}_{busLng}_{stopLat}_{stopLng}` | JSON `{ etaSeconds, source }` | 30s |
| Positions cache | `bus:positions:{routeId}` | JSON map `{ [shiftId]: LiveBusPayload }` | 60s (maintained by gateway) |

**Methods:**

1. **`ingestLocation(params: IngestLocationParams): Promise<void>`**
   - Fetch shift metadata: first check `cache.get('shift:meta:{shiftId}')`. On miss, query DB:
     ```sql
     SELECT s.id, s.bus_id, s.route_id,
            b.capacity,
            u.full_name AS driver_name,
            dp.rating_avg AS driver_rating,
            mu.full_name AS route_manager_name
     FROM shifts s
     JOIN buses b ON b.id = s.bus_id
     JOIN routes r ON r.id = s.route_id
     JOIN driver_profiles dp ON dp.id = s.driver_id
     JOIN users u ON u.id = dp.user_id
     LEFT JOIN users mu ON mu.role = 'MANAGER' AND mu.id = (
       SELECT dp2.user_id FROM driver_profiles dp2
       WHERE dp2.company_id = (SELECT company_id FROM routes WHERE id = s.route_id)
       LIMIT 1
     )
     WHERE s.id = $1
     ```
     > [!NOTE]
     > The route_manager_name JOIN is the trickiest part. The DB schema links routes → companies and driver_profiles → companies, but there's no direct `route.manager_id` column. The plan queries for a MANAGER-role user in the same company. If there are multiple managers, it picks one (LIMIT 1). This seems correct for the MVP — a more refined approach would add a `managed_by` FK to routes.

   - Cache result in Redis with 5-minute TTL.
   - Call `calculateOccupancyLevel(passengerCount, capacity)`.
   - Build `LiveBusPayload` (import type from `@transport/shared-types`).
   - `cache.publish('bus:live:{routeId}', payload)`.
   - Buffer telemetry: push to `Map<string, TelemetryRecord[]>` keyed by `shiftId`.
   - **Traffic anomaly detection**:
     - `cache.zadd('speed:history:{shiftId}', Date.now(), String(speed))`.
     - `cache.zremrangeByRank('speed:history:{shiftId}', 0, -6)` — keeps only 5 most recent.
     - `cache.zrangeWithScores('speed:history:{shiftId}', 0, -1)` — read all.
     - If length === 5 AND all speeds < 5: check cooldown key `traffic:cooldown:{shiftId}`. If absent, call `incidentService.handleTrafficJam(shiftId, 'HIGH')` and set cooldown TTL 60s.

2. **`startFlushLoop(): void`**
   - `setInterval` every 3 seconds calling `flushBuffer()`.

3. **`flushBuffer(): Promise<void>`**
   - For each shiftId in the buffer map, batch-INSERT all records using a single multi-row `INSERT INTO shift_telemetry ... ON CONFLICT (shift_id, recorded_at) DO NOTHING`. Clear the map entry after successful write.
   - Exported so `index.ts` shutdown handler can call it.

4. **`stopFlushLoop(): void`**
   - `clearInterval`. Called before `flushBuffer()` on shutdown.

5. **`getLatestPositions(routeId: string): Promise<{ positions: LiveBusPayload[]; source: string }>`**
   - Read `cache.get('bus:positions:{routeId}')`. If found, return `{ positions: Object.values(map), source: 'cache' }`.
   - On miss: query DB for latest telemetry per active shift on this route:
     ```sql
     SELECT DISTINCT ON (st.shift_id) st.*, s.bus_id, s.route_id
     FROM shift_telemetry st
     JOIN shifts s ON s.id = st.shift_id
     WHERE s.route_id = $1 AND s.status = 'ACTIVE'
     ORDER BY st.shift_id, st.recorded_at DESC
     ```
   - Return `{ positions, source: 'db_fallback' }`.

6. **`calculateETA(busLat, busLng, stopLat, stopLng, currentSpeedKmh): Promise<{ etaSeconds: number; source: 'google' | 'haversine' }>`**
   - Check cache key `eta:{busLat}_{busLng}_{stopLat}_{stopLng}`.
   - **Primary**: Google Maps Distance Matrix API call via `fetch()`. Cache result 30s.
   - **Fallback**: Haversine formula. `distance / max(currentSpeedKmh, 10)` converted to seconds.

---

### Telemetry Gateway (Socket.IO)

#### [NEW] [telemetry.gateway.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/telemetry.gateway.ts)

Exports a single `initTelemetryGateway()` function called from [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/index.ts) after `initSocketIO()`.

**Zod validation schemas** (defined inline or in a separate validation file):

```typescript
const LocationUpdateSchema = z.object({
  shiftId: z.string().uuid(),
  lat: z.number().min(23.5).max(24.2),      // Bangladesh bounds
  lng: z.number().min(90.1).max(90.8),
  speed: z.number().min(0),
  heading: z.number().int().min(0).max(360).optional(),
  passengerCount: z.number().int().min(0),
});

const BreakdownSignalSchema = z.object({
  shiftId: z.string().uuid(),
});

const TrackBusSchema = z.object({
  routeId: z.string().uuid(),
});
```

**Driver namespace** (`/driver`):
- `'location:update'` → validate with Zod → `telemetryService.ingestLocation(...)`.
- `'breakdown:signal'` → validate → `incidentService.createBreakdown(shiftId)`.
- On validation error: `socket.emit('error', { message, details })`, return.

**Passenger namespace** (`/passenger`):
- `'track:bus'` → validate → `socket.join('route:{routeId}')`.
- `'untrack:bus'` → leave all rooms matching `route:*`.

**Redis → Socket.IO bridge** (started once):
- `cache.psubscribe('bus:live:*', (channel, message) => { ... })`.
- Extract `routeId` from channel string (`bus:live:{routeId}`).
- Emit `'bus:position'` to `passengerNs.to('route:{routeId}')`.
- Update positions cache: GET → merge → SET with TTL 60s.

---

### Incident Service Stub

#### [NEW] [incident.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/incidents/incident.service.ts)

Minimal stub so `telemetry.service.ts` and `telemetry.gateway.ts` can compile:

```typescript
class IncidentService {
  /** TODO: Implement full traffic jam incident creation (Prompt 2.x) */
  async handleTrafficJam(shiftId: string, severity: string): Promise<void> {
    console.log(`[INCIDENT] Traffic jam detected: shift=${shiftId} severity=${severity}`);
  }

  /** TODO: Implement full breakdown incident creation (Prompt 2.x) */
  async createBreakdown(shiftId: string): Promise<void> {
    console.log(`[INCIDENT] Breakdown reported: shift=${shiftId}`);
  }
}

export const incidentService = new IncidentService();
```

---

### App Entry Point Modifications

#### [MODIFY] [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/index.ts)

- Import `telemetryService` and `initTelemetryGateway`.
- After `initSocketIO(server)`, call `initTelemetryGateway()`.
- Call `telemetryService.startFlushLoop()` after cache connects.
- In the `shutdown()` function, before closing DB/Redis:
  ```typescript
  // Flush any buffered telemetry records before shutdown
  telemetryService.stopFlushLoop();
  await telemetryService.flushBuffer();
  ```

---

### Cross-Module TODO Comments

#### [MODIFY] (future) fleet.service.ts

When `fleet.service.ts` is created, add this comment:

```typescript
// TODO: When a driver is reassigned or a bus is substituted on a shift,
// invalidate the cached shift metadata:
//   await cache.del(`shift:meta:${shiftId}`);
// This ensures telemetry.service.ts picks up the new driver/bus on the
// next ingestLocation() call. See: modules/telemetry/telemetry.service.ts
```

Since `fleet.service.ts` does not exist yet, the TODO comment will be placed in `telemetry.service.ts` itself as a cross-reference.

---

## File Summary

| # | File | Action | Lines (est.) |
|---|------|--------|-------------|
| 1 | `apps/api/src/cache/index.ts` | MODIFY — add `psubscribe`, `zadd`, `zremrangeByRank`, `zrangeWithScores` | +50 |
| 2 | `apps/api/src/modules/telemetry/occupancy.service.ts` | NEW | ~25 |
| 3 | `apps/api/src/modules/telemetry/telemetry.service.ts` | NEW | ~280 |
| 4 | `apps/api/src/modules/telemetry/telemetry.gateway.ts` | NEW | ~170 |
| 5 | `apps/api/src/modules/incidents/incident.service.ts` | NEW — stub | ~25 |
| 6 | `apps/api/src/index.ts` | MODIFY — wire gateway + flush loop + shutdown | +15 |

---

## Verification Plan

### Automated Tests

1. **TypeScript compilation check**:
   ```bash
   cd apps/api && npx tsc --noEmit
   ```
   All new files must compile without errors against the existing strict tsconfig.

2. **Unit test: `occupancy.service.ts`** — Pure function, easy to test all branches:
   - `capacity=0` → `'LOW'`
   - `ratio < 0.30` → `'LOW'`
   - `ratio = 0.50` → `'MEDIUM'`
   - `ratio = 0.70` → `'MEDIUM'` (boundary)
   - `ratio = 0.71` → `'HIGH'`

3. **Unit test: `calculateETA` Haversine fallback** — Verify distance formula and floor speed at 10 km/h.

### Manual Verification

- Verify Redis pub/sub integration works by starting the server with Docker Compose and using a Socket.IO test client to:
  1. Connect to `/driver` namespace → emit `location:update` → observe `bus:position` on `/passenger`.
  2. Verify position cache population in Redis via `redis-cli GET bus:positions:{routeId}`.
  3. Verify telemetry records appear in `shift_telemetry` table after 3-second flush.
