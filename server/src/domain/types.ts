/**
 * Domain vocabulary shared by the pure modules, the API and the UI contract.
 *
 * These mirror the Prisma enums by hand on purpose: the domain layer stays free of
 * generated code, and a schema change that is not reflected here fails to compile
 * at the repository boundary where the two meet.
 */

export const CHANGE_REASONS = [
  'HIRE',
  'MERIT_INCREASE',
  'PROMOTION',
  'MARKET_ADJUSTMENT',
  'CORRECTION',
  'ROLE_CHANGE',
] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

export const EMPLOYEE_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'] as const;
export type Gender = (typeof GENDERS)[number];
