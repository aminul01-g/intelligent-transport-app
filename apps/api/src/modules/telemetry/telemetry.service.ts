import { LiveBusPayload } from '@transport/shared-types';
import { db } from '../../db';
import { cache } from '../../cache';
import { env } from '../../config/env';
import { incidentService } from '../incidents/incident.service';
import { calculateOccupancyLevel } from './occupancy.service';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface IngestLocationParams {
  shiftId: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number | undefined;
  passengerCount: number;
}

interface ShiftMetadata {
  busId: string;
  routeId: string;
  capacity: number;
  driverName: string;
  driverRating: number;
  routeManagerName: string;
}

interface TelemetryRecord {
  shiftId: string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  headingDegrees: number | null;
  passengerCount: number;
  recordedAt: string;
}

interface EtaResult {
  etaSeconds: number;
  source: 'google' | 'haversine';
}

interface PositionsResult {
  positions: LiveBusPayload[];
  source: 'cache' | 'db_fallback';
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const SHIFT_META_TTL_SECONDS = 300; // 5 minutes
const ETA_CACHE_TTL_SECONDS = 30;
const FLUSH_INTERVAL_MS = 3_000; // 3 seconds
const SPEED_HISTORY_SIZE = 5;
const TRAFFIC_JAM_SPEED_THRESHOLD = 5; // km/h
const TRAFFIC_COOLDOWN_SECONDS = 60;
const HAVERSINE_MIN_SPEED_KMH = 10; // Floor to avoid infinite ETAs

// ──────────────────────────────────────────────
// Haversine helper
// ──────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two coordinates
 * using the Haversine formula.
 *
 * @returns Distance in kilometres.
 */
function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371; // Earth radius in km
  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

class TelemetryService {
  /**
   * In-memory buffer of raw telemetry records keyed by shiftId.
   * Flushed to the database every {@link FLUSH_INTERVAL_MS} via
   * {@link startFlushLoop} and on graceful shutdown.
   */
  private buffer: Map<string, TelemetryRecord[]> = new Map();

  /** Handle returned by setInterval — cleared on shutdown. */
  private flushIntervalHandle: ReturnType<typeof setInterval> | null = null;

  // ────────────────────────────────────────────
  // ingestLocation
  // ────────────────────────────────────────────

  /**
   * Process a single GPS location report from a driver's device.
   *
   * 1. Resolve shift metadata (cached in Redis, DB fallback).
   * 2. Calculate occupancy level.
   * 3. Build & publish a {@link LiveBusPayload} to Redis pub/sub.
   * 4. Buffer the raw telemetry record for periodic DB flush.
   * 5. Run traffic anomaly detection.
   */
  async ingestLocation(params: IngestLocationParams): Promise<void> {
    const { shiftId, lat, lng, speed, heading, passengerCount } = params;

    // ── 1. Shift metadata (cache-aside) ──
    const meta = await this.getShiftMetadata(shiftId);

    // ── 2. Occupancy ──
    const occupancyLevel = calculateOccupancyLevel(
      passengerCount,
      meta.capacity,
    );

    // ── 3. Build & publish LiveBusPayload ──
    const payload: LiveBusPayload = {
      shiftId,
      busId: meta.busId,
      routeId: meta.routeId,
      lat,
      lng,
      speed,
      passengerCount,
      capacity: meta.capacity,
      occupancyLevel,
      driverName: meta.driverName,
      driverRating: meta.driverRating,
      routeManagerName: meta.routeManagerName,
      timestamp: new Date().toISOString(),
    };

    await cache.publish(`bus:live:${meta.routeId}`, payload);

    // ── 4. Buffer raw telemetry ──
    const record: TelemetryRecord = {
      shiftId,
      latitude: lat,
      longitude: lng,
      speedKmh: speed,
      headingDegrees: heading ?? null,
      passengerCount,
      recordedAt: new Date().toISOString(),
    };

    const existing = this.buffer.get(shiftId);
    if (existing) {
      existing.push(record);
    } else {
      this.buffer.set(shiftId, [record]);
    }

    // ── 5. Traffic anomaly detection ──
    await this.detectTrafficAnomaly(shiftId, speed);
  }

  // ────────────────────────────────────────────
  // Shift metadata cache
  // ────────────────────────────────────────────

