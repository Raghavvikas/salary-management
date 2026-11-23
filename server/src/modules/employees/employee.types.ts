/**
 * The contract between the API and everything behind it.
 *
 * Amounts are integers in minor units, dates are ISO calendar strings. The UI never
 * has to know how Prisma represents a BigInt or a `@db.Date`.
 */

import type { BandPosition } from '../../domain/compensation.js';
import type { ChangeReason, EmployeeStatus, Gender } from '../../domain/types.js';

export interface DepartmentRef {
  id: number;
  code: string;
  name: string;
}

export interface CountryRef extends DepartmentRef {
  currency: string;
  /** USD per one unit of `currency`, so the UI can explain any converted figure. */
  usdRate: number;
}

export interface JobLevelRef extends DepartmentRef {
  rank: number;
  bandMinUsd: number;
  bandMidUsd: number;
  bandMaxUsd: number;
}

export interface CurrentSalary {
  baseAmount: number;
  currency: string;
  amountUsd: number;
  effectiveFrom: string;
  changeReason: ChangeReason;
}

/** What the repository returns: facts only, nothing derived. */
export interface EmployeeRecord {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender;
  jobTitle: string;
  hireDate: string;
  status: EmployeeStatus;
  department: DepartmentRef;
  country: CountryRef;
  jobLevel: JobLevelRef;
  currentSalary: CurrentSalary;
}

/** What the API returns: facts plus the numbers the domain layer works out. */
export interface EmployeeSummary extends EmployeeRecord {
  compaRatio: number;
  bandPosition: BandPosition;
}

export interface SalaryHistoryEntry {
  id: number;
  baseAmount: number;
  currency: string;
  amountUsd: number;
  usdRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  changeReason: ChangeReason;
  note: string | null;
  /** Change against the record that preceded it, or null for the first one. */
  changePercent: number | null;
}

export interface ManagerRef {
  id: number;
  employeeCode: string;
  name: string;
}

export interface EmployeeDetail extends EmployeeSummary {
  manager: ManagerRef | null;
  salaryHistory: SalaryHistoryEntry[];
}

export const EMPLOYEE_SORT_FIELDS = [
  'name',
  'employeeCode',
  'salaryUsd',
  'compaRatio',
  'hireDate',
] as const;
export type EmployeeSortField = (typeof EMPLOYEE_SORT_FIELDS)[number];

export interface EmployeeQuery {
  search?: string;
  departmentIds?: number[];
  countryIds?: number[];
  jobLevelIds?: number[];
  statuses?: EmployeeStatus[];
  bandPositions?: BandPosition[];
  page: number;
  pageSize: number;
  sortBy: EmployeeSortField;
  sortDirection: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RecordSalaryChangeInput {
  employeeId: number;
  baseAmount: number;
  currency: string;
  amountUsd: number;
  usdRate: number;
  effectiveFrom: Date;
  changeReason: ChangeReason;
  note?: string;
}

/**
 * The seam the whole application is built around: the services depend on this, a
 * Prisma implementation backs the running app, and an in-memory one backs the tests.
 */
export interface EmployeeRepository {
  list(query: EmployeeQuery): Promise<Page<EmployeeRecord>>;
  findById(id: number): Promise<(EmployeeRecord & { manager: ManagerRef | null; salaryHistory: SalaryHistoryEntry[] }) | null>;
  /** Closes the current salary record and opens a new one, atomically. */
  recordSalaryChange(input: RecordSalaryChangeInput): Promise<void>;
}
