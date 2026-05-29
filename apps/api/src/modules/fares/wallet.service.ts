import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { Transaction, Wallet, PaginatedResponse } from '@transport/shared-types';

export interface WalletBalance {
  balance: string;
  held_balance: string;
  availableBalance: number;
  currency: string;
}

class WalletService {
  async getBalance(userId: string): Promise<WalletBalance> {
    const { rows } = await db.query<Wallet>(
      `SELECT balance, held_balance, currency FROM wallets WHERE user_id = $1`,
      [userId],
    );
    const wallet = rows[0];
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND');
    }

    return {
      balance: wallet.balance,
      held_balance: wallet.held_balance,
      availableBalance: parseFloat(wallet.balance) - parseFloat(wallet.held_balance),
      currency: wallet.currency,
    };
  }

  async topUp(userId: string, amount: number, paymentMethod: string): Promise<Transaction> {
    if (amount <= 0 || amount > 100000) {
      throw AppError.badRequest('INVALID_TOPUP_AMOUNT');
    }

    const { rows: walletRows } = await db.query<Wallet>(
      `SELECT id FROM wallets WHERE user_id = $1`,
      [userId],
    );
    const wallet = walletRows[0];
    if (!wallet) {
      throw AppError.notFound('WALLET_NOT_FOUND');
    }

    return db.transaction(async (client) => {
      await client.query(
        `
        UPDATE wallets SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2
        `,
        [amount, userId],
      );

      const { rows: txRows } = await client.query<Transaction>(
        `
        INSERT INTO transactions (wallet_id, trip_id, amount, type, description)
        VALUES ($1, NULL, $2, 'CREDIT', $3) RETURNING *
        `,
        [wallet.id, amount, `Wallet top-up via ${paymentMethod}`],
      );

      const tx = txRows[0];
      if (!tx) throw new AppError('Failed to create transaction', 500, 'INTERNAL_ERROR');
      return tx;
    });
  }

  async getTransactionHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<Transaction>> {
    const offset = (page - 1) * limit;

    const { rows: items } = await db.query<Transaction>(
      `
      SELECT t.* FROM transactions t
      JOIN wallets w ON w.id = t.wallet_id
      WHERE w.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [userId, limit, offset],
    );

    const { rows: countRows } = await db.query<{ count: string }>(
      `
      SELECT COUNT(*) FROM transactions t
      JOIN wallets w ON w.id = t.wallet_id
      WHERE w.user_id = $1
      `,
      [userId],
    );

    const countRow = countRows[0];
    const total = countRow ? parseInt(countRow.count, 10) : 0;

    return {
      items,
      total,
      page,
      limit,
    };
  }
}

export const walletService = new WalletService();
