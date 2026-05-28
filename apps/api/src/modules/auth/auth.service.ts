import { PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  User,
  UserPublic,
  Wallet,
  UserDocument,
  DocumentStatus,
  PassengerCategory,
  UserRole,
} from '@transport/shared-types';
import { db } from '../../db';
import { cache } from '../../cache';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { RegisterDto, LoginDto } from './auth.validation';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface AuthResponse {
  user: UserPublic;
  accessToken: string;
  refreshToken: string;
}

interface RegisterResponse {
  user: UserPublic;
  wallet: Wallet;
}

interface JwtPayload {
  userId: string;
  role: UserRole;
  passengerCategory: PassengerCategory;
  email: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function stripPasswordHash(user: User): UserPublic {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ──────────────────────────────────────────────
// Service Implementation
// ──────────────────────────────────────────────

class AuthService {
  /**
   * Registers a new user and creates their wallet atomically.
   */
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const password_hash = await bcrypt.hash(dto.password, 12);

    return db.transaction(async (client: PoolClient) => {
      // 1. Create User
      const { rows: userRows } = await client.query<User>(
        `
        INSERT INTO users (email, phone, password_hash, role, passenger_category, full_name)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
          dto.email,
          dto.phone,
          password_hash,
          dto.role,
          dto.passenger_category ?? PassengerCategory.REGULAR,
          dto.full_name,
        ],
      );

      const user = userRows[0];
      if (!user) {
        throw AppError.conflict('Failed to create user');
      }

      // 2. Create Wallet
      const { rows: walletRows } = await client.query<Wallet>(
        `
        INSERT INTO wallets (user_id, balance, held_balance, currency)
        VALUES ($1, 0, 0, 'BDT')
        RETURNING *
        `,
        [user.id],
      );

      const wallet = walletRows[0];
      if (!wallet) {
        throw AppError.conflict('Failed to create wallet');
      }

      if (env.NODE_ENV !== 'production') {
        console.log('[AUTH] Verification email sent to:', dto.email);
      }

      return {
        user: stripPasswordHash(user),
        wallet,
      };
    });
  }

  /**
   * Authenticates a user and issues JWT tokens.
   */
  async login(dto: LoginDto, deviceInfo: Record<string, unknown> = {}): Promise<AuthResponse> {
    const { rows } = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [dto.email],
    );

    const user = rows[0];
    if (!user) {
      throw AppError.unauthorized('INVALID_CREDENTIALS');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.password_hash);
    if (!isValidPassword) {
      throw AppError.unauthorized('INVALID_CREDENTIALS');
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      passengerCategory: user.passenger_category,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
      subject: user.id,
    });

    const refreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
      subject: user.id,
    });

    const tokenHash = hashToken(refreshToken);

    // Decode to get the exact expiration date for the DB record
    const decodedRefresh = jwt.decode(refreshToken) as jwt.JwtPayload;
    const expiresAt = new Date((decodedRefresh.exp as number) * 1000);

    await db.query(
      `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)
      VALUES ($1, $2, $3, $4)
      `,
      [user.id, tokenHash, expiresAt.toISOString(), JSON.stringify(deviceInfo)],
    );

    return {
      user: stripPasswordHash(user),
      accessToken,
      refreshToken,
    };
  }

  /**
   * Issues a new token pair using a valid refresh token.
   */
  async refreshToken(
    incomingToken: string,
    deviceInfo: Record<string, unknown> = {},
  ): Promise<AuthResponse> {
    const decoded = jwt.decode(incomingToken) as jwt.JwtPayload | null;
    if (!decoded || !decoded.userId) {
      throw AppError.unauthorized('REFRESH_TOKEN_INVALID');
    }

    const userId = decoded.userId as string;

    const { rows: storedTokens } = await db.query<{ id: string; token_hash: string }>(
      `
      SELECT id, token_hash 
      FROM refresh_tokens 
      WHERE user_id = $1 
        AND revoked_at IS NULL 
        AND expires_at > NOW()
      `,
      [userId],
    );

    const incomingHash = hashToken(incomingToken);
    const incomingBuffer = Buffer.from(incomingHash, 'hex');

    let matchingTokenId: string | null = null;

    for (const record of storedTokens) {
      const storedBuffer = Buffer.from(record.token_hash, 'hex');
      if (
        storedBuffer.length === incomingBuffer.length &&
        crypto.timingSafeEqual(storedBuffer, incomingBuffer)
      ) {
        matchingTokenId = record.id;
        break;
      }
    }

    if (!matchingTokenId) {
      throw AppError.unauthorized('REFRESH_TOKEN_INVALID');
    }

    try {
      jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);
    } catch {
      throw AppError.unauthorized('REFRESH_TOKEN_INVALID');
    }

    // Revoke old token
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1',
      [matchingTokenId],
    );

    // Fetch user to generate new payload
    const { rows: userRows } = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [userId],
    );

    const user = userRows[0];
    if (!user) {
      throw AppError.unauthorized('USER_NOT_FOUND');
    }

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      passengerCategory: user.passenger_category,
      email: user.email,
    };

    const newAccessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
      subject: user.id,
    });

    const newRefreshToken = jwt.sign({ userId: user.id }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
      subject: user.id,
    });

    const newTokenHash = hashToken(newRefreshToken);
    const newDecodedRefresh = jwt.decode(newRefreshToken) as jwt.JwtPayload;
    const newExpiresAt = new Date((newDecodedRefresh.exp as number) * 1000);

    await db.query(
      `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, device_info)
      VALUES ($1, $2, $3, $4)
      `,
      [user.id, newTokenHash, newExpiresAt.toISOString(), JSON.stringify(deviceInfo)],
    );

    return {
      user: stripPasswordHash(user),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revokes a specific refresh token.
   */
  async logout(userId: string, token: string): Promise<void> {
    const tokenHash = hashToken(token);

    await db.query(
      `
      UPDATE refresh_tokens 
      SET revoked_at = NOW() 
      WHERE user_id = $1 AND token_hash = $2
      `,
      [userId, tokenHash],
    );
  }

  /**
   * Persists an uploaded document record.
   */
  async uploadDocument(
    userId: string,
    file: Express.Multer.File,
    documentType: string,
  ): Promise<UserDocument> {
    const relativePath = `/uploads/${file.filename}`;

    const { rows } = await db.query<UserDocument>(
      `
      INSERT INTO user_documents (user_id, document_type, document_url, status)
      VALUES ($1, $2, $3, 'PENDING')
      RETURNING *
      `,
      [userId, documentType, relativePath],
    );

    return rows[0] as UserDocument;
  }

  /**
   * Approves or rejects a document and updates user category if approved.
   */
  async verifyDocument(
    documentId: string,
    managerId: string,
    approve: boolean,
  ): Promise<UserDocument> {
    return db.transaction(async (client) => {
      const status = approve ? DocumentStatus.APPROVED : DocumentStatus.REJECTED;

      const { rows: docRows } = await client.query<UserDocument>(
        `
        UPDATE user_documents
        SET status = $1, verified_by = $2, verified_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [status, managerId, documentId],
      );

      const document = docRows[0];
      if (!document) {
        throw AppError.notFound('Document not found');
      }

      if (approve) {
        let category: PassengerCategory;

        switch (document.document_type) {
          case 'student_id':
            category = PassengerCategory.STUDENT;
            break;
          case 'employee_card':
            category = PassengerCategory.WORKER;
            break;
          case 'govt_credential':
            category = PassengerCategory.GOVT_PERSONNEL;
            break;
          default:
            category = PassengerCategory.REGULAR;
        }

        await client.query(
          'UPDATE users SET passenger_category = $1 WHERE id = $2',
          [category, document.user_id],
        );
      }

      return document;
    });
  }

  /**
   * Retrieves a user's uploaded documents.
   */
  async getMyDocuments(userId: string): Promise<UserDocument[]> {
    const { rows } = await db.query<UserDocument>(
      `
      SELECT * FROM user_documents 
      WHERE user_id = $1 
      ORDER BY created_at DESC
      `,
      [userId],
    );

    return rows;
  }
}

export const authService = new AuthService();
