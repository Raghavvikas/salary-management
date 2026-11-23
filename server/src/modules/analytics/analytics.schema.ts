import { z } from 'zod';
import { EMPLOYEE_STATUSES } from '../../domain/types.js';
import { enumListParam, idListParam } from '../../http/queryParsers.js';

export const analyticsFilterSchema = z.object({
  departmentIds: idListParam,
  countryIds: idListParam,
  jobLevelIds: idListParam,
  statuses: enumListParam(EMPLOYEE_STATUSES),
});

export const breakdownSchema = analyticsFilterSchema.extend({
  dimension: z.enum(['department', 'country', 'jobLevel']).default('department'),
});

export const distributionSchema = analyticsFilterSchema.extend({
  /** Bucket width in whole USD; 10,000 gives a readable 20-odd bar chart. */
  bucketUsdMajor: z.coerce.number().int().min(1_000).max(100_000).default(10_000),
});
