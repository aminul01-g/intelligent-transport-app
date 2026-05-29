import { PoolClient } from 'pg';
import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { fareService } from './fare.service';
import {
  Trip,
  Shift,
  RouteStop,
  RouteRecord,
  FareRule,
  User,
  Wallet,
} from '@transport/shared-types';

export interface AlightReceipt {
  tripId: string;
  fareCharged: number;
  distanceKm: number;
  routeName: string;
  boardingStop: string;
  alightingStop: string;
  newBalance: string;
  newHeldBalance: string;
}

class TripService {
  constructor(private readonly fareSvc = fareService) {}

  async boardBus(passengerId: string, shiftId: string, boardingStopId: string): Promise<Trip> {
    const { rows: shiftRows } = await db.query<Shift>(
      `SELECT * FROM shifts WHERE id = $1`,
      [shiftId],
    );
    const shift = shiftRows[0];
    if (!shift || shift.status !== 'ACTIVE') {
      throw AppError.badRequest('SHIFT_NOT_ACTIVE');
    }

    const { rows: existingTripRows } = await db.query<{ id: string }>(
      `SELECT id FROM trips WHERE passenger_id = $1 AND status = 'ACTIVE'`,
      [passengerId],
    );
    if (existingTripRows.length > 0) {
      throw AppError.conflict('ACTIVE_TRIP_EXISTS');
    }

    const { rows: userRows } = await db.query<User>(
      `SELECT passenger_category FROM users WHERE id = $1`,
      [passengerId],
    );
    const passengerCategory = userRows[0]?.passenger_category;
    if (!passengerCategory) {
      throw AppError.notFound('USER_NOT_FOUND');
    }

    const estimatedMaxFare = await this.fareSvc.getEstimatedMaxFare(
      shift.route_id,
      boardingStopId,
      passengerCategory,
      new Date(),
    );

    const { rows: walletRows } = await db.query<Wallet>(
      `SELECT id, balance, held_balance FROM wallets WHERE user_id = $1`,
      [passengerId],
    );
    const wallet = walletRows[0];
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND');
    }

    const availableBalance = parseFloat(wallet.balance) - parseFloat(wallet.held_balance);
    if (availableBalance < estimatedMaxFare) {
      throw AppError.badRequest(`INSUFFICIENT_BALANCE: Available: ${availableBalance} BDT, Required: ${estimatedMaxFare} BDT`);
    }

