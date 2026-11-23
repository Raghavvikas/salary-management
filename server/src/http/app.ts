import cors from 'cors';
import express, { type Express } from 'express';
import { env } from '../config/env.js';
import { errorHandler, HttpError } from './errors.js';

/**
 * Everything the HTTP layer needs is passed in. Nothing in here reaches for a
 * database client directly, which is what lets the whole API be tested against
 * in-memory repositories.
 */
export interface AppDependencies {
  /** Injected so "today" is never read from the wall clock inside a request. */
  now?: () => Date;
}

export function createApp(_dependencies: AppDependencies = {}): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use((request) => {
    throw new HttpError(404, 'NOT_FOUND', `No route matches ${request.method} ${request.path}.`);
  });
  app.use(errorHandler);

  return app;
}
