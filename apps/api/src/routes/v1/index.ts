import { Router } from 'express';

const v1Router = Router();

/**
 * GET /api/v1
 * API version info — useful for client version negotiation and health dashboards.
 */
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
