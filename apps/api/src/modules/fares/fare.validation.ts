import { z } from 'zod';

export const boardBusSchema = z.object({
  shiftId: z.string().uuid('Invalid shift ID'),
  boardingStopId: z.string().uuid('Invalid boarding stop ID'),
});

export const alightBusSchema = z.object({
  alightingStopId: z.string().uuid('Invalid alighting stop ID'),
});

export const topUpSchema = z.object({
  amount: z.number().positive().max(100000, 'Top up limit is 100,000'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
});
