import { db } from '../../db';
import { cache } from '../../cache';
import { managerNs, passengerNs } from '../../realtime';
import { AppError } from '../../errors/AppError';

interface LiveBusPayload {
  lat: number;
  lng: number;
  speed: number;
  lastUpdate: string;
}

interface FleetEntry {
  shiftId: string;
  busId: string;
  driverId: string;
  routeId: string;
  status: string;
  livePosition: LiveBusPayload | null;
}

class FleetService {
  /**
   * Get all active fleet for a manager's company.
   * Enriches shift data with real-time positions from Redis.
   */
  async getActiveFleet(managerId: string): Promise<FleetEntry[]> {
    const { rows: shifts } = await db.query(`
      SELECT s.id as "shiftId", s.bus_id as "busId", s.driver_id as "driverId", s.route_id as "routeId", s.status
      FROM shifts s
      JOIN companies c ON s.company_id = c.id
      JOIN managers m ON m.company_id = c.id
      WHERE m.id = $1 AND s.status = 'ACTIVE'
    `, [managerId]);

    const fleet: FleetEntry[] = [];

    for (const shift of shifts) {
      // Redis key: bus:positions:{routeId} (though usually it's per bus)
      // According to implementation plan: Redis `bus:positions:{routeId}`
      // This might be a hash or a key containing all buses on a route.
      // We'll assume a hash where field is busId.
      const positionsRaw = await cache.get<Record<string, string>>(`bus:positions:${shift.routeId}`);
      let livePosition: LiveBusPayload | null = null;

      if (positionsRaw && positionsRaw[shift.busId]) {
        livePosition = JSON.parse(positionsRaw[shift.busId]);
      }

      fleet.push({
        ...shift,
        livePosition,
      });
    }

    return fleet;
  }

  /**
   * Reassign a driver to an existing shift.
   */
  async reassignDriver(shiftId: string, newDriverId: string): Promise<void> {
    const { rows: driverRows } = await db.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [newDriverId]
    );
    const driver = driverRows[0];

    if (!driver || driver.role !== 'DRIVER') {
      throw new AppError('Invalid driver provided', 400);
    }

    const { rows: activeShift } = await db.query(
      `SELECT id FROM shifts WHERE driver_id = $1 AND status = 'ACTIVE'`,
      [newDriverId]
    );

    if (activeShift.length > 0) {
      throw new AppError('Driver is already on another active shift', 400);
    }

    await db.query(
      `UPDATE shifts SET driver_id = $1 WHERE id = $2`,
      [newDriverId, shiftId]
    );

    await cache.del(`shift:meta:${shiftId}`);
    managerNs.emit('shift:updated', { shiftId, driverId: newDriverId });
  }

  /**
   * Substitute a bus for an existing shift.
   */
  async substituteBus(shiftId: string, newBusId: string, managerId: string): Promise<void> {
    await db.transaction(async (client) => {
      const { rows: busRows } = await client.query(
        `SELECT id, status, fitness_cert_expiry FROM buses WHERE id = $1`,
        [newBusId]
      );
      const bus = busRows[0];

      if (!bus || bus.status !== 'ACTIVE') {
        throw new AppError('Bus is not active', 400);
      }

      if (new Date(bus.fitness_cert_expiry) <= new Date()) {
        throw new AppError('Bus fitness certificate has expired', 400);
      }

      const { rows: activeShift } = await client.query(
        `SELECT id FROM shifts WHERE bus_id = $1 AND status = 'ACTIVE'`,
        [newBusId]
      );

      if (activeShift.length > 0) {
        throw new AppError('Bus is already assigned to another active shift', 400);
      }

      const { rows: shiftRows } = await client.query(
        `SELECT route_id FROM shifts WHERE id = $1`,
        [shiftId]
      );
      const shift = shiftRows[0];
      if (!shift) throw new AppError('Shift not found', 404);

      await client.query(
        `UPDATE shifts SET bus_id = $1 WHERE id = $2`,
        [newBusId, shiftId]
      );

      // Cache invalidation must happen after commit, but since we are in
      // a transaction, we handle it via the service method.
      // Wait, the logic is inside the transaction block.
      // We'll move the cache.del and emit outside.
    });

    // Re-fetching routeId for the event
    const { rows: shiftRows } = await db.query(`SELECT route_id FROM shifts WHERE id = $1`, [shiftId]);
    const routeId = shiftRows[0]?.route_id;

    await cache.del(`shift:meta:${shiftId}`);

    if (routeId) {
      passengerNs.to(`route:${routeId}`).emit('bus:substituted', {
        shiftId,
        newBusId,
        message: 'The bus for this route has been substituted. ETA may be updated.'
      });
    }
  }

  /**
   * Send a stop announcement to passengers on a route.
   */
  async sendStopAnnouncement(routeId: string, stopId: string, message: string, managerId: string): Promise<void> {
    await db.query(
      `INSERT INTO incidents (type, severity, description, route_id, stop_id, created_by)
       VALUES ('ANNOUNCEMENT', 'LOW', $1, $2, $3, $4)`,
      [message, routeId, stopId, managerId]
    );

    passengerNs.to(`route:${routeId}`).emit('stop:announcement', {
      stopId,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

export const fleetService = new FleetService();
