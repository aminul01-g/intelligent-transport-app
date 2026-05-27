-- =============================================================================
-- 005_feedback_and_incidents.sql
-- Passenger feedback, operational incidents, and SOS emergency events.
--
-- Run order: 5 of 6
-- Depends on: 001_users_and_auth.sql (users)
--             003_driver_operations.sql (shifts)
--             004_ticketing_and_fares.sql (trips)
--
-- Idempotency: All CREATE TYPE statements are guarded with DO $$ blocks.
--              All CREATE TABLE statements use IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- incident_type_enum
-- Classifies the nature of a reported operational incident.
--   ACCIDENT     — vehicle collision or road traffic accident
--   BREAKDOWN    — bus mechanical failure; correlates with bus_status BREAKDOWN
--   HARASSMENT   — passenger or staff harassment/misconduct report
--   THEFT        — theft of passenger property or bus equipment
--   OTHER        — catch-all for incidents that do not fit the above types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_type_enum') THEN
    CREATE TYPE incident_type_enum AS ENUM (
      'ACCIDENT',
      'BREAKDOWN',
      'HARASSMENT',
      'THEFT',
      'OTHER'
    );
  END IF;
END
$$;

-- incident_severity_enum
-- Indicates urgency and escalation priority of an incident.
--   LOW      — informational; no immediate action required
--   MEDIUM   — should be reviewed within the business day
--   HIGH     — requires prompt response (within hours)
--   CRITICAL — immediate escalation; may involve authorities or emergency services
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity_enum') THEN
    CREATE TYPE incident_severity_enum AS ENUM (
      'LOW',
      'MEDIUM',
      'HIGH',
      'CRITICAL'
    );
  END IF;
END
$$;

-- incident_status_enum
-- Tracks the resolution lifecycle of an incident report.
--   OPEN         — newly filed; awaiting triage
--   INVESTIGATING — assigned to a manager/lead for investigation
--   RESOLVED     — root cause identified and corrective action taken
--   DISMISSED    — report reviewed and determined to be invalid or duplicate
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status_enum') THEN
    CREATE TYPE incident_status_enum AS ENUM (
      'OPEN',
      'INVESTIGATING',
      'RESOLVED',
      'DISMISSED'
    );
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

-- feedback
-- Post-trip rating submitted by a passenger for a completed shift.
-- Multi-dimensional ratings cover overall service quality dimensions.
-- UNIQUE(passenger_id, shift_id) prevents duplicate ratings per journey.
CREATE TABLE IF NOT EXISTS feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE CASCADE: remove feedback if the passenger account is deleted.
  passenger_id     UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- ON DELETE CASCADE: remove feedback if the shift record is deleted.
  shift_id         UUID        NOT NULL REFERENCES shifts (id) ON DELETE CASCADE,
  -- rating: overall trip satisfaction score (1 = worst, 5 = best).
  rating           INT         CHECK (rating BETWEEN 1 AND 5),
  -- cleanliness_rating: assessment of bus interior cleanliness.
  cleanliness_rating INT       CHECK (cleanliness_rating BETWEEN 1 AND 5),
  -- ac_rating: assessment of air conditioning effectiveness.
  ac_rating        INT         CHECK (ac_rating BETWEEN 1 AND 5),
  -- staff_rating: assessment of driver conduct and professionalism.
  staff_rating     INT         CHECK (staff_rating BETWEEN 1 AND 5),
  -- comment: optional free-text feedback from the passenger.
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One feedback submission per passenger per shift.
  UNIQUE (passenger_id, shift_id)
);

-- incidents
-- Operational incident reports filed by passengers, drivers, or managers.
CREATE TABLE IF NOT EXISTS incidents (
  id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  -- reporter_id: the user who filed the report.
  -- ON DELETE SET NULL: preserve the incident record if the reporter's
  -- account is later deleted (e.g. after account closure).
  reporter_id UUID                    REFERENCES users (id) ON DELETE SET NULL,
  -- ON DELETE RESTRICT: shift must not be deleted while incidents reference it.
  shift_id    UUID                    NOT NULL REFERENCES shifts (id) ON DELETE RESTRICT,
  type        incident_type_enum      NOT NULL,
  description TEXT,
  severity    incident_severity_enum  NOT NULL DEFAULT 'LOW',
  status      incident_status_enum    NOT NULL DEFAULT 'OPEN',
  -- resolved_by: manager/lead who closed the incident.
  -- ON DELETE SET NULL: preserve resolution history if the resolver's
  -- account is deleted.
  resolved_by UUID                    REFERENCES users (id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- sos_events
-- Emergency SOS alerts triggered by a passenger during an active trip.
-- Captures the precise GPS location at the moment of the alert.
CREATE TABLE IF NOT EXISTS sos_events (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT: SOS records are safety-critical; never cascade-delete.
  passenger_id          UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  -- ON DELETE SET NULL: preserve SOS history even if the linked trip is removed.
  trip_id               UUID          REFERENCES trips (id) ON DELETE SET NULL,
  -- latitude/longitude: WGS-84 coordinates at the moment SOS was triggered.
  latitude              NUMERIC(10,7) NOT NULL,
  longitude             NUMERIC(10,7) NOT NULL,
  triggered_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  -- resolved_at: set by a manager/lead when the emergency is confirmed resolved.
  -- NULL means the SOS is still active/unacknowledged.
  resolved_at           TIMESTAMPTZ,
  -- authorities_notified: true if the system or operator escalated to police/
  -- emergency services. Used for compliance reporting.
  authorities_notified  BOOLEAN       NOT NULL DEFAULT false
);
