import { Router } from 'express';
import { authRouter } from '../../modules/auth/auth.controller';
import { fareRoutes } from '../../modules/fares/fare.routes';
import { fleetController } from '../../modules/fleet/fleet.controller';
import { incidentController } from '../../modules/incidents/incident.controller';
import { sosController } from '../../modules/sos/sos.controller';
import { authMiddleware } from '../../modules/auth/auth.middleware';

const v1Router = Router();

// ── Auth ──
v1Router.use('/auth', authRouter);

// ── Fares & Payments ──
v1Router.use('/fares', fareRoutes);

// ── Fleet Management (MANAGER only) ──
v1Router.use('/fleet', authMiddleware, async (req, res, next) => {
  if (req.user?.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Forbidden: Manager role required' });
  }
  next();
}, (req, res, next) => {
  // We use a separate router or just attach them here
  // For simplicity in this update, we'll wrap them in an Express Router
  next();
});

// Wait, it's cleaner to define a router for each module
const fleetRouter = Router();
fleetRouter.get('/active', fleetController.getActiveFleet);
fleetRouter.patch('/reassign-driver', fleetController.reassignDriver);
fleetRouter.patch('/substitute-bus', fleetController.substituteBus);
fleetRouter.post('/announcement', fleetController.sendAnnouncement);
v1Router.use('/fleet', authMiddleware, (req, res, next) => {
  if (req.user?.role !== 'MANAGER') return res.status(403).json({ error: 'Forbidden' });
  next();
}, fleetRouter);

const incidentRouter = Router();
incidentRouter.post('/breakdown', authMiddleware, (req, res, next) => {
  if (!['DRIVER', 'MANAGER'].includes(req.user?.role || '')) return res.status(403).json({ error: 'Forbidden' });
  next();
}, incidentController.createBreakdown);
incidentRouter.post('/traffic-jam', authMiddleware, (req, res, next) => {
  if (!['DRIVER', 'MANAGER'].includes(req.user?.role || '')) return res.status(403).json({ error: 'Forbidden' });
  next();
}, incidentController.handleTrafficJam);
incidentRouter.post('/report', authMiddleware, (req, res, next) => {
  if (req.user?.role !== 'PASSENGER') return res.status(403).json({ error: 'Forbidden' });
  next();
}, incidentController.createReport);
v1Router.use('/incidents', incidentRouter);

const sosRouter = Router();
sosRouter.post('/trigger', authMiddleware, (req, res, next) => {
  if (req.user?.role !== 'PASSENGER') return res.status(403).json({ error: 'Forbidden' });
  next();
}, sosController.triggerSOS);
sosRouter.get('/track/:sosEventId', sosController.trackSOS); // Public
v1Router.use('/sos', sosRouter);

// Version info
v1Router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      version: 'v1',
      service: 'intelligent-transport-api',
    },
  });
});

export default v1Router;