  /**
   * Fetches shift metadata from Redis or falls back to a DB join.
   *
   * The cache key `shift:meta:{shiftId}` has a 5-minute TTL.
   *
   * NOTE: When a driver is reassigned or a bus is substituted, the
   * fleet service MUST invalidate this cache entry:
   *
   *   await cache.del(`shift:meta:${shiftId}`);
   *
   * See: modules/fleet/fleet.service.ts (TODO — add invalidation
   * call when that module is implemented).
   */
  private async getShiftMetadata(shiftId: string): Promise<ShiftMetadata> {
    const cacheKey = `shift:meta:${shiftId}`;

    // Try cache first
    const cached = await cache.get<ShiftMetadata>(cacheKey);
    if (cached) return cached;

    // Cache miss — heavy DB join
    const { rows } = await db.query<{
      bus_id: string;
      route_id: string;
      capacity: number;
      driver_name: string;
      driver_rating: string; // NUMERIC comes as string from pg
      route_manager_name: string | null;
    }>(
      `
      SELECT
        s.bus_id,
        s.route_id,
        b.capacity,
        u.full_name   AS driver_name,
        dp.rating_avg  AS driver_rating,
        mu.full_name   AS route_manager_name
      FROM shifts s
        JOIN buses b            ON b.id  = s.bus_id
        JOIN driver_profiles dp ON dp.id = s.driver_id
        JOIN users u            ON u.id  = dp.user_id
        LEFT JOIN (
          SELECT dp2.company_id, u2.full_name
          FROM driver_profiles dp2
            JOIN users u2 ON u2.id = dp2.user_id
          WHERE u2.role = 'MANAGER'
        ) mu ON mu.company_id = (
          SELECT r.company_id FROM routes r WHERE r.id = s.route_id
        )
      WHERE s.id = $1
      LIMIT 1
      `,
      [shiftId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error(`Shift not found: ${shiftId}`);
    }

    const meta: ShiftMetadata = {
      busId: row.bus_id,
      routeId: row.route_id,
      capacity: row.capacity,
      driverName: row.driver_name,
      driverRating: Number(row.driver_rating),
      routeManagerName: row.route_manager_name ?? 'Unknown',
    };

    await cache.set(cacheKey, meta, SHIFT_META_TTL_SECONDS);
    return meta;
  }

  // ────────────────────────────────────────────
  // Traffic anomaly detection
  // ────────────────────────────────────────────

  /**
   * Maintains a Redis sorted set of the last 5 speed readings for a
   * shift.  If all 5 readings are below the traffic jam threshold
   * (5 km/h), delegates to the incident service.
   *
   * A 60-second cooldown key prevents duplicate alerts while a bus
   * remains stuck.
   */
  private async detectTrafficAnomaly(
    shiftId: string,
    speed: number,
  ): Promise<void> {
    const key = `speed:history:${shiftId}`;

    // Add new reading (score = timestamp, member = speed value)
    await cache.zadd(key, Date.now(), String(speed));

    // Keep only the 5 most recent entries
    // ZREMRANGEBYRANK 0 -6 removes everything except the last 5
    await cache.zremrangeByRank(key, 0, -1 * (SPEED_HISTORY_SIZE + 1));

    // Read current entries
    const entries = await cache.zrangeWithScores(key, 0, -1);
    if (entries.length < SPEED_HISTORY_SIZE) return;

    // Check if ALL speeds are below the threshold
    const allSlow = entries.every(
      (e) => Number(e.member) < TRAFFIC_JAM_SPEED_THRESHOLD,
    );
    if (!allSlow) return;

    // Cooldown — avoid spamming the incident service
    const cooldownKey = `traffic:cooldown:${shiftId}`;
    const cooldownActive = await cache.get<string>(cooldownKey);
    if (cooldownActive) return;

    await cache.set(cooldownKey, '1', TRAFFIC_COOLDOWN_SECONDS);
    await incidentService.handleTrafficJam(shiftId, 'HIGH');
  }

  // ────────────────────────────────────────────
  // Buffer flush
  // ────────────────────────────────────────────

  /**
   * Start the periodic flush loop that writes buffered telemetry
   * records to the database every 3 seconds.
   */
  startFlushLoop(): void {
    if (this.flushIntervalHandle) return; // idempotent
    this.flushIntervalHandle = setInterval(() => {
      this.flushBuffer().catch((err) => {
        console.error('[TELEMETRY] Flush error:', err);
      });
    }, FLUSH_INTERVAL_MS);
    console.log('[TELEMETRY] Flush loop started (interval: 3s)');
  }

  /**
   * Stop the periodic flush loop.  Call before {@link flushBuffer}
   * during graceful shutdown.
   */
  stopFlushLoop(): void {
    if (this.flushIntervalHandle) {
      clearInterval(this.flushIntervalHandle);
      this.flushIntervalHandle = null;
      console.log('[TELEMETRY] Flush loop stopped');
    }
  }

  /**
   * Writes all buffered telemetry records to the database in a
   * single batch INSERT per shift.
   *
   * Uses ON CONFLICT (shift_id, recorded_at) DO NOTHING for
   * idempotent offline sync (drivers may replay buffered payloads).
   *
   * IMPORTANT: This method MUST be called in the SIGTERM/SIGINT
   * handler in index.ts to avoid data loss on shutdown.
   * See: apps/api/src/index.ts — shutdown() function.
   */
  async flushBuffer(): Promise<void> {
    if (this.buffer.size === 0) return;

    // Snapshot and clear the buffer to avoid race conditions with
    // concurrent ingestLocation calls during the async INSERT.
    const snapshot = new Map(this.buffer);
    this.buffer.clear();

    for (const [_shiftId, records] of snapshot) {
      if (records.length === 0) continue;

      try {
        // Build multi-row INSERT: ($1,$2,$3,$4,$5,$6,$7), ($8,…), …
        const values: unknown[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        for (const r of records) {
          placeholders.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, ` +
            `$${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, ` +
            `$${paramIndex + 6})`,
          );
          values.push(
            r.shiftId,
            r.latitude,
            r.longitude,
            r.speedKmh,
            r.headingDegrees,
            r.passengerCount,
            r.recordedAt,
          );
          paramIndex += 7;
        }

        await db.query(
          `
          INSERT INTO shift_telemetry
            (shift_id, latitude, longitude, speed_kmh,
             heading_degrees, passenger_count, recorded_at)
          VALUES ${placeholders.join(', ')}
          ON CONFLICT (shift_id, recorded_at) DO NOTHING
          `,
          values,
        );
      } catch (err) {
        // On failure, put records back so the next flush retries them.
        console.error('[TELEMETRY] Batch insert failed, re-buffering:', err);
        const existing = this.buffer.get(_shiftId);
        if (existing) {
          existing.push(...records);
        } else {
          this.buffer.set(_shiftId, records);
        }
      }
    }
  }

  // ────────────────────────────────────────────
  // getLatestPositions
  // ────────────────────────────────────────────

  /**
   * Returns the most recent position for every active bus on the
   * specified route.
   *
   * Reads from the positions cache maintained by the Redis→Socket.IO
   * bridge in telemetry.gateway.ts.  On a cache miss, falls back to
   * a DB query for the latest telemetry record per active shift.
   */
  async getLatestPositions(routeId: string): Promise<PositionsResult> {
    // Try cache (populated by the gateway bridge)
    const cached = await cache.get<Record<string, LiveBusPayload>>(
      `bus:positions:${routeId}`,
    );

    if (cached) {
      return {
        positions: Object.values(cached),
        source: 'cache',
      };
    }

    // DB fallback — most recent telemetry per active shift
    const { rows } = await db.query<{
      shift_id: string;
      bus_id: string;
      route_id: string;
      latitude: string;
      longitude: string;
      speed_kmh: string;
      passenger_count: number;
      recorded_at: string;
    }>(
      `
      SELECT DISTINCT ON (st.shift_id)
        st.shift_id,
        s.bus_id,
        s.route_id,
        st.latitude,
        st.longitude,
        st.speed_kmh,
        st.passenger_count,
        st.recorded_at
      FROM shift_telemetry st
        JOIN shifts s ON s.id = st.shift_id
      WHERE s.route_id = $1
        AND s.status = 'ACTIVE'
      ORDER BY st.shift_id, st.recorded_at DESC
      `,
      [routeId],
    );

    // Build minimal LiveBusPayload objects from DB rows.
    // Some fields (driver info, occupancy) are unavailable from this
    // query — they'll be populated on the next live ingest cycle.
    const positions: LiveBusPayload[] = rows.map((r) => ({
      shiftId: r.shift_id,
      busId: r.bus_id,
      routeId: r.route_id,
      lat: Number(r.latitude),
      lng: Number(r.longitude),
      speed: Number(r.speed_kmh),
      passengerCount: r.passenger_count,
      capacity: 0, // Unknown from telemetry table alone
      occupancyLevel: 'LOW' as const,
      driverName: '',
      driverRating: 0,
      routeManagerName: '',
      timestamp: r.recorded_at,
    }));

    return {
      positions,
      source: 'db_fallback',
    };
  }

  // ────────────────────────────────────────────
  // calculateETA
  // ────────────────────────────────────────────

  /**
   * Estimates the time of arrival from the bus's current position to
   * a destination stop.
   *
   * Primary: Google Maps Distance Matrix API (driving mode,
   * departure_time=now).  Cached for 30 seconds.
   *
   * Fallback: Haversine distance ÷ max(currentSpeedKmh, 10).
   * Speed is floored at 10 km/h to avoid infinite ETAs for stopped
   * buses.
   */
  async calculateETA(
    busLat: number,
    busLng: number,
    stopLat: number,
    stopLng: number,
    currentSpeedKmh: number,
  ): Promise<EtaResult> {
    const cacheKey = `eta:${busLat}_${busLng}_${stopLat}_${stopLng}`;

    // Check cache
    const cached = await cache.get<EtaResult>(cacheKey);
    if (cached) return cached;

    // Primary: Google Maps Distance Matrix API
    if (env.GOOGLE_MAPS_API_KEY) {
      try {
        const result = await this.fetchGoogleETA(
          busLat,
          busLng,
          stopLat,
          stopLng,
        );
        await cache.set(cacheKey, result, ETA_CACHE_TTL_SECONDS);
        return result;
      } catch (err) {
        console.warn('[TELEMETRY] Google Maps ETA failed, using Haversine:', err);
      }
    }

    // Fallback: Haversine
    const result = this.calculateHaversineETA(
      busLat,
      busLng,
      stopLat,
      stopLng,
      currentSpeedKmh,
    );
    await cache.set(cacheKey, result, ETA_CACHE_TTL_SECONDS);
    return result;
  }

  /**
   * Calls the Google Maps Distance Matrix API.
   */
  private async fetchGoogleETA(
    busLat: number,
    busLng: number,
    stopLat: number,
    stopLng: number,
  ): Promise<EtaResult> {
    const url = new URL(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
    );
    url.searchParams.set('origins', `${busLat},${busLng}`);
    url.searchParams.set('destinations', `${stopLat},${stopLng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Google Maps API HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      status: string;
      rows: Array<{
        elements: Array<{
          status: string;
          duration_in_traffic?: { value: number };
          duration: { value: number };
        }>;
      }>;
    };

    if (data.status !== 'OK') {
      throw new Error(`Google Maps API status: ${data.status}`);
    }

    const element = data.rows[0]?.elements[0];
    if (!element || element.status !== 'OK') {
      throw new Error(
        `Google Maps element status: ${element?.status ?? 'missing'}`,
      );
    }

    const etaSeconds =
      element.duration_in_traffic?.value ?? element.duration.value;

    return { etaSeconds, source: 'google' };
  }

  /**
   * Haversine-based ETA fallback.
   *
   * Speed is floored at 10 km/h to prevent infinite/unreasonable
   * ETAs when the bus is stopped or nearly stopped.
   */
  private calculateHaversineETA(
    busLat: number,
    busLng: number,
    stopLat: number,
    stopLng: number,
    currentSpeedKmh: number,
  ): EtaResult {
    const distanceKm = haversineDistanceKm(busLat, busLng, stopLat, stopLng);
    const effectiveSpeed = Math.max(currentSpeedKmh, HAVERSINE_MIN_SPEED_KMH);
    const etaHours = distanceKm / effectiveSpeed;
    const etaSeconds = Math.round(etaHours * 3_600);

    return { etaSeconds, source: 'haversine' };
  }
}

export const telemetryService = new TelemetryService();
