import { Request, Response } from 'express';
import { fleetService } from '../fleet/fleet.service';
import { AppError } from '../../errors/AppError';

export class FleetController {
  /**
   * GET /fleet/active
   * RBAC: MANAGER
   */
  async getActiveFleet(req: Request, res: Response) {
    const managerId = req.user?.sub;
    if (!managerId) throw new AppError('Unauthorized', 401);

    const fleet = await fleetService.getActiveFleet(managerId);
    res.json(fleet);
  }

  /**
   * PATCH /fleet/reassign-driver
   * RBAC: MANAGER
   */
  async reassignDriver(req: Request, res: Response) {
    const managerId = req.user?.sub;
    if (!managerId) throw new AppError('Unauthorized', 401);

    const { shiftId, driverId } = req.body;
    if (!shiftId || !driverId) throw new AppError('shiftId and driverId are required', 400);

    await fleetService.reassignDriver(shiftId, driverId);
    res.json({ success: true, message: 'Driver reassigned successfully' });
  }

  /**
   * PATCH /fleet/substitute-bus
   * RBAC: MANAGER
   */
  async substituteBus(req: Request, res: Response) {
    const managerId = req.user?.sub;
    if (!managerId) throw new AppError('Unauthorized', 401);

    const { shiftId, busId } = req.body;
    if (!shiftId || !busId) throw new AppError('shiftId and busId are required', 400);

    await fleetService.substituteBus(shiftId, busId, managerId);
    res.json({ success: true, message: 'Bus substituted successfully' });
  }

  /**
   * POST /fleet/announcement
   * RBAC: MANAGER
   */
  async sendAnnouncement(req: Request, res: Response) {
    const managerId = req.user?.sub;
    if (!managerId) throw new AppError('Unauthorized', 401);

    const { routeId, stopId, message } = req.body;
    if (!routeId || !stopId || !message) throw new AppError('routeId, stopId, and message are required', 400);

    await fleetService.sendStopAnnouncement(routeId, stopId, message, managerId);
    res.json({ success: true, message: 'Announcement sent successfully' });
  }
}

export const fleetController = new FleetController();
