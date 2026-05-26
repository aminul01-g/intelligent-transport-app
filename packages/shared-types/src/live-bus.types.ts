/**
 * Real-time payload emitted over Socket.IO for live bus tracking.
 *
 * This interface is the single source of truth shared between:
 *  - The API server (socket emitter)
 *  - The passenger frontend (socket consumer)
 *
 * Any field changes here will surface compile errors in both apps.
 */
export interface LiveBusPayload {
  shiftId: string;
  busId: string;
  routeId: string;

  /** Current latitude in decimal degrees. */
  lat: number;
  /** Current longitude in decimal degrees. */
  lng: number;
  /** Instantaneous speed in km/h. */
  speed: number;

  /** Current number of passengers on board. */
  passengerCount: number;
  /** Maximum passenger capacity of the bus. */
  capacity: number;
  /** Derived occupancy band for UI colour-coding. */
  occupancyLevel: 'LOW' | 'MEDIUM' | 'HIGH';

  driverName: string;
  /** Aggregate driver rating (1–5 scale). */
  driverRating: number;
  routeManagerName: string;

  /** ISO-8601 timestamp of when this reading was taken. */
  timestamp: string;
}
