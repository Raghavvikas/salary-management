import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not forward rejected promises to the error middleware, so every
 * async route is wrapped once here rather than carrying its own try/catch.
 */
export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (request, response, next) => {
    handler(request, response, next).catch(next);
  };
}
