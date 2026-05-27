-- =============================================================================
-- 003_driver_operations.sql
-- Driver profiles, shift assignments, and GPS telemetry (range-partitioned).
--
-- Run order: 3 of 6
-- Depends on: 001_users_and_auth.sql (users)
--             002_companies_and_fleet.sql (companies, buses, routes)
--
-- Idempotency: All CREATE TABLE statements use IF NOT EXISTS.
--              Partition tables use CREATE TABLE IF NOT EXISTS.
--              The maintenance function uses CREATE OR REPLACE FUNCTION.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- driver_profiles
-- Extended profile for users with role = 'DRIVER'.
-- One profile per driver (enforced by UNIQUE on user_id).
CREATE TABLE IF NOT EXISTS driver_profiles (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove driver profile when the user account is deleted.
  -- UNIQUE: enforces one driver profile per user account.
  user_id        UUID           NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  -- ON DELETE RESTRICT: cannot delete a company that still has drivers.
  company_id     UUID           NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  -- license_number: government-issued driving licence number. Must be unique.
  license_number TEXT           UNIQUE NOT NULL,
  license_expiry DATE           NOT NULL,
  -- rating_avg: rolling average of all feedback ratings received.
  -- Updated by application layer after each trip feedback submission.
  rating_avg     NUMERIC(3,2)   NOT NULL DEFAULT 5.00,
  -- total_trips: denormalised counter incremented on shift COMPLETED.
  -- Avoids COUNT(*) on trips table for driver profile screens.
  total_trips    INT            NOT NULL DEFAULT 0
);

-- shifts
-- A single assigned duty period: one driver, one bus, one route.
-- A shift moves through SCHEDULED → ACTIVE → COMPLETED | ABANDONED.
CREATE TABLE IF NOT EXISTS shifts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: preserve shift history even if driver profile changes.
  driver_id  UUID        NOT NULL REFERENCES driver_profiles (id) ON DELETE RESTRICT,
  -- ON DELETE RESTRICT: preserve shift history; bus must not be deleted
  -- while historical shifts reference it.
  bus_id     UUID        NOT NULL REFERENCES buses (id) ON DELETE RESTRICT,
  -- ON DELETE RESTRICT: preserve shift history; route must not be deleted
  -- while historical shifts reference it.
  route_id   UUID        NOT NULL REFERENCES routes (id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ,
  -- status lifecycle: SCHEDULED → ACTIVE → COMPLETED | ABANDONED
  status     TEXT        NOT NULL DEFAULT 'SCHEDULED'
             CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'ABANDONED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- shift_telemetry
-- High-frequency GPS + operational data streamed from the driver's device.
--
-- Partitioning strategy: RANGE on recorded_at (monthly partitions).
-- Rationale: telemetry volume grows unboundedly; monthly partitions allow
-- old data to be archived or dropped by detaching a partition without
-- touching the parent table.
--
-- Composite PK (id, recorded_at): PostgreSQL requires that the partition
-- key (recorded_at) be part of the primary key in range-partitioned tables.
-- BIGSERIAL id still guarantees row uniqueness within any partition.
--
-- UNIQUE(shift_id, recorded_at): critical for idempotent offline sync.
-- When a driver reconnects after network loss, replayed payloads use
-- ON CONFLICT (shift_id, recorded_at) DO NOTHING to avoid duplicates.
CREATE TABLE IF NOT EXISTS shift_telemetry (
  id               BIGSERIAL     NOT NULL,
  -- ON DELETE RESTRICT: do not allow deleting a shift while telemetry exists.
  shift_id         UUID          NOT NULL REFERENCES shifts (id) ON DELETE RESTRICT,
  latitude         NUMERIC(10,7) NOT NULL,
  longitude        NUMERIC(10,7) NOT NULL,
  -- speed_kmh: current ground speed in kilometres per hour.
  speed_kmh        NUMERIC(5,2)  NOT NULL DEFAULT 0,
  -- heading_degrees: compass bearing 0–359. NULL if device cannot determine.
  heading_degrees  INT,
  -- passenger_count: current onboard count as reported by the driver app.
  passenger_count  INT           NOT NULL DEFAULT 0,
  recorded_at      TIMESTAMPTZ   NOT NULL,
  -- Idempotent sync guard: prevents duplicate rows on offline replay.
  UNIQUE (shift_id, recorded_at),
  -- Composite PK required by Postgres for range-partitioned tables.
  PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- ---------------------------------------------------------------------------
-- INITIAL MONTHLY PARTITIONS
--
-- NOTE: Partition names follow the pattern shift_telemetry_y{YYYY}m{MM}.
-- At deploy time, generate these dynamically for the current month and the
-- next 3 months using the maintain-partitions.ts script
-- (see /infra/scripts/maintain-partitions.ts).
-- The four partitions below cover the initial deployment window.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS shift_telemetry_y2026m05
  PARTITION OF shift_telemetry
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS shift_telemetry_y2026m06
  PARTITION OF shift_telemetry
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS shift_telemetry_y2026m07
  PARTITION OF shift_telemetry
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS shift_telemetry_y2026m08
  PARTITION OF shift_telemetry
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

-- ---------------------------------------------------------------------------
-- PARTITION MAINTENANCE FUNCTION
--
-- Call monthly via cron (or pg_cron) to pre-create the next partition before
-- the current month rolls over. Idempotent — safe to call multiple times.
--
-- Usage (run monthly):
--   SELECT create_telemetry_partition_for_month(
--     DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
--   );
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_telemetry_partition_for_month(
  target_month DATE
) RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date     DATE;
  end_date       DATE;
BEGIN
  start_date := DATE_TRUNC('month', target_month);
  end_date   := start_date + INTERVAL '1 month';
  -- TO_CHAR with 'YYYYmMM' produces e.g. '2026m07' — consistent with the
  -- naming convention used for the initial partitions above.
  partition_name := 'shift_telemetry_y' || TO_CHAR(start_date, 'YYYYmMM');
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I
       PARTITION OF shift_telemetry
       FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
