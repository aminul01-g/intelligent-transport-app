# Tasks: Fleet Management, Incidents & Resilience

- [ ] **Implement FleetService**
  - Implement `getActiveFleet(managerId)` with Redis `bus:positions` enrichment.
  - Implement `reassignDriver(shiftId, newDriverId)` with cache invalidation.
  - Implement `substituteBus(shiftId, newBusId, managerId)` with transaction and cache invalidation.
  - Implement `sendStopAnnouncement(routeId, stopId, message, managerId)` with incident record and socket emission.

- [ ] **Implement IncidentService**
  - Implement `createBreakdown(shiftId, driverId)`:
    - [ ] Atomic transaction: Update bus/shift status.
    - [ ] Atomic transaction: Cancel active trips and release wallet holds (`held_balance`).
    - [ ] Atomic transaction: Insert `transactions` (HOLD_RELEASE) and `incidents` record.
    - [ ] Post-commit: Notify affected passengers and managers via sockets.
  - Implement `handleTrafficJam(shiftId, severity)`:
    - [ ] Emit updated ETAs for downstream stops.
    - [ ] For HIGH severity: Create incident and emit detour suggestions to managers.
  - Implement `createReport(passengerId, shiftId, type, description, severity)`:
    - [ ] Validate trip existence.
    - [ ] Create incident and notify managers if severity is HIGH/CRITICAL.

- [ ] **Implement SOSService**
  - Implement `triggerSOS(passengerId, tripId, lat, lng)`:
    - [ ] Create `sos_events` record.
    - [ ] Emit `sos:triggered` to managers.
  - Implement public endpoint `GET /sos/track/:sosEventId`:
    - [ ] Return latest telemetry position for the passenger's active shift.

- [ ] **Implement Controllers and Wiring**
  - [ ] Implement `FleetController` with RBAC.
  - [ ] Implement `IncidentController` with RBAC.
  - [ ] Implement `SOSController` (including public tracking route).
  - [ ] Wire all routes to the Express application.
