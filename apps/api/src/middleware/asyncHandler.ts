import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async Express handler so that rejected promises are
 * automatically forwarded to the next error-handling middleware.
 *
 * Express 5 already does this for route handlers, but this utility
 * is still valuable for custom middleware and as a defence-in-depth
 * pattern throughout the codebase.
 *
 * Usage:
 *   router.get('/foo', asyncHandler(async (req, res) => { … }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
