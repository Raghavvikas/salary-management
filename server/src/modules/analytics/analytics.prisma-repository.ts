import { Prisma, type PrismaClient } from '@prisma/client';
import type { Gender } from '../../domain/types.js';
import { fillGaps, groupPayGapRows } from './analytics.aggregation.js';
import type {
  AnalyticsFilters,
  AnalyticsRepository,
  BreakdownDimension,
  BreakdownRow,
  DistributionBucket,
  PayGapRow,
  PayOverview,
} from './analytics.types.js';

/**
 * Every figure on the dashboard is computed by Postgres.
 *
 * The alternative — selecting 10,000 current salaries and reducing them in Node —
 * was measured at roughly an order of magnitude slower and would grow linearly with
 * headcount, while these queries stay on indexed joins and a single aggregate pass.
 */
export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async overview(filters: AnalyticsFilters): Promise<PayOverview> {
    const [row] = await this.prisma.$queryRaw<OverviewRow[]>(Prisma.sql`
      SELECT
        COUNT(*)::int AS headcount,
        COALESCE(SUM(s."amountUsd"), 0)::bigint AS "annualPayrollUsd",
        COALESCE(AVG(s."amountUsd"), 0) AS "averageUsd",
        COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY s."amountUsd"), 0) AS "p25Usd",
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s."amountUsd"), 0) AS "medianUsd",
        COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY s."amountUsd"), 0) AS "p75Usd",
        COUNT(*) FILTER (WHERE s."amountUsd" < l."bandMinUsd" * c."marketIndex")::int AS "belowBandCount",
        COUNT(*) FILTER (WHERE s."amountUsd" > l."bandMaxUsd" * c."marketIndex")::int AS "aboveBandCount",
        COALESCE(SUM(GREATEST(l."bandMinUsd" * c."marketIndex" - s."amountUsd", 0)), 0)::bigint AS "costToFixBelowBandUsd"
      FROM "Employee" e
      JOIN "JobLevel" l ON l.id = e."jobLevelId"
      JOIN "Country" c ON c.id = e."countryId"
      JOIN "SalaryRecord" s ON s."employeeId" = e.id AND s."effectiveTo" IS NULL
      WHERE ${where(filters)}
    `);

    const result = row as OverviewRow;
    return {
      headcount: result.headcount,
      annualPayrollUsd: Number(result.annualPayrollUsd),
      averageUsd: Math.round(Number(result.averageUsd)),
      p25Usd: Math.round(Number(result.p25Usd)),
      medianUsd: Math.round(Number(result.medianUsd)),
      p75Usd: Math.round(Number(result.p75Usd)),
      belowBandCount: result.belowBandCount,
      aboveBandCount: result.aboveBandCount,
      costToFixBelowBandUsd: Number(result.costToFixBelowBandUsd),
    };
  }

  async breakdown(
    dimension: BreakdownDimension,
    filters: AnalyticsFilters,
  ): Promise<BreakdownRow[]> {
    const table = {
      department: Prisma.sql`"Department"`,
      country: Prisma.sql`"Country"`,
      jobLevel: Prisma.sql`"JobLevel"`,
    }[dimension];
    const foreignKey = {
      department: Prisma.sql`e."departmentId"`,
      country: Prisma.sql`e."countryId"`,
      jobLevel: Prisma.sql`e."jobLevelId"`,
    }[dimension];
    const ordering = dimension === 'jobLevel' ? Prisma.sql`g.rank` : Prisma.sql`g.name`;

    const rows = await this.prisma.$queryRaw<BreakdownSqlRow[]>(Prisma.sql`
      SELECT
        g.id, g.code, g.name,
        COUNT(*)::int AS headcount,
        SUM(s."amountUsd")::bigint AS "totalUsd",
        AVG(s."amountUsd") AS "averageUsd",
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY s."amountUsd") AS "p25Usd",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s."amountUsd") AS "medianUsd",
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY s."amountUsd") AS "p75Usd",
        AVG(s."amountUsd"::numeric / (l."bandMidUsd" * c."marketIndex")) AS "averageCompaRatio"
      FROM "Employee" e
      JOIN ${table} g ON g.id = ${foreignKey}
      JOIN "JobLevel" l ON l.id = e."jobLevelId"
      JOIN "Country" c ON c.id = e."countryId"
      JOIN "SalaryRecord" s ON s."employeeId" = e.id AND s."effectiveTo" IS NULL
      WHERE ${where(filters)}
      GROUP BY g.id, g.code, g.name${dimension === 'jobLevel' ? Prisma.sql`, g.rank` : Prisma.empty}
      ORDER BY ${ordering}
    `);

    return rows.map((row) => ({
      key: { id: row.id, code: row.code, name: row.name },
      headcount: row.headcount,
      totalUsd: Number(row.totalUsd),
      averageUsd: Math.round(Number(row.averageUsd)),
      p25Usd: Math.round(Number(row.p25Usd)),
      medianUsd: Math.round(Number(row.medianUsd)),
      p75Usd: Math.round(Number(row.p75Usd)),
      averageCompaRatio: Math.round(Number(row.averageCompaRatio) * 1000) / 1000,
    }));
  }

  async distribution(
    filters: AnalyticsFilters,
    bucketUsd: number,
  ): Promise<DistributionBucket[]> {
    const rows = await this.prisma.$queryRaw<DistributionSqlRow[]>(Prisma.sql`
      SELECT
        (FLOOR(s."amountUsd" / ${bucketUsd}) * ${bucketUsd})::bigint AS "fromUsd",
        COUNT(*)::int AS count
      FROM "Employee" e
      JOIN "JobLevel" l ON l.id = e."jobLevelId"
      JOIN "Country" c ON c.id = e."countryId"
      JOIN "SalaryRecord" s ON s."employeeId" = e.id AND s."effectiveTo" IS NULL
      WHERE ${where(filters)}
      GROUP BY 1
      ORDER BY 1
    `);

    return fillGaps(
      rows.map((row) => ({
        fromUsd: Number(row.fromUsd),
        toUsd: Number(row.fromUsd) + bucketUsd,
        count: row.count,
      })),
      bucketUsd,
    );
  }

  async payGapByLevel(filters: AnalyticsFilters): Promise<PayGapRow[]> {
    const rows = await this.prisma.$queryRaw<PayGapSqlRow[]>(Prisma.sql`
      SELECT
        l.id, l.code, l.name, l.rank,
        e.gender::text AS gender,
        COUNT(*)::int AS count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s."amountUsd") AS "medianUsd"
      FROM "Employee" e
      JOIN "JobLevel" l ON l.id = e."jobLevelId"
      JOIN "Country" c ON c.id = e."countryId"
      JOIN "SalaryRecord" s ON s."employeeId" = e.id AND s."effectiveTo" IS NULL
      WHERE ${where(filters)}
      GROUP BY l.id, l.code, l.name, l.rank, e.gender
      ORDER BY l.rank
    `);

    return groupPayGapRows(
      rows.map((row) => ({
        jobLevel: { id: row.id, code: row.code, name: row.name, rank: row.rank },
        gender: row.gender as Gender,
        count: row.count,
        medianUsd: Math.round(Number(row.medianUsd)),
      })),
    );
  }
}

