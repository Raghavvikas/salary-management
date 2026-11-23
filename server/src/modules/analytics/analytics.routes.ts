import { Router } from 'express';
import { MINOR_UNITS_PER_MAJOR } from '../../domain/money.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import type { AnalyticsRepository } from './analytics.types.js';
import {
  analyticsFilterSchema,
  breakdownSchema,
  distributionSchema,
} from './analytics.schema.js';

/**
 * Analytics are read-only aggregates, so the repository is used directly — there is
 * no use case here for a service layer to hold.
 */
export function analyticsRoutes(repository: AnalyticsRepository): Router {
  const router = Router();

  router.get(
    '/overview',
    asyncHandler(async (request, response) => {
      const filters = analyticsFilterSchema.parse(request.query);
      response.json(await repository.overview(filters));
    }),
  );

  router.get(
    '/breakdown',
    asyncHandler(async (request, response) => {
      const { dimension, ...filters } = breakdownSchema.parse(request.query);
      response.json({ dimension, rows: await repository.breakdown(dimension, filters) });
    }),
  );

  router.get(
    '/distribution',
    asyncHandler(async (request, response) => {
      const { bucketUsdMajor, ...filters } = distributionSchema.parse(request.query);
      const buckets = await repository.distribution(
        filters,
        bucketUsdMajor * MINOR_UNITS_PER_MAJOR,
      );
      response.json({ bucketUsd: bucketUsdMajor * MINOR_UNITS_PER_MAJOR, buckets });
    }),
  );

  router.get(
    '/pay-gap',
    asyncHandler(async (request, response) => {
      const filters = analyticsFilterSchema.parse(request.query);
      response.json({ rows: await repository.payGapByLevel(filters) });
    }),
  );

  return router;
}
