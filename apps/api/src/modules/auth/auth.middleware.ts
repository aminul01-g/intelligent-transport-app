import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, PassengerCategory } from '@transport/shared-types';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { db } from '../../db';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
        passengerCategory: PassengerCategory;
        email: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using a JWT in the Authorization header.
 * Attaches the decoded payload to req.user.
 */
export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(AppError.unauthorized('TOKEN_MISSING'));
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next(AppError.unauthorized('TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      userId: string;
      role: UserRole;
      passengerCategory: PassengerCategory;
      email: string;
    };

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
      passengerCategory: decoded.passengerCategory,
      email: decoded.email,
    };

    next();
  } catch (err) {
    next(AppError.unauthorized('TOKEN_INVALID'));
  }
};

/**
 * Middleware factory to authorize requests based on user roles.
 * Must be used AFTER the authenticate middleware.
 */
export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('INSUFFICIENT_ROLE'));
    }

    next();
  };
};

/**
 * Middleware to check if the authenticated user has an approved document.
 * Used for routes that require a specific passenger category (student, worker, etc.).
 * Must be used AFTER the authenticate middleware.
 */
export const requireVerifiedDocument: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    const { rows } = await db.query(
      `SELECT 1 FROM user_documents WHERE user_id = $1 AND status = 'APPROVED' LIMIT 1`,
      [req.user.userId],
    );

    if (rows.length === 0) {
      return next(AppError.forbidden('DOCUMENT_VERIFICATION_REQUIRED'));
    }

    next();
  } catch (error) {
    next(error);
  }
};
