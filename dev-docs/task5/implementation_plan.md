# PostgreSQL Migration Files for Intelligent Transport App

Create 6 sequential migration files in [/infra/migrations/](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/) that define the complete database schema for the intelligent transport system.

## Compatibility Context

- **PostgreSQL 16** (Alpine image, per [docker-compose.yml](file:///home/aminul/Development/Work/intelligent-transport-app/docker-compose.yml))
- **Migration runner**: [migrate.ts](file:///home/aminul/Development/Work/intelligent-transport-app/infra/scripts/migrate.ts) — executes `.sql` files in lexicographic order, each wrapped in a transaction
- All files must be runnable via `psql` directly

> [!IMPORTANT]
> The migration runner wraps each file in `BEGIN/COMMIT`. PostgreSQL **does not allow `CREATE INDEX CONCURRENTLY` inside a transaction**. All indexes in `006_indexes.sql` will therefore use regular `CREATE INDEX` (non-concurrent). For production databases with existing data, indexes should be created concurrently outside the migration runner.

## Proposed Changes

### Enums & Auth Layer

#### [NEW] [001_users_and_auth.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/001_users_and_auth.sql)

- Create enums first (idempotent `DO $$ ... $$` blocks with `IF NOT EXISTS` guard):
  - `user_role_enum`: `'PASSENGER'`, `'DRIVER'`, `'MANAGER'`, `'COMPANY_LEAD'`
  - `passenger_category_enum`: `'REGULAR'`, `'STUDENT'`, `'WORKER'`, `'GOVT_PERSONNEL'`
- Tables: `users`, `user_documents`, `refresh_tokens`, `push_subscriptions`
- All FKs have explicit `ON DELETE` (`CASCADE` or `SET NULL`)

---

### Companies & Fleet

#### [NEW] [002_companies_and_fleet.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/002_companies_and_fleet.sql)

- Create enum: `bus_status_enum` (`'ACTIVE'`, `'INACTIVE'`, `'BREAKDOWN'`, `'MAINTENANCE'`)
- Tables: `companies`, `buses`, `routes`, `route_stops`
- `routes.base_price_per_km` — NUMERIC(8,4), default `10.0000` BDT/km with doc comment
- `route_stops.distance_from_previous_km` — Haversine distance from prior stop, with doc comment
- `route_stops.estimated_travel_time_seconds` — for schedule/ETA display only, not fare calc

---

### Driver Operations

#### [NEW] [003_driver_operations.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/003_driver_operations.sql)

- Tables: `driver_profiles`, `shifts`, `shift_telemetry` (partitioned by `recorded_at`)
- `shift_telemetry`:
  - `PARTITION BY RANGE (recorded_at)` — range partitioning on timestamp
  - 4 initial monthly partitions (May–Aug 2026)
  - `UNIQUE(shift_id, recorded_at)` — enables idempotent offline sync via `ON CONFLICT DO NOTHING`
  - Composite PK `(id, recorded_at)` — required by Postgres for partition key inclusion in PK
- `create_telemetry_partition_for_month(DATE)` function for monthly cron maintenance

> [!NOTE]
> The partition examples use `y2026m05` through `y2026m08` naming convention per spec. The `create_telemetry_partition_for_month()` function uses the same `TO_CHAR(start_date, 'YYYYmMM')` format.

---

### Ticketing & Fares

#### [NEW] [004_ticketing_and_fares.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/004_ticketing_and_fares.sql)

- Tables: `wallets`, `fare_rules`, `trips`, `transactions`
- **Wallet hold pattern** (documented via SQL comments):
  - `held_balance` — funds reserved during ACTIVE trip
  - Available balance = `balance - held_balance`
  - Lifecycle: boardBus → hold, alightBus → debit + release, cancelTrip → release only
  - DB `CHECK (balance >= 0)` as last safety net
- `fare_rules.fixed_price` — optional override for government flat-rate exemptions
- `fare_rules.peak_hour_surcharge_pct` / `peak_start_hour` / `peak_end_hour` — peak pricing
- Transaction types: `DEBIT`, `CREDIT`, `REFUND`, `HOLD`, `HOLD_RELEASE` with doc comments

---

### Feedback & Incidents

#### [NEW] [005_feedback_and_incidents.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/005_feedback_and_incidents.sql)

- Create enums:
  - `incident_type_enum`: `'ACCIDENT'`, `'BREAKDOWN'`, `'HARASSMENT'`, `'THEFT'`, `'OTHER'`
  - `incident_severity_enum`: `'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL'`
  - `incident_status_enum`: `'OPEN'`, `'INVESTIGATING'`, `'RESOLVED'`, `'DISMISSED'`
- Tables: `feedback` (multi-dimensional ratings, unique per passenger+shift), `incidents`, `sos_events`

---

### Performance Indexes

#### [NEW] [006_indexes.sql](file:///home/aminul/Development/Work/intelligent-transport-app/infra/migrations/006_indexes.sql)

- 12 targeted indexes including:
  - Partial indexes on `trips(status)` and `shifts(status)` where `= 'ACTIVE'` — small, fast scans
  - Partial index on `fare_rules(route_id, passenger_category)` where `is_active = true` — fare engine
  - Descending sort indexes on `shift_telemetry(shift_id, recorded_at DESC)` and `transactions(wallet_id, created_at DESC)` — pagination queries
  - Maintenance indexes on `buses(fitness_cert_expiry)` and `driver_profiles(license_expiry)`

## Design Decisions

| Decision | Rationale |
|---|---|
| `DO $$ IF NOT EXISTS $$` for enums | Native `CREATE TYPE IF NOT EXISTS` doesn't exist in PG < 17; this pattern is idempotent |
| `shift_telemetry` composite PK `(id, recorded_at)` | PG requires partition key in PK; BIGSERIAL `id` still provides row uniqueness |
| Separate `006_indexes.sql` | Clean separation of DDL and performance tuning; easy to review/modify |
| `CHECK` constraints inline | Avoids separate constraint names for simple value checks |
| `NUMERIC` over `DECIMAL`/`FLOAT` | Exact arithmetic for financial amounts (fares, balances) |

## Verification Plan

### Automated Tests
1. **Syntax validation**: Run all 6 files through `psql` against a fresh database in the Docker container:
   ```bash
   docker exec -i transport_postgres psql -U transport_user -d transport_db < infra/migrations/001_users_and_auth.sql
   # ... repeat for 002–006
   ```
2. **Idempotency check**: Run all files a second time — should succeed without errors
3. **Migration runner**: Execute `npx ts-node infra/scripts/migrate.ts up` to verify the runner picks up all 6 files
4. **Schema introspection**: Query `information_schema.tables` and `pg_type` to confirm all tables, enums, and indexes exist
