-- =============================================================================
-- 002_companies_and_fleet.sql
-- Transport companies, bus fleet, routes, and route stops.
--
-- Run order: 2 of 6
-- Depends on: 001_users_and_auth.sql (passenger_category_enum)
--
-- Idempotency: All CREATE TYPE statements are guarded with DO $$ blocks.
--              All CREATE TABLE statements use IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- bus_status_enum
-- Tracks the operational state of a bus at any point in time.
--   ACTIVE      — bus is in service and can be assigned to shifts
--   INACTIVE    — bus is off-service but roadworthy (e.g. parked overnight)
--   BREAKDOWN   — bus has broken down mid-operation; triggers incident flow
--   MAINTENANCE — bus is undergoing scheduled or corrective maintenance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bus_status_enum') THEN
    CREATE TYPE bus_status_enum AS ENUM (
      'ACTIVE',
      'INACTIVE',
      'BREAKDOWN',
      'MAINTENANCE'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- companies
-- Registered transport operators that own buses and run routes.
CREATE TABLE IF NOT EXISTS companies (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  -- registration_number: government-issued company registration ID.
  -- UNIQUE enforces one record per legal entity.
  registration_number TEXT        UNIQUE,
  -- insurance_policy_url: link to the uploaded insurance certificate document.
  insurance_policy_url TEXT,
  contact_email       TEXT,
  -- is_active: soft-disable a company without deleting its historical data.
  is_active           BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- buses
-- Individual bus vehicles belonging to a company.
CREATE TABLE IF NOT EXISTS buses (
  id                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: prevent deleting a company that still owns buses.
  company_id           UUID            NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  registration_plate   TEXT            UNIQUE NOT NULL,
  model                TEXT,
  -- capacity: total seated passenger capacity used for operational planning.
  capacity             INT             NOT NULL,
  ac_functional        BOOLEAN         NOT NULL DEFAULT true,
  -- fitness_cert_expiry: government roadworthiness certificate expiry date.
  -- idx_buses_fitness_cert covers alerts for approaching expiry dates.
  fitness_cert_expiry  DATE,
  status               bus_status_enum NOT NULL DEFAULT 'ACTIVE',
  -- last_maintenance_at: timestamp of the most recent completed maintenance.
  last_maintenance_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- routes
-- Named transit corridors operated by a company.
-- Fare engine uses base_price_per_km × trip distance to compute base fare.
CREATE TABLE IF NOT EXISTS routes (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: prevent deleting a company that still has routes.
  company_id       UUID           NOT NULL REFERENCES companies (id) ON DELETE RESTRICT,
  name             TEXT           NOT NULL,
  description      TEXT,
  is_active        BOOLEAN        NOT NULL DEFAULT true,
  -- base_price_per_km: the per-kilometre fare rate in BDT for this route.
  -- The fare engine multiplies this by the trip distance (km) to get the
  -- base fare before discounts. Set per route to allow flexible pricing
  -- (e.g. express routes may charge more per km than local routes).
  -- Default 10.0000 BDT/km; adjust per route during seeding.
  base_price_per_km NUMERIC(8,4)  NOT NULL DEFAULT 10.0000,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- route_stops
-- Ordered waypoints along a route. Distance between stops drives fare calc.
CREATE TABLE IF NOT EXISTS route_stops (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove all stops when their parent route is deleted.
  route_id         UUID           NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
  stop_name        TEXT           NOT NULL,
  -- latitude/longitude: WGS-84 coordinates stored as NUMERIC to avoid
  -- floating-point rounding errors in fare and distance calculations.
  latitude         NUMERIC(10,7)  NOT NULL,
  longitude        NUMERIC(10,7)  NOT NULL,
  -- sequence_order: 1-based position of this stop within the route.
  -- UNIQUE(route_id, sequence_order) prevents gaps or duplicates in sequence.
  sequence_order   INT            NOT NULL,
  -- distance_from_previous_km: the precomputed Haversine distance from the
  -- prior stop in the sequence. For the first stop (sequence_order = 1),
  -- this is 0. Cumulative sum of this column for a stop range = trip
  -- distance in km. Populate this column when creating/updating route stops
  -- in the route service using the Haversine formula on adjacent stop
  -- lat/lng pairs.
  distance_from_previous_km NUMERIC(8,4) NOT NULL DEFAULT 0.0000,
  -- estimated_travel_time_seconds: used only for schedule display and ETA
  -- hints. NOT used for fare calculation. Distance and fare are derived
  -- from distance_from_previous_km only.
  estimated_travel_time_seconds INT NOT NULL DEFAULT 0,
  -- Prevents duplicate or out-of-order stop positions on a route.
  UNIQUE (route_id, sequence_order)
);
