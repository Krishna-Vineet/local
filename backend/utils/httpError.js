/**
 * Tiny typed HTTP error used by services so they can signal a status code
 * without importing Express. Routes translate it with `sendError`.
 *
 * `code` is a stable machine-readable string the booth client and CRM use
 * to distinguish "network failed" from "your organization is banned" etc.
 */
export class HttpError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message, code = 'BAD_REQUEST') => new HttpError(400, message, code);
export const unauthorized = (message, code = 'UNAUTHENTICATED') => new HttpError(401, message, code);
export const forbidden = (message, code = 'FORBIDDEN') => new HttpError(403, message, code);
export const notFound = (message, code = 'NOT_FOUND') => new HttpError(404, message, code);
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, message, code);

/** Consistent error body: { error, code, details? } */
export function sendError(res, error, fallbackMessage = 'Something went wrong.') {
  // Malformed ObjectId in a URL/body is a client error, not a server fault.
  if (error && error.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id.', code: 'INVALID_ID' });
  }
  const status = Number(error && error.status) || 500;
  const body = {
    error: (error && error.message) || fallbackMessage,
    code: (error && error.code) || (status === 500 ? 'INTERNAL' : 'ERROR'),
  };
  if (error && error.details) body.details = error.details;
  if (status >= 500) console.error('❌', body.error, error);
  return res.status(status).json(body);
}

/** Wrap async handlers so rejected promises reach Express' error handling. */
export const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch((error) => sendError(res, error));
