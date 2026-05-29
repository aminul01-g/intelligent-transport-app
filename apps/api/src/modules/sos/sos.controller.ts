import { Request, Response } from 'express';
import { sosService } from '../sos/sos.service';
import { AppError } from '../../errors/AppError';

export class SOSController {
  /**
   * POST /sos/trigger
   * RBAC: PASSENGER
   */
  async triggerSOS(req: Request, res: Response) {
    const passengerId = req.user?.sub;
    if (!passengerId) throw new AppError('Unauthorized', 401);

    const { tripId, lat, lng } = req.body;
    if (!tripId || lat === undefined || lng === undefined) {
      throw new AppError('tripId, lat, and lng are required', 400);
    }

    const result = await sosService.triggerSOS(passengerId, tripId, lat, lng);
    res.json(result);
  }

  /**
   * GET /sos/track/:sosEventId
   * RBAC: PUBLIC (No auth required for emergency responders)
   */
  async trackSOS(req: Request, res: Response) {
    const { sosEventId } = req.params;
    if (!sosEventId) throw new AppError('sosEventId is required', 400);

    const result = await sosService.getSOSLocation(sosEventId);
    res.json(result);
  }
}

export const sosController = new SOSController();
