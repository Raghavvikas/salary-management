import type { EmployeeStatus, Gender } from '../../domain/types.js';

/**
 * Analytics answer one question: how does this organisation pay people? Every
 * figure is in USD minor units so departments in different currencies can be put
 * on the same axis.
 */

export interface AnalyticsFilters {
  departmentIds?: number[];
  countryIds?: number[];
  jobLevelIds?: number[];
  statuses?: EmployeeStatus[];
}

export interface PayOverview {
  headcount: number;
  /** Annual base pay for everyone in scope, added up. */
  annualPayrollUsd: number;
  averageUsd: number;
  p25Usd: number;
  medianUsd: number;
  p75Usd: number;
  belowBandCount: number;
  aboveBandCount: number;
  /** What it would cost to lift everyone below their band up to the minimum. */
  costToFixBelowBandUsd: number;
}

export type BreakdownDimension = 'department' | 'country' | 'jobLevel';

export interface BreakdownRow {
  key: { id: number; code: string; name: string };
  headcount: number;
  totalUsd: number;
  averageUsd: number;
  p25Usd: number;
  medianUsd: number;
  p75Usd: number;
  /** Average of each person's salary over their own band midpoint. */
  averageCompaRatio: number;
}

export interface DistributionBucket {
  fromUsd: number;
  toUsd: number;
  count: number;
}

export interface PayGapRow {
  jobLevel: { id: number; code: string; name: string; rank: number };
  medianByGender: Partial<Record<Gender, number>>;
  countByGender: Partial<Record<Gender, number>>;
  /** Female median against male median, as a percentage. Null if either is absent. */
  gapPercent: number | null;
}

export interface AnalyticsRepository {
  overview(filters: AnalyticsFilters): Promise<PayOverview>;
  breakdown(dimension: BreakdownDimension, filters: AnalyticsFilters): Promise<BreakdownRow[]>;
  distribution(filters: AnalyticsFilters, bucketUsd: number): Promise<DistributionBucket[]>;
  payGapByLevel(filters: AnalyticsFilters): Promise<PayGapRow[]>;
}
