// ──────────────────────────────────────────────
// Occupancy level calculator
// ──────────────────────────────────────────────

export type OccupancyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Derives the occupancy band for a bus based on current passenger
 * count and the vehicle's maximum capacity.
 *
 * Used by the telemetry service to enrich the {@link LiveBusPayload}
 * before broadcasting over Socket.IO.
 *
 * Thresholds:
 *   - ratio < 0.30  → LOW
 *   - ratio ≤ 0.70  → MEDIUM
 *   - ratio > 0.70  → HIGH
 *
 * @param passengerCount  Current number of passengers on board.
 * @param capacity        Maximum seating/standing capacity of the bus.
 * @returns The occupancy band as a string literal.
 */
export function calculateOccupancyLevel(
  passengerCount: number,
  capacity: number,
): OccupancyLevel {
  // Guard: avoid division by zero for misconfigured vehicles.
  if (capacity === 0) return 'LOW';

  const ratio = passengerCount / capacity;

  if (ratio < 0.30) return 'LOW';
  if (ratio <= 0.70) return 'MEDIUM';
  return 'HIGH';
}
