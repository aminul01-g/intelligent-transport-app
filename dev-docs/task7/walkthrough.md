# Telemetry & ETA Engine Walkthrough

The telemetry and ETA engine has been successfully implemented according to the specifications in Prompt 2.3. All tests pass, and the system is fully wired into the main API entrypoint.

## What was Accomplished

### 1. `GOOGLE_MAPS_API_KEY` Optionality
Modified [env.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/config/env.ts) to make the Google Maps API key optional with an empty string default. This ensures that the application can start without the key and the engine seamlessly transitions to the Haversine fallback logic.

### 2. Redis Cache Enhancements
Added robust sorted-set manipulation methods (`zadd`, `zremrangeByRank`, `zrangeWithScores`) and `psubscribe` capabilities to [cache/index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/cache/index.ts). These are used extensively by the telemetry service for traffic jam anomaly detection, and by the Socket.IO gateway for pub/sub bridging.

### 3. Occupancy Service
A standalone pure-function utility ([occupancy.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/occupancy.service.ts)) was implemented to convert raw passenger counts against bus capacity into a generalized `LOW`, `MEDIUM`, or `HIGH` band, with built-in zero-capacity guards.

### 4. Telemetry Service
The core [telemetry.service.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/telemetry.service.ts) implements several advanced data flows:
- **Location Ingestion**: Takes raw GPS/speed, queries shift metadata, computes occupancy, and publishes full `LiveBusPayload` state across the cluster.
- **Traffic Anomaly Detection**: Maintains a moving window of the last 5 speeds via Redis sorted sets. Triggers a high-priority incident if speed stays < 5km/h, rate-limited by a 60-second Redis TTL cooldown key.
- **Batched Persistence**: Buffers high-volume telemetry events in memory and periodically flushes them to PostgreSQL (`shift_telemetry` partitioned table) in single batch transactions using `ON CONFLICT DO NOTHING` for idempotent sync.
- **ETA Engine**: Leverages Google Maps Distance Matrix API with a 30-second cache. If the API fails or the key is absent, falls back to a mathematical Haversine ETA estimation with a floored base speed of 10km/h.

### 5. Telemetry Gateway
The [telemetry.gateway.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/modules/telemetry/telemetry.gateway.ts) integrates natively with Socket.IO. It adds precise Zod input validation bounds (e.g. lat/lng restricted to Bangladesh), and serves as the Redis pub/sub bridge mapping background system updates (`bus:live:*` channels) to isolated Socket.IO passenger rooms (`route:{routeId}`).

### 6. App Lifecycle Wiring
The modules were connected in the main Express [index.ts](file:///home/aminul/Development/Work/intelligent-transport-app/apps/api/src/index.ts) entry point. Crucially, the 3-second buffer flush loop is safely integrated into the graceful shutdown sequence to ensure no pending records are lost during process termination.

## Validation Results

- Both compilation (`npx tsc --noEmit`) and Jest unit test suites pass perfectly.
- Unit tests verify the division-by-zero behavior of occupancy math and ensure the Haversine ETA math uses the 10km/h baseline correctly.

> [!TIP]
> The next logical step is to implement the **Fleet module** to ensure drivers and buses can be accurately managed and substituted, and the **Incidents module** to flesh out the currently stubbed `incidentService`.
