import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Vehicle } from '@transport/shared-types';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'intelligent-transport-api',
  });
});

// Endpoint serving typed vehicle mock data
app.get('/api/vehicles', (_req: Request, res: Response) => {
  const mockVehicles: Vehicle[] = [
    {
      id: 'v-001',
      vin: '1HM1234567890ABCD',
      type: 'EV_SHUTTLE',
      model: 'TransitEV-X2',
      capacity: 24,
      status: 'ACTIVE',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'v-002',
      vin: '1HM9876543210EFGH',
      type: 'BUS',
      model: 'CityLiner-G3',
      capacity: 85,
      status: 'MAINTENANCE',
      lastUpdated: new Date().toISOString(),
    },
  ];
  res.json(mockVehicles);
});

app.listen(port, () => {
  console.log(
    `[API] Server is running on port ${port} under ${process.env.NODE_ENV || 'development'} mode`,
  );
});
