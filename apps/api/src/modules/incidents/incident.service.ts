import { db } from '../../db';
import { cache } from '../../cache';
import { managerNs, passengerNs } from '../../realtime';
import { AppError } from '../../errors/AppError';

class IncidentService {
  /**
   * Create a breakdown incident for the given shift.
   * CRITICAL SCENARIO A: Atomic transaction to update status and release wallet holds.
   */
  async createBreakdown(shiftId: string, driverId: string): Promise<void> {
    await db.transaction(async (client) => {
      // 1. Update Bus status
      const { rows: shiftRows } = await client.query(
        `SELECT bus_id FROM shifts WHERE id = $1`,
        [shiftId]
      );
      const shift = shiftRows[0];
      if (!shift) throw new AppError('Shift not found', 404);

      await client.query(
        `UPDATE buses SET status = 'BREAKDOWN' WHERE id = $1`,
        [shift.bus_id]
      );

      // 2. Update Shift status
      await client.query(
        `UPDATE shifts SET status = 'ABANDONED' WHERE id = $1`,
        [shiftId]
      );

      // 3. Cancel active trips and release wallet holds
      const { rows: activeTrips } = await client.query(
        `SELECT t.id, t.passenger_id, t.estimated_max_fare, w.id as "walletId", w.held_balance
         FROM trips t
         JOIN wallets w ON t.passenger_id = w.user_id
         WHERE t.shift_id = $1 AND t.status = 'ACTIVE'`,
        [shiftId]
      );

      for (const trip of activeTrips) {
        // Cancel trip
        await client.query(
          `UPDATE trips SET status = 'CANCELLED' WHERE id = $1`,
          [trip.id]
        );

        // Release hold: held_balance = held_balance - estimated_max_fare
        const releaseAmount = trip.estimated_max_fare;
        await client.query(
          `UPDATE wallets SET held_balance = held_balance - $1 WHERE id = $2`,
          [releaseAmount, trip.walletId]
        );

        // Record transaction (HOLD_RELEASE)
        await client.query(
          `INSERT INTO transactions (user_id, type, amount, wallet_id)
           VALUES ($1, 'HOLD_RELEASE', $2, $3)`,
          [trip.passenger_id, releaseAmount, trip.walletId]
        );
      }

      // 4. Create incident record
      await client.query(
        `INSERT INTO incidents (type, severity, description, created_by)
         VALUES ('BREAKDOWN', 'CRITICAL', $1, $2)`,
        [`Breakdown reported by driver ${driverId}`, driverId]
      );
    });

    // Post-Commit: Notify affected passengers and managers
    const { rows: affectedPassengers } = await db.query(
      `SELECT DISTINCT passenger_id FROM trips WHERE shift_id = $1 AND status = 'CANCELLED'`,
      [shiftId]
    );

    for (const p of affectedPassengers) {
      passengerNs.to(`passenger:${p.passenger_id}`).emit('bus:breakdown', {
        shiftId,
        message: 'Your bus has suffered a breakdown. Your fare hold has been released.',
      });
    }

    managerNs.emit('incident:new', {
      type: 'BREAKDOWN',
      severity: 'CRITICAL',
      shiftId,
      driverId,
    });
  }

  /**
   * Handle a traffic jam for the given shift.
   * SCENARIO B: Update ETAs and optionally notify managers.
   */
  async handleTrafficJam(shiftId: string, severity: string): Promise<void> {
    const { rows: shiftRows } = await db.query(
      `SELECT route_id FROM shifts WHERE id = $1`,
      [shiftId]
    );
    const shift = shiftRows[0];
    if (!shift) throw new AppError('Shift not found', 404);

    // 1. Update ETAs (simplified implementation)
    // In a real system, we would recalculate ETAs based on current traffic.
    // Here we emit a general ETA update signal for the route.
    passengerNs.to(`route:${shift.route_id}`).emit('eta:updated', {
      shiftId,
      status: 'DELAYED',
      severity,
    });

    if (severity === 'HIGH') {
      // 2. Create incident
      await db.query(
        `INSERT INTO incidents (type, severity, description, route_id, created_by)
         VALUES ('TRAFFIC_JAM', 'HIGH', $1, $2, 'SYSTEM')`,
        [`High severity traffic jam detected on route ${shift.route_id}`, shift.route_id]
      );

      // 3. Notify managers with detour options (mocked)
      managerNs.emit('incident:new', {
        type: 'TRAFFIC_JAM',
        severity: 'HIGH',
        shiftId,
        detourSuggestions: ['Route-B detour via Main St', 'Route-C detour via High St'],
      });
    }
  }

  /**
   * Create a report from a passenger.
   */
  async createReport(passengerId: string, shiftId: string, type: string, description: string, severity: string): Promise<void> {
    // 1. Validate passenger has COMPLETED/ACTIVE trip on shift
    const { rows: tripRows } = await db.query(
      `SELECT id FROM trips WHERE passenger_id = $1 AND shift_id = $2 AND status IN ('ACTIVE', 'COMPLETED')`,
      [passengerId, shiftId]
    );

    if (tripRows.length === 0) {
      throw new AppError('Passenger has no valid trip on this shift', 400);
    }

    // 2. Create incident record
    await db.query(
      `INSERT INTO incidents (type, severity, description, created_by)
       VALUES ('PASSENGER_REPORT', $1, $2, $3)`,
      [severity, description, passengerId]
    );

    // 3. Notify managers if severity is HIGH or CRITICAL
    if (severity === 'HIGH' || severity === 'CRITICAL') {
      managerNs.emit('incident:new', {
        type: 'PASSENGER_REPORT',
        severity,
        description,
        passengerId,
        shiftId,
        highPriority: true,
      });
    }
  }
}

export const incidentService = new IncidentService();
