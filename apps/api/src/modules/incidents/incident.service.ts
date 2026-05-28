// ──────────────────────────────────────────────
// Incident service (STUB)
//
// Provides the interface consumed by telemetry.service.ts and
// telemetry.gateway.ts.  Full implementation will be added in the
// incidents module prompt.
// ──────────────────────────────────────────────

class IncidentService {
  /**
   * Handle a detected traffic jam for the given shift.
   *
   * Called by the telemetry service when all 5 recent speed readings
   * for a shift fall below 5 km/h.
   *
   * TODO: Implement full incident creation — insert into the incidents
   * table, notify the route manager via Socket.IO /manager namespace,
   * and trigger a push notification.
   */
  async handleTrafficJam(shiftId: string, severity: string): Promise<void> {
    console.log(
      `[INCIDENT] Traffic jam detected: shift=${shiftId} severity=${severity}`,
    );
  }

  /**
   * Create a breakdown incident for the given shift.
   *
   * Called by the telemetry gateway when a driver emits 'breakdown:signal'.
   *
   * TODO: Implement full breakdown flow — update bus status to BREAKDOWN,
   * create incident record, notify manager, and optionally reassign
   * passengers to nearby buses.
   */
  async createBreakdown(shiftId: string): Promise<void> {
    console.log(`[INCIDENT] Breakdown reported: shift=${shiftId}`);
  }
}

export const incidentService = new IncidentService();
