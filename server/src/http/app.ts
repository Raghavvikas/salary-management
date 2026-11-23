import cors from 'cors';
import express, { type Express } from 'express';
import { env } from '../config/env.js';
import { analyticsRoutes } from '../modules/analytics/analytics.routes.js';
import type { AnalyticsRepository } from '../modules/analytics/analytics.types.js';
import { employeeRoutes } from '../modules/employees/employee.routes.js';
import type { EmployeeService } from '../modules/employees/employee.service.js';
import { referenceRoutes } from '../modules/reference/reference.routes.js';
import type { ReferenceRepository } from '../modules/reference/reference.types.js';
import { errorHandler, HttpError } from './errors.js';

/**
 * Everything the HTTP layer needs is passed in. Nothing in here reaches for a
 * database client directly, which is what lets the whole API be tested against
 * in-memory repositories.
 *
 * An authentication middleware would mount here, in front of `/api`. It is left out
 * deliberately — see docs/requirements.md.
 */
export interface AppDependencies {
  employeeService: EmployeeService;
  analyticsRepository: AnalyticsRepository;
  referenceRepository: ReferenceRepository;
}

export function createApp(dependencies: AppDependencies): Express {
  const app = express();

  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/employees', employeeRoutes(dependencies.employeeService));
  app.use('/api/analytics', analyticsRoutes(dependencies.analyticsRepository));
  app.use('/api/reference', referenceRoutes(dependencies.referenceRepository));

  app.use((request) => {
    throw new HttpError(404, 'NOT_FOUND', `No route matches ${request.method} ${request.path}.`);
  });
  app.use(errorHandler);

  return app;
}
