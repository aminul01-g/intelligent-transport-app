import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { env } from '../config/env';

/**
 * Centralised error handler — MUST be registered as the LAST middleware.
 *
 * Catches both operational AppErrors and unexpected runtime errors,
 * returning a consistent JSON envelope:
 *
 *   { success: false, message: string, code: string, stack?: string }
 *
 * The `stack` field is included only when NODE_ENV !== 'production'.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // ── Operational errors (known, expected) ──
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false as const,
      message: err.message,
      code: err.code,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
    return;
  }

  // ── Unknown / programmer errors ──
  console.error('[ERROR] Unhandled error:', err);

  res.status(500).json({
    success: false as const,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
