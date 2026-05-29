# Walkthrough: Fleet Management, Incident Handling, and Resilience

This document provides a technical overview of the implementation for the Fleet Management, Incident Handling, and SOS emergency systems.

## 1. Architectural Overview

The system is designed to handle high-stakes operational scenarios (like bus breakdowns and emergencies) where data consistency and real-time communication are critical. It uses a combination of **PostgreSQL** for transactional integrity and **Redis/Socket.io** for real-time state and notifications.

## 2. Detailed Implementation

### A. Fleet Management (`/modules/fleet`)
The Fleet module allows managers to maintain operational continuity.

- **Real-time Fleet View**: `getActiveFleet` combines relational data (shifts, drivers, routes) with volatile telemetry data stored in Redis (`bus:positions:{routeId}`). This ensures the manager sees the current location of the fleet without overloading the primary database.
- **Resilient Substitutions**: `substituteBus` uses a database transaction to ensure that a bus is not assigned to two active shifts simultaneously and verifies the `fitness_cert_expiry` before allowing a substitution.
- **Driver Reassignment**: `reassignDriver` prevents a driver from being assigned to multiple active shifts, ensuring safety and compliance.

### B. Incident Handling (`/modules/incidents`)
This module manages the lifecycle of operational disruptions.

- **The Breakdown Flow (Critical Scenario)**: 
  When a breakdown is triggered, the `createBreakdown` method executes a strictly atomic transaction:
  1. **Status Transition**: Bus $\to$ `BREAKDOWN`, Shift $\to$ `ABANDONED`.
  2. **Financial Recovery**: All `ACTIVE` trips on that shift are marked `CANCELLED`. The system automatically releases the `held_balance` from the user's wallet back to their available balance.
  3. **Audit Trail**: Every released hold is recorded as a `HOLD_RELEASE` transaction for financial auditing.
  4. **Communication**: After the commit, passengers are notified via the `/passenger` namespace and managers via `/manager`.

- **Traffic Management**: `handleTrafficJam` triggers ETA updates for all downstream passengers on the route. If severity is `HIGH`, it notifies managers with predefined detour options.

- **Passenger Reporting**: Allows passengers to report issues. Reports with `HIGH` or `CRITICAL` severity are escalated to managers immediately via sockets.

### C. SOS Emergency System (`/modules/sos`)
The SOS system is designed for maximum availability and rapid response.

- **Trigger Mechanism**: Passengers can trigger an SOS event. This creates a permanent record in `sos_events` and broadcasts an alert to the manager namespace.
- **Public Tracking**: The `GET /sos/track/:id` endpoint is intentionally excluded from authentication middleware. This allows emergency responders or authorized external entities to track the latest known position of the bus associated with the SOS event without needing a system account.

## 3. Technical Constraints & Decisions

| Feature | Decision | Reason |
| :--- | :--- | :--- |
| **Breakdowns** | Atomic Transaction | Prevents "phantom" holds where a trip is cancelled but money remains locked. |
| **Notifications** | Post-Commit Emission | Ensures users are not notified of a change that failed to persist in the DB. |
| **SOS Tracking** | Public Endpoint | Emergency scenarios require zero-friction access for responders. |
| **Fleet Data** | Redis Enrichment | Reduces DB load for high-frequency location queries. |

## 4. API Summary

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/v1/fleet/active` | GET | MANAGER | View all active buses and their live positions. |
| `/api/v1/fleet/substitute-bus` | PATCH | MANAGER | Replace a bus on a shift. |
| `/api/v1/incidents/breakdown` | POST | DRIVER/MGR | Trigger breakdown and release all holds. |
| `/api/v1/incidents/report` | POST | PASSENGER | Submit a service report. |
| `/api/v1/sos/trigger` | POST | PASSENGER | Trigger emergency SOS. |
| `/api/v1/sos/track/:id` | GET | PUBLIC | Track SOS event location. |
