# Implementation Plan: Fleet Management, Incident Handling, and Resilience

## Overview
Implementation of fleet operations, incident management, and SOS emergency systems. This module handles critical resilience scenarios including bus breakdowns with automated wallet hold releases, traffic jam management, and real-time emergency tracking.

## 1. Fleet Management (`apps/api/src/modules/fleet/`)

### FleetService
- **`getActiveFleet(managerId)`**:
  - Query active shifts for the manager's company.
  - Enrich with `LiveBusPayload` from Redis `bus:positions:{routeId}`.
  - Return `{ shift, bus, driver, route, livePosition | null }`.
- **`reassignDriver(shiftId, newDriverId)`**:
  - Validate: driver exists, role=DRIVER, not on another ACTIVE shift.
  - Update `shifts.driver_id`.
  - Invalidate Redis cache `shift:meta:{shiftId}`.
  - Emit `shift:updated` to `/manager` namespace.
- **`substituteBus(shiftId, newBusId, managerId)`**:
  - Validate: bus status='ACTIVE', `fitness_cert_expiry` > now, not on another ACTIVE shift.
  - Transactional update of `shifts.bus_id`.
  - Invalidate Redis cache `shift:meta:{shiftId}`.
  - Emit `bus:substituted` to room `route:{routeId}` in `/passenger` namespace with ETA.
- **`sendStopAnnouncement(routeId, stopId, message, managerId)`**:
  - Create incident (type='ANNOUNCEMENT', severity='LOW').
  - Emit `stop:announcement` to room `route:{routeId}` in `/passenger` namespace.

## 2. Incident Handling (`apps/api/src/modules/incidents/`)

### IncidentService
- **`createBreakdown(shiftId, driverId)`** (CRITICAL SCENARIO A):
  - **Atomic Transaction**:
    - `buses` status $\to$ 'BREAKDOWN'.
    - `shifts` status $\to$ 'ABANDONED'.
    - Find all ACTIVE trips for the shift.
    - For each trip:
      - `trips` status $\to$ 'CANCELLED'.
      - `wallets` `held_balance` $\to$ `held_balance - trip.estimated_max_fare`.
      - Create `transactions` (type='HOLD_RELEASE').
    - Create `incidents` (type='BREAKDOWN', severity='CRITICAL').
  - **Post-Commit (Fire-and-Forget)**:
    - Notify affected passengers via socket (`bus:breakdown`).
    - Notify managers via socket (`incident:new`).
- **`handleTrafficJam(shiftId, severity)`** (SCENARIO B):
  - Fetch downstream stops.
  - Emit `eta:updated` to room `route:{routeId}` in `/passenger` namespace.
  - If severity='HIGH':
    - Create `incidents` (type='TRAFFIC_JAM', severity='HIGH').
    - Emit `incident:new` to `/manager` namespace with detour options.
- **`createReport(passengerId, shiftId, type, description, severity)`**:
  - Validate passenger has COMPLETED/ACTIVE trip on shift.
  - Create `incidents` record.
  - If severity $\ge$ 'HIGH': emit `incident:new` to `/manager` namespace (`highPriority=true`).

## 3. SOS Service (`apps/api/src/modules/sos/`)

### SOSService
- **`triggerSOS(passengerId, tripId, lat, lng)`**:
  - Create `sos_events` record.
  - Emit `sos:triggered` to `/manager` namespace.
  - Return `{ sosEventId, trackingUrl: '/sos/track/${sosEventId}' }`.
- **`getSOSLocation(sosEventId)`**:
  - Fetch `sos_events`.
  - Return latest telemetry for the passenger's active shift.

## 4. Controllers & Wiring
- `fleet.controller.ts`, `incidents.controller.ts`, `sos.controller.ts`.
- Proper RBAC (MANAGER, DRIVER, PASSENGER).
- Public access for `/sos/track/:id`.

## Constraints
- **Breakdown Transaction**: Must be atomic. Rollback on any failure.
- **Socket Emissions**: MUST occur AFTER transaction commit.
- **Wallet Logic**: HOLD_RELEASE only during breakdown. No CREDIT/REFUND unless separate compensation is added.
- **Cache**: Invalidate `shift:meta` on driver/bus changes.
