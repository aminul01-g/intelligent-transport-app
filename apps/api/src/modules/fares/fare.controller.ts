import { Request, Response } from 'express';
import { tripService } from './trip.service';
import { walletService } from './wallet.service';
import { boardBusSchema, alightBusSchema, topUpSchema } from './fare.validation';

class FareController {
  // Trips
  boardBus = async (req: Request, res: Response) => {
    const data = boardBusSchema.parse(req.body);
    const passengerId = req.user!.userId;
    
    const trip = await tripService.boardBus(passengerId, data.shiftId, data.boardingStopId);
    res.status(201).json({ success: true, data: trip });
  };

  alightBus = async (req: Request, res: Response) => {
    const tripId = req.params.tripId as string;
    const data = alightBusSchema.parse(req.body);
    
    const receipt = await tripService.alightBus(tripId, data.alightingStopId);
    res.json({ success: true, data: receipt });
  };

  cancelTrip = async (req: Request, res: Response) => {
    const tripId = req.params.tripId as string;
    const result = await tripService.cancelTrip(tripId);
    res.json({ success: true, data: result });
  };

  // Wallets
  getWalletBalance = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const balance = await walletService.getBalance(userId);
    res.json({ success: true, data: balance });
  };

  topUpWallet = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const data = topUpSchema.parse(req.body);
    
    const transaction = await walletService.topUp(userId, data.amount, data.paymentMethod);
    res.status(201).json({ success: true, data: transaction });
  };

  getTransactionHistory = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    const history = await walletService.getTransactionHistory(userId, page, limit);
    res.json({ success: true, data: history });
  };
}

export const fareController = new FareController();
