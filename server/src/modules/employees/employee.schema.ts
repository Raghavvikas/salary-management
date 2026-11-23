import { z } from 'zod';
import { CHANGE_REASONS, EMPLOYEE_STATUSES } from '../../domain/types.js';
import { enumListParam, idListParam } from '../../http/queryParsers.js';
import { EMPLOYEE_SORT_FIELDS } from './employee.types.js';

export const BAND_POSITIONS = ['BELOW_BAND', 'LOWER_HALF', 'UPPER_HALF', 'ABOVE_BAND'] as const;

export const employeeQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  departmentIds: idListParam,
  countryIds: idListParam,
  jobLevelIds: idListParam,
  statuses: enumListParam(EMPLOYEE_STATUSES),
  bandPositions: enumListParam(BAND_POSITIONS),
  page: z.coerce.number().int().min(1).default(1),
  // Capped so a stray `pageSize=100000` cannot ask Postgres for the whole org.
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  sortBy: z.enum(EMPLOYEE_SORT_FIELDS).default('name'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
});

export const employeeIdSchema = z.coerce.number().int().positive();

export const salaryChangeSchema = z.object({
  /** Sent in major units because that is what the HR manager types. */
  baseAmountMajor: z.number().positive().max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date, e.g. 2026-04-01'),
  changeReason: z.enum(CHANGE_REASONS),
  note: z.string().trim().max(500).optional(),
});

export type SalaryChangeBody = z.infer<typeof salaryChangeSchema>;
