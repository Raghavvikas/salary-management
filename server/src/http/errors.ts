import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MoneyError } from '../domain/money.js';
import { CompensationError } from '../domain/compensation.js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (resource: string, id: string | number): HttpError =>
  new HttpError(404, 'NOT_FOUND', `${resource} ${id} was not found.`);

export const unprocessable = (message: string, details?: unknown): HttpError =>
  new HttpError(422, 'UNPROCESSABLE', message, details);

/**
 * One place that turns anything thrown inside the app into a JSON body with a
 * stable shape: { error: { code, message, details? } }. The UI depends on this
 * shape, so it is worth keeping it in a single function.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'The request could not be understood.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof MoneyError || error instanceof CompensationError) {
    response.status(400).json({
      error: { code: 'INVALID_AMOUNT', message: error.message },
    });
    return;
  }

  console.error('Unhandled error', error);
  response.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong on our side.' },
  });
}
