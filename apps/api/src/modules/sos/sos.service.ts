import { db } from '../../db';
import { managerNs } from '../../realtime';
import { AppError } from '../../errors/AppError';

interface SOSEvent {
  id: string;
  passengerId: string;
  tripId: string;
  lat: number;
  lng: number;
  createdAt: Date;
}

class SOSService {
  /**
   * Trigger an SOS emergency event for a passenger.
   */
  async triggerSOS(passengerId: string, tripId: string, lat: number, lng: number): Promise<{ sosEventId: string; trackingUrl: string }> {
    const { rows: tripRows } = await db.query(
      `SELECT id FROM trips WHERE id = $1 AND passenger_id = $2 AND status = 'ACTIVE'`,
      [tripId, passengerId]
    );

    if (tripRows.length === 0) {
      throw new AppError('No active trip found for this passenger', 400);
    }

    const { rows: sosRows } = await db.query(
      `INSERT INTO sos_events (passenger_id, trip_id, lat, lng, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [passengerId, tripId, lat, lng]
    );

    const sosEventId = sosRows[0].id;

    // Notify managers
    managerNs.emit('sos:triggered', {
      sosEventId,
      passengerId,
      tripId,
      location: { lat, lng },
      timestamp: new Date().toISOString(),
    });

    return {
      sosEventId,
      trackingUrl: `/sos/track/${sosEventId}`,
    };
  }

  /**
   * Get the latest location for an SOS event.
   * This endpoint is intended to be public for emergency responders.
   */
  async getSOSLocation(sosEventId: string) {
    const { rows: sosRows } = await db.query(
      `SELECT s.passenger_id, s.trip_id, s.lat, s.lng
       FROM sos_events s
       WHERE s.id = $1`,
      [sosEventId]
    );

    const sosEvent = sosRows[0];
    if (!sosEvent) {
      throw new AppError('SOS event not found', 404);
    }

    // Return latest telemetry for the passenger's active shift
    const { rows: telemetryRows } = await db.query(
      `SELECT t.lat, t.lng, t.speed, t.timestamp
       FROM telemetry t
       JOIN trips tr ON t.bus_id = tr.bus_id
       WHERE tr.id = $1
       ORDER BY t.timestamp DESC
       LIMIT 1`,
      [sosEvent.trip_id]
    );

    if (telemetryRows.length > 0) {
      return {
        event: sosEvent,
        latestPosition: telemetryRows[0],
      };
    }

    return {
      event: sosEvent,
      latestPosition: null,
    };
  }
}

export const sosService = new SOSService();
