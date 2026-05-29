# Walkthrough: Dynamic Fare Engine & Trip Lifecycle

This document provides a technical walkthrough of the Dynamic Fare Engine, Trip Lifecycle, and Wallet Hold system implemented for the Intelligent Transport App.

## 1. Shared Types and Enums
To ensure strict typing and consistency between the PostgreSQL database and the application layer, we added necessary types to `packages/shared-types`.

- **Enums (`enums.ts`)**: Added `TripStatus` (`ACTIVE`, `COMPLETED`, `CANCELLED`) and `TransactionType` (`DEBIT`, `CREDIT`, `REFUND`, `HOLD`, `HOLD_RELEASE`).
- **Interfaces (`index.ts`)**: Added exact DB-mirroring definitions for `RouteStop`, `RouteRecord`, `FareRule`, `Trip`, `Transaction`, and `Shift`.

---

## 2. Fare Calculation Engine (`fare.service.ts`)
The `FareService` encapsulates all complex pricing rules. By design, the core calculation functions are completely *pure* (no database side effects), making them robust and easily testable.

- **`calculateRouteDistance(boardingStopId, alightingStopId, allStops)`**: 
  A pure function that slices an ordered array of route stops to determine the exact distance traveled. It natively handles validation (e.g., preventing alighting before boarding).
- **`calculateFare(params)`**: 
  Computes the final price by sequentially applying business rules:
  1. Base fare calculation (`distance * basePricePerKm`).
  2. Fixed price overrides (if applicable).
  3. Percentage discounts.
  4. Peak hour surcharges (handling time wrap-arounds like 22:00 to 06:00 gracefully).
  5. Minimum fare floor check (5.00 BDT).
- **`getEstimatedMaxFare(...)`**: 
  An asynchronous helper that queries the database for the active route stops and fare rules, then uses `calculateFare` to determine the maximum possible cost (assuming the passenger travels to the very last stop).

---

## 3. Trip Lifecycle & Wallet Holds (`trip.service.ts`)
The `TripService` manages the state machine of a passenger's journey using strict atomic database transactions via the `db.transaction()` wrapper. This guarantees financial integrity.

- **`boardBus(passengerId, shiftId, boardingStopId)`**: 
  1. Ensures the shift is active and the user has no currently active trips.
  2. Calculates the `estimatedMaxFare` for the route.
  3. Verifies the user has sufficient available balance (`balance - held_balance`).
  4. **Atomic Tx**: Creates the `Trip`, increments the wallet's `held_balance`, and creates a `HOLD` ledger transaction.
- **`alightBus(tripId, alightingStopId)`**: 
  1. Fetches the trip, route sequence, and applicable fare rules.
  2. Calculates the actual final fare based on the passenger's specific alighting stop.
  3. **Atomic Tx**: Marks the trip as `COMPLETED`, deducts the final fare from the wallet's `balance`, decrements the `held_balance` safely, and creates `DEBIT` and `HOLD_RELEASE` ledger entries.
- **`cancelTrip(tripId)`**: 
  Safely cancels an active trip, releasing the `held_balance` without charging the user.

---

## 4. Wallet Service (`wallet.service.ts`)
The `WalletService` handles standard user ledger operations.

- **`getBalance(userId)`**: Returns the exact `balance`, `held_balance`, and a dynamically computed `availableBalance`.
- **`topUp(userId, amount, paymentMethod)`**: Atomically adds funds to the wallet and records a `CREDIT` transaction to track the deposit.
- **`getTransactionHistory(userId, page, limit)`**: Provides a paginated history of all `DEBIT`, `CREDIT`, `HOLD`, and `HOLD_RELEASE` actions on a user's wallet.

---

## 5. API Routes & Controllers
Finally, these modules were exposed to the frontend/mobile app securely under `/api/v1/fares`.

- **Validation (`fare.validation.ts`)**: Implements strict `zod` schemas for incoming payloads (e.g., UUID validation for `shiftId`, max bounds for `topUp`).
- **Controllers (`fare.controller.ts`)**: The orchestration layer bridging Express HTTP requests and our business services. Extracts `req.user!.userId` automatically.
- **Routes (`fare.routes.ts`)**: Defines the endpoint map (`/trips/board`, `/trips/:tripId/alight`, `/wallet/balance`, etc.). We utilized the `authenticate` and `authorize(UserRole.PASSENGER)` middlewares to ensure only valid passengers can interact with the system.

## Conclusion
The implementation fully meets the complex requirements of the public transport ecosystem. By separating pure logic (Fare Engine) from asynchronous side-effects (Database Transactions), the system achieves both testability and absolute data consistency.
