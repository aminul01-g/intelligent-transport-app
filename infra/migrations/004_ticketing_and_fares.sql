-- =============================================================================
-- 004_ticketing_and_fares.sql
-- Wallets, fare rules, trip records, and financial transactions.
--
-- Run order: 4 of 6
-- Depends on: 001_users_and_auth.sql (users, passenger_category_enum)
--             002_companies_and_fleet.sql (routes, route_stops)
--             003_driver_operations.sql (shifts)
--
-- Idempotency: All CREATE TABLE statements use IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- wallets
-- One wallet per user (UNIQUE on user_id). Holds the passenger's BDT balance.
--
-- held_balance — funds reserved for the passenger's currently ACTIVE trip.
-- Available balance a passenger can spend = balance - held_balance.
--
-- Wallet lifecycle per trip:
--   boardBus    → held_balance  += estimatedMaxFare
--   alightBus   → balance       -= actualFare
--               → held_balance  -= estimatedMaxFare
--   cancelTrip  → held_balance  -= estimatedMaxFare  (balance unchanged)
--
-- The DB CHECK (balance >= 0) is the last safety net; the application layer
-- must always check (balance - held_balance) >= requestedFare before boarding.
CREATE TABLE IF NOT EXISTS wallets (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: never silently delete a wallet that holds real funds.
  user_id       UUID           UNIQUE NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  -- balance: total funds in the wallet including held amounts.
  balance       NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (balance >= 0),
  -- held_balance: portion of balance currently reserved for an active trip.
  -- Must be released (or consumed) before a new trip can begin.
  held_balance  NUMERIC(12,2)  NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  -- currency: ISO 4217 code. Default BDT (Bangladeshi Taka).
  currency      CHAR(3)        NOT NULL DEFAULT 'BDT',
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- fare_rules
-- Defines discount or override pricing for a (route, passenger_category) pair.
-- The fare engine evaluates applicable rules in this priority order:
--   1. fixed_price override (if NOT NULL) → overrides all distance math
--   2. base fare = route.base_price_per_km × distance_km
--      apply discount_percentage
--      apply peak_hour_surcharge_pct if current hour is in peak window
CREATE TABLE IF NOT EXISTS fare_rules (
  id                      UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove rules when their parent route is deleted.
  route_id                UUID                    NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  passenger_category      passenger_category_enum NOT NULL,
  -- discount_percentage: percentage reduction applied to the computed base fare.
  -- 0 = no discount, 100 = free ride. BETWEEN 0 AND 100 enforced by CHECK.
  discount_percentage     NUMERIC(5,2)            NOT NULL DEFAULT 0
                          CHECK (discount_percentage BETWEEN 0 AND 100),
  -- fixed_price: if set, this overrides the distance × base_price_per_km
  -- calculation entirely. Useful for government flat-rate exemptions
  -- (e.g. freedom-fighter passes, disability concessions).
  fixed_price             NUMERIC(10,2),
  -- peak_hour_surcharge_pct: additional percentage added to the base fare
  -- during peak hours (e.g. 10 = +10% during rush hour).
  peak_hour_surcharge_pct NUMERIC(5,2)            NOT NULL DEFAULT 0,
  -- peak_start_hour / peak_end_hour: 24-hour clock bounds for peak pricing.
  -- NULL on either disables peak surcharge for this rule.
  peak_start_hour         INT                     CHECK (peak_start_hour BETWEEN 0 AND 23),
  peak_end_hour           INT                     CHECK (peak_end_hour BETWEEN 0 AND 23),
  is_active               BOOLEAN                 NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- trips
-- Records each passenger boarding event on a shift.
-- A trip is ACTIVE from boardBus until alightBus or cancelTrip.
CREATE TABLE IF NOT EXISTS trips (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: trip records are financial artifacts; never cascade.
  passenger_id       UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  -- ON DELETE RESTRICT: preserve trip history tied to a shift.
  shift_id           UUID        NOT NULL REFERENCES shifts (id) ON DELETE RESTRICT,
  -- boarding_stop_id: the route_stop where the passenger boarded.
  -- ON DELETE RESTRICT: stop records must not be deleted while trips reference them.
  boarding_stop_id   UUID        NOT NULL REFERENCES route_stops (id) ON DELETE RESTRICT,
  -- alighting_stop_id: set when the passenger alights. NULL while ACTIVE.
  -- ON DELETE RESTRICT: consistent with boarding_stop_id strategy.
  alighting_stop_id  UUID        REFERENCES route_stops (id) ON DELETE RESTRICT,
  -- estimated_max_fare: fare from boarding_stop to the LAST stop on the route.
  -- This amount is held in wallets.held_balance for the duration of the trip.
  -- Used to calculate the release amount on alightBus or cancelTrip.
  estimated_max_fare NUMERIC(10,2) NOT NULL,
  -- fare_charged: actual fare deducted from wallet on alightBus.
  -- NULL while the trip is ACTIVE. Set once on the alightBus event only.
  fare_charged       NUMERIC(10,2),
  -- status lifecycle: ACTIVE → COMPLETED | CANCELLED
  status             TEXT        NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  boarded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- alighted_at: set on alightBus. NULL while trip is ACTIVE or CANCELLED.
  alighted_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- transactions
-- Immutable ledger of every wallet balance movement.
-- One row per financial event; never updated after insert.
--
-- Transaction type semantics:
--   HOLD         — funds reserved on boardBus (held_balance increases)
--   DEBIT        — actual fare deducted on alightBus (balance decreases)
--   HOLD_RELEASE — reservation released on alightBus or cancelTrip
--                  (held_balance decreases; paired with DEBIT on alightBus)
--   CREDIT       — top-up by passenger (balance increases)
--   REFUND       — explicit goodwill credit issued by operator
--                  (separate from HOLD_RELEASE; balance increases)
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: financial records must be preserved indefinitely.
  wallet_id   UUID           NOT NULL REFERENCES wallets (id) ON DELETE RESTRICT,
  -- ON DELETE SET NULL: keep transaction history even if the trip is removed.
  trip_id     UUID           REFERENCES trips (id) ON DELETE SET NULL,
  -- amount: always positive. The type column determines the direction of flow.
  amount      NUMERIC(12,2)  NOT NULL,
  type        TEXT           NOT NULL
              CHECK (type IN ('DEBIT', 'CREDIT', 'REFUND', 'HOLD', 'HOLD_RELEASE')),
  -- description: human-readable note for receipts and dispute resolution.
  description TEXT,
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
