/**
 * Operational error class for the transport API.
 *
 * All expected/known error conditions (bad input, auth failures,
 * missing resources) should throw an AppError so the centralised
 * error handler can return a structured JSON response.
 *
 * Unexpected/programmer errors are NOT AppErrors and will be
 * treated as 500 Internal Server Error with a generic message.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Maintain proper prototype chain for instanceof checks.
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  // ── Factory helpers ──────────────────────────

  static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(message, 401, 'AUTH_INVALID');
  }

  static forbidden(message = 'Insufficient permissions'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static badRequest(message = 'Invalid request'): AppError {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static conflict(message = 'Resource conflict'): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }
}
