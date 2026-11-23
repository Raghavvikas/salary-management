import { costToBandMinimum, histogram, salarySpread } from '../../src/domain/compensation.js';
import { groupPayGapRows } from '../../src/modules/analytics/analytics.aggregation.js';
import type {
  AnalyticsFilters,
  AnalyticsRepository,
  BreakdownDimension,
  BreakdownRow,
  DistributionBucket,
  PayGapRow,
  PayOverview,
} from '../../src/modules/analytics/analytics.types.js';
import type { EmployeeRecord } from '../../src/modules/employees/employee.types.js';
import { ORG } from './orgFixture.js';

/**
 * The same aggregates as the SQL repository, worked out with the domain functions.
 *
 * Having both implementations means the API tests check the shape and the rules of
 * the analytics endpoints without a database, and any disagreement between the two
 * shows up as a failing expectation rather than a surprise on the dashboard.
 */
export class InMemoryAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly employees: EmployeeRecord[] = ORG) {}

  async overview(filters: AnalyticsFilters): Promise<PayOverview> {
    const matches = this.matching(filters);
    if (matches.length === 0) {
      return {
        headcount: 0,
        annualPayrollUsd: 0,
        averageUsd: 0,
        p25Usd: 0,
        medianUsd: 0,
        p75Usd: 0,
        belowBandCount: 0,
        aboveBandCount: 0,
        costToFixBelowBandUsd: 0,
      };
    }

    const spread = salarySpread(matches.map((employee) => employee.currentSalary.amountUsd));
    return {
      headcount: spread.count,
      annualPayrollUsd: spread.totalUsd,
      averageUsd: spread.averageUsd,
      p25Usd: spread.p25Usd,
      medianUsd: spread.medianUsd,
      p75Usd: spread.p75Usd,
      belowBandCount: matches.filter(
        (employee) => employee.currentSalary.amountUsd < employee.jobLevel.bandMinUsd,
      ).length,
      aboveBandCount: matches.filter(
        (employee) => employee.currentSalary.amountUsd > employee.jobLevel.bandMaxUsd,
      ).length,
      costToFixBelowBandUsd: matches.reduce(
        (total, employee) =>
          total +
          costToBandMinimum(employee.currentSalary.amountUsd, {
            minUsd: employee.jobLevel.bandMinUsd,
            midUsd: employee.jobLevel.bandMidUsd,
            maxUsd: employee.jobLevel.bandMaxUsd,
          }),
        0,
      ),
    };
  }

  async breakdown(
    dimension: BreakdownDimension,
    filters: AnalyticsFilters,
  ): Promise<BreakdownRow[]> {
    const groups = new Map<number, EmployeeRecord[]>();
    for (const employee of this.matching(filters)) {
      const key = employee[dimension];
      groups.set(key.id, [...(groups.get(key.id) ?? []), employee]);
    }

    const rows = [...groups.values()].map((members) => {
      const first = members[0] as EmployeeRecord;
      const key = first[dimension];
      const spread = salarySpread(members.map((member) => member.currentSalary.amountUsd));
      const compaSum = members.reduce(
        (total, member) =>
          total + member.currentSalary.amountUsd / member.jobLevel.bandMidUsd,
        0,
      );
      return {
        key: { id: key.id, code: key.code, name: key.name },
        headcount: spread.count,
        totalUsd: spread.totalUsd,
        averageUsd: spread.averageUsd,
        p25Usd: spread.p25Usd,
        medianUsd: spread.medianUsd,
        p75Usd: spread.p75Usd,
        averageCompaRatio: Math.round((compaSum / members.length) * 1000) / 1000,
        rank: dimension === 'jobLevel' ? first.jobLevel.rank : 0,
      };
    });

    return rows
      .sort((a, b) =>
        dimension === 'jobLevel' ? a.rank - b.rank : a.key.name.localeCompare(b.key.name),
      )
      .map(({ rank: _rank, ...row }) => row);
  }

  async distribution(
    filters: AnalyticsFilters,
    bucketUsd: number,
  ): Promise<DistributionBucket[]> {
    return histogram(
      this.matching(filters).map((employee) => employee.currentSalary.amountUsd),
      bucketUsd,
    ).map((bucket) => ({ ...bucket }));
  }

  async payGapByLevel(filters: AnalyticsFilters): Promise<PayGapRow[]> {
    const groups = new Map<string, EmployeeRecord[]>();
    for (const employee of this.matching(filters)) {
      const key = `${employee.jobLevel.id}:${employee.gender}`;
      groups.set(key, [...(groups.get(key) ?? []), employee]);
    }

    return groupPayGapRows(
      [...groups.values()].map((members) => {
        const first = members[0] as EmployeeRecord;
        return {
          jobLevel: {
            id: first.jobLevel.id,
            code: first.jobLevel.code,
            name: first.jobLevel.name,
            rank: first.jobLevel.rank,
          },
          gender: first.gender,
          count: members.length,
          medianUsd: salarySpread(members.map((m) => m.currentSalary.amountUsd)).medianUsd,
        };
      }),
    );
  }

  private matching(filters: AnalyticsFilters): EmployeeRecord[] {
    return this.employees.filter((employee) => {
      if (filters.departmentIds?.length && !filters.departmentIds.includes(employee.department.id)) {
        return false;
      }
      if (filters.countryIds?.length && !filters.countryIds.includes(employee.country.id)) {
        return false;
      }
      if (filters.jobLevelIds?.length && !filters.jobLevelIds.includes(employee.jobLevel.id)) {
        return false;
      }
      if (filters.statuses?.length && !filters.statuses.includes(employee.status)) {
        return false;
      }
      return true;
    });
  }
}
