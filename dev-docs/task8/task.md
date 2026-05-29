# Dynamic Fare Engine, Trip Lifecycle & Wallet Holds — Task List

## Phase 1: Shared Types & Enums
- [x] Add `TripStatus` enum (`ACTIVE`, `COMPLETED`, `CANCELLED`) to `enums.ts`
- [x] Add `TransactionType` enum (`DEBIT`, `CREDIT`, `REFUND`, `HOLD`, `HOLD_RELEASE`) to `enums.ts`
- [x] Add DB-mirroring interfaces to `index.ts`:
  - [x] `RouteStop`
  - [x] `RouteRecord`
  - [x] `FareRule`
  - [x] `Trip`
  - [x] `Transaction`
  - [x] `Shift`

## Phase 2: Fare Calculation Engine
- [x] Create `apps/api/src/modules/fares/fare.service.ts`
- [x] Define local interfaces `CalculateFareParams` and `CalculatedFare`
- [x] Implement pure function `calculateRouteDistance(boardingStopId, alightingStopId, allStops)`
- [x] Implement pure function `calculateFare(params)`
  - [x] Distance calculation
  - [x] Fixed price override logic
  - [x] Base fare & discount logic
  - [x] Peak hour logic with wrap-around support
  - [x] Minimum fare floor (5.00 BDT)
- [x] Implement async method `getEstimatedMaxFare(...)`
  - [x] Fetch route stops, ordered
  - [x] Fetch base price
  - [x] Fetch active fare rule
  - [x] Calculate distance to last stop

## Phase 3: Trip Lifecycle Management
- [x] Create `apps/api/src/modules/fares/trip.service.ts`
- [x] Inject `fareService` into `TripService` constructor
- [x] Implement `boardBus(passengerId, shiftId, boardingStopId)`
  - [x] Validation checks (shift active, no active trip)
  - [x] Calculate `estimatedMaxFare`
  - [x] Verify `availableBalance >= estimatedMaxFare`
  - [x] Atomic transaction (create trip, hold wallet balance, create HOLD transaction)
- [x] Implement `alightBus(tripId, alightingStopId)`
  - [x] Validation (trip active)
  - [x] Fetch required route/stop/rule data
  - [x] Calculate final fare using `fareService.calculateFare`
  - [x] Atomic transaction (complete trip, settle wallet balance & held_balance, create DEBIT + HOLD_RELEASE transactions)
- [x] Implement `cancelTrip(tripId)`
  - [x] Validation (trip active)
  - [x] Atomic transaction (cancel trip, release wallet held_balance, create HOLD_RELEASE transaction)

## Phase 4: Wallet Service
- [x] Create `apps/api/src/modules/fares/wallet.service.ts`
- [x] Implement `getBalance(userId)` returning calculated `availableBalance`
- [x] Implement `topUp(userId, amount, paymentMethod)`
  - [x] Atomic transaction (increment balance, add CREDIT transaction)
- [x] Implement `getTransactionHistory(userId, page, limit)` — paginated history

## Phase 5: Controllers & Routes
- [x] Create `apps/api/src/modules/fares/fare.validation.ts`
- [x] Create `apps/api/src/modules/fares/fare.controller.ts`
- [x] Create `apps/api/src/modules/fares/fare.routes.ts`
- [x] Integrate into `apps/api/src/routes/v1/index.ts`

## Phase 6: Verification
- [x] Run `npx tsc --noEmit` from `apps/api`
- [x] Fix any TypeScript compilation errors
- [x] Unit test: `calculateRouteDistance`
- [x] Unit test: `calculateFare`
- [x] Unit test: `wallet.service.ts` topUp constraints
- [x] Integration test: Full board/alight wallet balance lifecycle
