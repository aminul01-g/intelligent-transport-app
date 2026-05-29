import { Router } from 'express';
import { fareController } from './fare.controller';
import { authenticate, authorize } from '../auth/auth.middleware';
import { asyncHandler } from '../../middleware/asyncHandler';
import { UserRole } from '@transport/shared-types';

const router = Router();

// Ensure all routes require authentication
router.use(authenticate);

// ──────────────────────────────────────────────
// Trips
// ──────────────────────────────────────────────

// Only passengers can board/alight buses
router.post(
  '/trips/board',
  authorize(UserRole.PASSENGER),
  asyncHandler(fareController.boardBus)
);

router.post(
  '/trips/:tripId/alight',
  authorize(UserRole.PASSENGER),
  asyncHandler(fareController.alightBus)
);

router.post(
  '/trips/:tripId/cancel',
  authorize(UserRole.PASSENGER),
  asyncHandler(fareController.cancelTrip)
);

// ──────────────────────────────────────────────
// Wallets
// ──────────────────────────────────────────────

router.get(
  '/wallet/balance',
  asyncHandler(fareController.getWalletBalance)
);

router.post(
  '/wallet/top-up',
  asyncHandler(fareController.topUpWallet)
);

router.get(
  '/wallet/transactions',
  asyncHandler(fareController.getTransactionHistory)
);

export const fareRoutes = router;
