import { Router } from 'express';
import { fromMajor } from '../../domain/money.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import type { EmployeeService } from './employee.service.js';
import {
  employeeIdSchema,
  employeeQuerySchema,
  salaryChangeSchema,
} from './employee.schema.js';

export function employeeRoutes(service: EmployeeService): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (request, response) => {
      const query = employeeQuerySchema.parse(request.query);
      response.json(await service.list(query));
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (request, response) => {
      const id = employeeIdSchema.parse(request.params.id);
      response.json(await service.get(id));
    }),
  );

  router.post(
    '/:id/salary',
    asyncHandler(async (request, response) => {
      const id = employeeIdSchema.parse(request.params.id);
      const body = salaryChangeSchema.parse(request.body);
      const updated = await service.changeSalary(id, {
        baseAmount: fromMajor(body.baseAmountMajor, body.currency).amountMinor,
        currency: body.currency,
        effectiveFrom: new Date(`${body.effectiveFrom}T00:00:00Z`),
        changeReason: body.changeReason,
        note: body.note,
      });
      response.status(201).json(updated);
    }),
  );

  return router;
}
