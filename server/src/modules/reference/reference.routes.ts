import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import type { ReferenceRepository } from './reference.types.js';

export function referenceRoutes(repository: ReferenceRepository): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_request, response) => {
      response.json(await repository.all());
    }),
  );

  return router;
}
