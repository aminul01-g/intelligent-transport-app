import { Router } from 'express';
import { authService } from './auth.service';
import { registerSchema, loginSchema, verifyDocumentSchema } from './auth.validation';
import { authenticate, authorize } from './auth.middleware';
import { documentUpload } from '../../config/multer';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AppError } from '../../errors/AppError';
import { UserRole } from '@transport/shared-types';

export const authRouter = Router();

// ──────────────────────────────────────────────
// Registration & Login
// ──────────────────────────────────────────────

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const dto = registerSchema.parse(req.body);
    const result = await authService.register(dto);

    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const dto = loginSchema.parse(req.body);
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    const result = await authService.login(dto, deviceInfo);

    res.json({
      success: true,
      data: result,
    });
  }),
);

// ──────────────────────────────────────────────
// Token Management
// ──────────────────────────────────────────────

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw AppError.badRequest('refreshToken is required');
    }

    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    const result = await authService.refreshToken(refreshToken, deviceInfo);

    res.json({
      success: true,
      data: result,
    });
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw AppError.badRequest('refreshToken is required');
    }

    // req.user is guaranteed to exist by authenticate middleware
    await authService.logout(req.user!.userId, refreshToken);

    res.json({
      success: true,
      data: null,
    });
  }),
);

// ──────────────────────────────────────────────
// Documents
// ──────────────────────────────────────────────

authRouter.post(
  '/documents/upload',
  authenticate,
  documentUpload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('No document file provided');
    }

    const documentType = req.body.document_type;
    if (!documentType || typeof documentType !== 'string') {
      throw AppError.badRequest('document_type string field is required');
    }

    const document = await authService.uploadDocument(
      req.user!.userId,
      req.file,
      documentType,
    );

    res.status(201).json({
      success: true,
      data: document,
    });
  }),
);

authRouter.get(
  '/documents/my',
  authenticate,
  asyncHandler(async (req, res) => {
    const documents = await authService.getMyDocuments(req.user!.userId);

    res.json({
      success: true,
      data: documents,
    });
  }),
);

authRouter.post(
  '/documents/:id/verify',
  authenticate,
  authorize(UserRole.MANAGER, UserRole.COMPANY_LEAD),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw AppError.badRequest('Document ID is required');
    }
    const dto = verifyDocumentSchema.parse(req.body);

    const document = await authService.verifyDocument(
      id as string,
      req.user!.userId,
      dto.approve,
    );

    res.json({
      success: true,
      data: document,
    });
  }),
);
