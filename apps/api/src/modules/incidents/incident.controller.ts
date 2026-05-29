import { Request, Response } from 'express';
import { incidentService } from '../incidents/incident.service';
import { AppError } from '../../errors/AppError';

export class IncidentController {
  /**
   * POST /incidents/breakdown
   * RBAC: DRIVER, MANAGER
   */
  async createBreakdown(req: Request, res: Response) {
    const userId = req.user?.sub;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { shiftId } = req.body;
    if (!shiftId) throw new AppError('shiftId is required', 400);

    await incidentService.createBreakdown(shiftId, userId);
    res.json({ success: true, message: 'Breakdown reported and wallet holds released' });
  }

  /**
   * POST /incidents/traffic-jam
   * RBAC: DRIVER, MANAGER, SYSTEM (Telemetric)
   */
  async handleTrafficJam(req: Request, res: Response) {
    const userId = req.user?.sub;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { shiftId, severity } = req.body;
    if (!shiftId || !severity) throw new AppError('shiftId and severity are required', 400);

    await incidentService.handleTrafficJam(shiftId, severity);
    res.json({ success: true, message: 'Traffic jam reported and ETAs updated' });
  }

  /**
   * POST /incidents/report
   * RBAC: PASSENGER
   */
  async createReport(req: Request, res: Response) {
    const passengerId = req.user?.sub;
    if (!passengerId) throw new AppError('Unauthorized', 401);

    const { shiftId, type, description, severity } = req.body;
    if (!shiftId || !type || !description || !severity) {
      throw new AppError('shiftId, type, description, and severity are required', 400);
    }

    await incidentService.createReport(passengerId, shiftId, type, description, severity);
    res.json({ success: true, message: 'Report submitted successfully' });
  }
}

export const incidentController = new IncidentController();