interface OverviewRow {
  headcount: number;
  annualPayrollUsd: bigint;
  averageUsd: Prisma.Decimal;
  p25Usd: Prisma.Decimal;
  medianUsd: Prisma.Decimal;
  p75Usd: Prisma.Decimal;
  belowBandCount: number;
  aboveBandCount: number;
  costToFixBelowBandUsd: bigint;
}

interface BreakdownSqlRow {
  id: number;
  code: string;
  name: string;
  headcount: number;
  totalUsd: bigint;
  averageUsd: Prisma.Decimal;
  p25Usd: Prisma.Decimal;
  medianUsd: Prisma.Decimal;
  p75Usd: Prisma.Decimal;
  averageCompaRatio: Prisma.Decimal;
}

interface DistributionSqlRow {
  fromUsd: bigint;
  count: number;
}

interface PayGapSqlRow {
  id: number;
  code: string;
  name: string;
  rank: number;
  gender: string;
  count: number;
  medianUsd: Prisma.Decimal;
}

function where(filters: AnalyticsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (filters.departmentIds?.length) {
    conditions.push(Prisma.sql`e."departmentId" IN (${Prisma.join(filters.departmentIds)})`);
  }
  if (filters.countryIds?.length) {
    conditions.push(Prisma.sql`e."countryId" IN (${Prisma.join(filters.countryIds)})`);
  }
  if (filters.jobLevelIds?.length) {
    conditions.push(Prisma.sql`e."jobLevelId" IN (${Prisma.join(filters.jobLevelIds)})`);
  }
  if (filters.statuses?.length) {
    conditions.push(Prisma.sql`e.status::text IN (${Prisma.join(filters.statuses)})`);
  }
  return Prisma.join(conditions, ' AND ');
}
