-- =============================================================================
-- 006_indexes.sql
-- Performance indexes covering all high-traffic query patterns.
--
-- Run order: 6 of 6 (must run after all tables are created)
-- Depends on: 001–005 migrations
--
-- NOTE: The migration runner (migrate.ts) wraps each file in a transaction.
-- PostgreSQL does not allow CREATE INDEX CONCURRENTLY inside a transaction,
-- so all indexes here use standard CREATE INDEX. For production deployments
-- on databases with existing large datasets, run these statements manually
-- with CONCURRENTLY outside a transaction block.
--
-- Idempotency: All indexes use CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AUTH & SESSION INDEXES
-- ---------------------------------------------------------------------------

-- Supports token validation lookup: find all tokens for a user on logout/revoke.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
  ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- TELEMETRY INDEXES
-- ---------------------------------------------------------------------------

-- Covers the live-tracking query: latest N telemetry rows for a given shift,
-- ordered most-recent-first. The DESC on recorded_at matches ORDER BY direction.
-- Note: This index is created on the parent partitioned table; Postgres
-- automatically applies it to all current and future child partitions.
CREATE INDEX IF NOT EXISTS idx_shift_telemetry_shift_recorded
  ON shift_telemetry (shift_id, recorded_at DESC);

-- ---------------------------------------------------------------------------
-- TRIP INDEXES
-- ---------------------------------------------------------------------------

-- Covers: fetch all trips for a passenger (trip history screen).
CREATE INDEX IF NOT EXISTS idx_trips_passenger_id
  ON trips (passenger_id);

-- Covers: fetch all trips on a given shift (driver/manager shift summary).
CREATE INDEX IF NOT EXISTS idx_trips_shift_id
  ON trips (shift_id);

-- Partial index: only indexes ACTIVE trips — the small, hot subset that
-- the boardBus/alightBus flow reads constantly. Rows move out of this index
-- automatically when status changes to COMPLETED or CANCELLED.
CREATE INDEX IF NOT EXISTS idx_trips_status
  ON trips (status)
  WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- TRANSACTION INDEXES
-- ---------------------------------------------------------------------------

-- Covers: paginated transaction history for a wallet, newest-first.
-- Composite on (wallet_id, created_at DESC) allows index-only scans
-- for the common "last N transactions" query pattern.
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_created
  ON transactions (wallet_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- INCIDENT INDEXES
-- ---------------------------------------------------------------------------

-- Covers: manager dashboard listing of open/investigating incidents.
CREATE INDEX IF NOT EXISTS idx_incidents_status
  ON incidents (status);

-- ---------------------------------------------------------------------------
-- SHIFT INDEXES
-- ---------------------------------------------------------------------------

-- Partial index: only indexes ACTIVE shifts — used by the live-tracking
-- and telemetry ingestion hot path. Same rationale as idx_trips_status.
CREATE INDEX IF NOT EXISTS idx_shifts_status
  ON shifts (status)
  WHERE status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- FLEET MAINTENANCE INDEXES
-- ---------------------------------------------------------------------------

-- Covers: compliance dashboard querying buses with expiring fitness certs.
-- Supports date-range scans: WHERE fitness_cert_expiry <= NOW() + INTERVAL '30 days'.
CREATE INDEX IF NOT EXISTS idx_buses_fitness_cert
  ON buses (fitness_cert_expiry);

-- Covers: compliance dashboard querying drivers with expiring licences.
-- Same pattern as fitness cert expiry alerting above.
CREATE INDEX IF NOT EXISTS idx_driver_license_expiry
  ON driver_profiles (license_expiry);

-- ---------------------------------------------------------------------------
-- FARE ENGINE INDEXES
-- ---------------------------------------------------------------------------

-- Covers the fare engine's primary query: fetch the active fare rule for a
-- given (route, passenger_category) pair. The partial WHERE is_active = true
-- keeps the index small (only live rules) and eliminates filter steps
-- on the hot boarding path.
CREATE INDEX IF NOT EXISTS idx_fare_rules_route_category
  ON fare_rules (route_id, passenger_category)
  WHERE is_active = true;
