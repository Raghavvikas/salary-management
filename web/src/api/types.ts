/**
 * Mirrors the server contract in `server/src/modules/**\/*.types.ts`.
 *
 * Kept as a hand written copy rather than a shared package: the API is small, and
 * one file the UI owns is easier to read than a build step. Amounts are integers in
 * minor units, exactly as the API sends them.
 */

export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'UNDISCLOSED';
export type BandPosition = 'BELOW_BAND' | 'LOWER_HALF' | 'UPPER_HALF' | 'ABOVE_BAND';
export type ChangeReason =
  | 'HIRE'
  | 'MERIT_INCREASE'
  | 'PROMOTION'
  | 'MARKET_ADJUSTMENT'
  | 'CORRECTION'
  | 'ROLE_CHANGE';

export interface Ref {
  id: number;
  code: string;
  name: string;
}

export interface CountryRef extends Ref {
  currency: string;
  usdRate: number;
  marketIndex: number;
}

export interface JobLevelRef extends Ref {
  rank: number;
  bandMinUsd: number;
  bandMidUsd: number;
  bandMaxUsd: number;
}

export interface Band {
  minUsd: number;
  midUsd: number;
  maxUsd: number;
}

export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender;
  jobTitle: string;
  hireDate: string;
  status: EmployeeStatus;
  department: Ref;
  country: CountryRef;
  jobLevel: JobLevelRef;
  currentSalary: {
    baseAmount: number;
    currency: string;
    amountUsd: number;
    effectiveFrom: string;
    changeReason: ChangeReason;
  };
  band: Band;
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
  changePercent: number | null;
}

export interface EmployeeDetail extends EmployeeSummary {
  manager: { id: number; employeeCode: string; name: string } | null;
  salaryHistory: SalaryHistoryEntry[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReferenceData {
  departments: Ref[];
  countries: CountryRef[];
  jobLevels: JobLevelRef[];
}

export interface PayOverview {
  headcount: number;
  annualPayrollUsd: number;
  averageUsd: number;
  p25Usd: number;
  medianUsd: number;
  p75Usd: number;
  belowBandCount: number;
  aboveBandCount: number;
  costToFixBelowBandUsd: number;
}

export type BreakdownDimension = 'department' | 'country' | 'jobLevel';

export interface BreakdownRow {
  key: Ref;
  headcount: number;
  totalUsd: number;
  averageUsd: number;
  p25Usd: number;
  medianUsd: number;
  p75Usd: number;
  averageCompaRatio: number;
}

export interface DistributionBucket {
  fromUsd: number;
  toUsd: number;
  count: number;
}

export interface PayGapRow {
  jobLevel: Ref & { rank: number };
  medianByGender: Partial<Record<Gender, number>>;
  countByGender: Partial<Record<Gender, number>>;
  gapPercent: number | null;
}

export interface EmployeeFilters {
  search?: string;
  departmentIds?: number[];
  countryIds?: number[];
  jobLevelIds?: number[];
  statuses?: EmployeeStatus[];
  bandPositions?: BandPosition[];
}