    return db.transaction(async (client: PoolClient) => {
      const { rows: tripRows } = await client.query<Trip>(
        `
        INSERT INTO trips (passenger_id, shift_id, boarding_stop_id, estimated_max_fare, status)
        VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING *
        `,
        [passengerId, shiftId, boardingStopId, estimatedMaxFare],
      );
      const trip = tripRows[0];
      if (!trip) throw new AppError('Failed to create trip', 500, 'INTERNAL_ERROR');

      await client.query(
        `
        UPDATE wallets SET held_balance = held_balance + $1, updated_at = NOW()
        WHERE user_id = $2
        `,
        [estimatedMaxFare, passengerId],
      );

      await client.query(
        `
        INSERT INTO transactions (wallet_id, trip_id, amount, type, description)
        VALUES ($1, $2, $3, 'HOLD', $4)
        `,
        [wallet.id, trip.id, estimatedMaxFare, `Fare reserved for trip ${trip.id}`],
      );

      return trip;
    });
  }

  async alightBus(tripId: string, alightingStopId: string): Promise<AlightReceipt> {
    const { rows: tripRows } = await db.query<Trip>(
      `SELECT * FROM trips WHERE id = $1`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip || trip.status !== 'ACTIVE') {
      throw AppError.badRequest('TRIP_NOT_ACTIVE');
    }

    const { rows: shiftRows } = await db.query<Shift & { route_name: string }>(
      `
      SELECT s.*, r.name as route_name 
      FROM shifts s
      JOIN routes r ON r.id = s.route_id
      WHERE s.id = $1
      `,
      [trip.shift_id],
    );
    const shift = shiftRows[0];
    if (!shift) {
      throw AppError.notFound('SHIFT_NOT_FOUND');
    }

    const { rows: allStops } = await db.query<RouteStop>(
      `SELECT * FROM route_stops WHERE route_id = $1 ORDER BY sequence_order ASC`,
      [shift.route_id],
    );

    const { rows: routeRows } = await db.query<RouteRecord>(
      `SELECT base_price_per_km FROM routes WHERE id = $1`,
      [shift.route_id],
    );
    const route = routeRows[0];
    if (!route) throw AppError.notFound('ROUTE_NOT_FOUND');

    const { rows: userRows } = await db.query<User>(
      `SELECT passenger_category FROM users WHERE id = $1`,
      [trip.passenger_id],
    );
    const user = userRows[0];
    if (!user) throw AppError.notFound('USER_NOT_FOUND');

    const { rows: ruleRows } = await db.query<FareRule>(
      `
      SELECT * FROM fare_rules
      WHERE route_id = $1 AND passenger_category = $2 AND is_active = true
      LIMIT 1
      `,
      [shift.route_id, user.passenger_category],
    );
    const fareRule = ruleRows[0] ?? null;

    const boardingTime = new Date(trip.boarded_at);
    
    const fareResult = this.fareSvc.calculateFare({
      allStops,
      boardingStopId: trip.boarding_stop_id,
      alightingStopId,
      basePricePerKm: parseFloat(route.base_price_per_km),
      fareRule,
      boardingTime,
    });

    const boardingStop = allStops.find((s) => s.id === trip.boarding_stop_id)?.stop_name || 'Unknown';
    const alightingStop = allStops.find((s) => s.id === alightingStopId)?.stop_name || 'Unknown';

    const { rows: walletRows } = await db.query<Wallet>(
      `SELECT id FROM wallets WHERE user_id = $1`,
      [trip.passenger_id],
    );
    const wallet = walletRows[0];
    if (!wallet) throw AppError.notFound('WALLET_NOT_FOUND');

    return db.transaction(async (client: PoolClient) => {
      await client.query(
        `
        UPDATE trips SET status = 'COMPLETED', alighting_stop_id = $1,
          fare_charged = $2, alighted_at = NOW()
        WHERE id = $3
        `,
        [alightingStopId, fareResult.finalPrice, tripId],
      );

      const { rows: updatedWalletRows } = await client.query<{ balance: string; held_balance: string }>(
        `
        UPDATE wallets SET
          balance = balance - $1,
          held_balance = held_balance - $2,
          updated_at = NOW()
        WHERE user_id = $3 RETURNING balance, held_balance
        `,
        [fareResult.finalPrice, trip.estimated_max_fare, trip.passenger_id],
      );
      const updatedWallet = updatedWalletRows[0];
      if (!updatedWallet) throw new AppError('Failed to update wallet', 500, 'INTERNAL_ERROR');
      const { balance: newBalance, held_balance: newHeldBalance } = updatedWallet;

      await client.query(
        `
        INSERT INTO transactions (wallet_id, trip_id, amount, type, description)
        VALUES ($1, $2, $3, 'DEBIT', $4)
        `,
        [wallet.id, tripId, fareResult.finalPrice, `Fare charged for trip ${tripId}`],
      );

      await client.query(
        `
        INSERT INTO transactions (wallet_id, trip_id, amount, type, description)
        VALUES ($1, $2, $3, 'HOLD_RELEASE', 'Hold released on trip completion')
        `,
        [wallet.id, tripId, trip.estimated_max_fare],
      );

      return {
        tripId,
        fareCharged: fareResult.finalPrice,
        distanceKm: fareResult.distanceKm,
        routeName: shift.route_name,
        boardingStop,
        alightingStop,
        newBalance,
        newHeldBalance,
      };
    });
  }

  async cancelTrip(tripId: string): Promise<{ tripId: string; releasedAmount: number }> {
    const { rows: tripRows } = await db.query<Trip>(
      `SELECT * FROM trips WHERE id = $1`,
      [tripId],
    );
    const trip = tripRows[0];
    if (!trip || trip.status !== 'ACTIVE') {
      throw AppError.badRequest('TRIP_NOT_ACTIVE');
    }

    const { rows: walletRows } = await db.query<Wallet>(
      `SELECT id FROM wallets WHERE user_id = $1`,
      [trip.passenger_id],
    );
    const wallet = walletRows[0];
    if (!wallet) throw AppError.notFound('WALLET_NOT_FOUND');

    return db.transaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE trips SET status = 'CANCELLED' WHERE id = $1`,
        [tripId],
      );

      await client.query(
        `
        UPDATE wallets SET
          held_balance = held_balance - $1,
          updated_at = NOW()
        WHERE user_id = $2
        `,
        [trip.estimated_max_fare, trip.passenger_id],
      );

      await client.query(
        `
        INSERT INTO transactions (wallet_id, trip_id, amount, type, description)
        VALUES ($1, $2, $3, 'HOLD_RELEASE', 'Hold released on trip cancellation')
        `,
        [wallet.id, tripId, trip.estimated_max_fare],
      );

      return {
        tripId,
        releasedAmount: parseFloat(trip.estimated_max_fare),
      };
    });
  }
}

export const tripService = new TripService();
