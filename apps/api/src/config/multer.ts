import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request } from 'express';
import { env } from './env';
import { AppError } from '../errors/AppError';

// ──────────────────────────────────────────────
// Allowed MIME types
// ──────────────────────────────────────────────

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

// ──────────────────────────────────────────────
// Filename sanitiser
// Replaces any character that isn't alphanumeric, a dot, or a hyphen
// with an underscore to prevent path traversal and shell injection.
// ──────────────────────────────────────────────

function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-]/g, '_');
}

// ──────────────────────────────────────────────
// Ensure upload directory exists at startup
// ──────────────────────────────────────────────

const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

// ──────────────────────────────────────────────
// Storage engine
// ──────────────────────────────────────────────

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },

  filename(req: Request, file, cb) {
    // req.user is populated by the authenticate middleware which runs
    // before multer in every upload route.
    const userId = req.user?.userId ?? 'unknown';
    const sanitised = sanitiseFilename(file.originalname);
    const filename = `${userId}_${Date.now()}_${sanitised}`;
    cb(null, filename);
  },
});

// ──────────────────────────────────────────────
// File filter — reject everything outside the whitelist
// ──────────────────────────────────────────────

const fileFilter: multer.Options['fileFilter'] = (
  _req,
  file,
  cb,
) => {
  if (ALLOWED_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    // Passing an Error to cb with false rejects the file and
    // forwards the error to the Express error handler.
    cb(
      AppError.badRequest(
        `INVALID_FILE_TYPE: only JPEG, PNG, and PDF are allowed (received ${file.mimetype})`,
      ),
    );
  }
};

// ──────────────────────────────────────────────
// Multer instance
// ──────────────────────────────────────────────

/**
 * Pre-configured multer middleware for document uploads.
 *
 * - Saves files to env.UPLOAD_DIR (default: ./uploads)
 * - Accepts only image/jpeg, image/png, application/pdf
 * - Rejects files larger than 5 MB
 * - Filename: {userId}_{timestamp}_{sanitisedOriginalName}
 *
 * IMPORTANT: authenticate middleware must run before this in the route chain
 * so that req.user.userId is available for the filename.
 *
 * TODO: Replace diskStorage with S3 upload in production.
 */
export const documentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});
