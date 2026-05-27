# Migration Files — Task Tracker

## 1. Migration Files

- [x] `001_users_and_auth.sql`
  - [ ] Enum `user_role_enum` (`PASSENGER`, `DRIVER`, `MANAGER`, `COMPANY_LEAD`)
  - [ ] Enum `passenger_category_enum` (`REGULAR`, `STUDENT`, `WORKER`, `GOVT_PERSONNEL`)
  - [ ] Table `users` (uuid PK, email, phone, password_hash, role, passenger_category, full_name, avatar_url, is_verified, timestamps)
  - [ ] Table `user_documents` (FK → users CASCADE, FK verified_by → users SET NULL, status CHECK)
  - [ ] Table `refresh_tokens` (FK → users CASCADE, token_hash UNIQUE, expires_at, revoked_at, device_info JSONB)
  - [ ] Table `push_subscriptions` (FK → users CASCADE, UNIQUE(user_id, endpoint))

- [x] `002_companies_and_fleet.sql`
  - [ ] Enum `bus_status_enum` (`ACTIVE`, `INACTIVE`, `BREAKDOWN`, `MAINTENANCE`)
  - [ ] Table `companies` (registration_number UNIQUE, is_active)
  - [ ] Table `buses` (FK → companies RESTRICT, registration_plate UNIQUE, status bus_status_enum, fitness_cert_expiry)
  - [ ] Table `routes` (FK → companies RESTRICT, base_price_per_km NUMERIC(8,4) DEFAULT 10.0000 with doc comment)
  - [ ] Table `route_stops` (FK → routes CASCADE, distance_from_previous_km with doc comment, estimated_travel_time_seconds with doc comment, UNIQUE(route_id, sequence_order))

- [x] `003_driver_operations.sql`
  - [ ] Table `driver_profiles` (FK user_id → users CASCADE UNIQUE, FK company_id → companies RESTRICT, license_number UNIQUE)
  - [ ] Table `shifts` (FK driver/bus/route → RESTRICT, status CHECK)
  - [ ] Table `shift_telemetry` (BIGSERIAL, partitioned by RANGE on recorded_at, UNIQUE(shift_id, recorded_at), composite PK)
  - [ ] 4 initial monthly partitions (y2026m05–y2026m08)
  - [ ] Function `create_telemetry_partition_for_month(DATE)` with `TO_CHAR(start_date, 'YYYYmMM')` naming

- [x] `004_ticketing_and_fares.sql`
  - [ ] Table `wallets` (FK → users RESTRICT UNIQUE, balance CHECK >= 0, held_balance CHECK >= 0, lifecycle comments)
  - [ ] Table `fare_rules` (FK → routes CASCADE, passenger_category_enum, discount_percentage, fixed_price override, peak hour surcharge)
  - [ ] Table `trips` (FK passenger/shift/boarding_stop/alighting_stop, estimated_max_fare, fare_charged, status CHECK)
  - [ ] Table `transactions` (FK wallet → RESTRICT, FK trip → SET NULL, type CHECK with HOLD/HOLD_RELEASE/DEBIT/CREDIT/REFUND, doc comments)

- [x] `005_feedback_and_incidents.sql`
  - [ ] Enum `incident_type_enum` (`ACCIDENT`, `BREAKDOWN`, `HARASSMENT`, `THEFT`, `OTHER`)
  - [ ] Enum `incident_severity_enum` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - [ ] Enum `incident_status_enum` (`OPEN`, `INVESTIGATING`, `RESOLVED`, `DISMISSED`)
  - [ ] Table `feedback` (multi-dimensional ratings 1–5, UNIQUE(passenger_id, shift_id))
  - [ ] Table `incidents` (FK reporter → SET NULL, FK shift → RESTRICT, FK resolved_by → SET NULL)
  - [ ] Table `sos_events` (FK passenger → RESTRICT, FK trip → SET NULL, authorities_notified)

- [x] `006_indexes.sql`
  - [ ] `idx_refresh_tokens_user_id`
  - [ ] `idx_shift_telemetry_shift_recorded` (DESC)
  - [ ] `idx_trips_passenger_id`, `idx_trips_shift_id`, `idx_trips_status` (partial WHERE ACTIVE)
  - [ ] `idx_transactions_wallet_created` (DESC)
  - [ ] `idx_incidents_status`
  - [ ] `idx_shifts_status` (partial WHERE ACTIVE)
  - [ ] `idx_buses_fitness_cert`, `idx_driver_license_expiry`
  - [ ] `idx_fare_rules_route_category` (partial WHERE is_active)

## 2. Verification

- [x] Run all 6 files through `psql` against fresh Docker Postgres
- [x] Run all 6 files a second time (idempotency check)
- [x] Run `npx ts-node infra/scripts/migrate.ts up` via migration runner
- [x] Introspect schema to confirm all tables, enums, and indexes exist
