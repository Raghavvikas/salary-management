import { Prisma, type PrismaClient } from '@prisma/client';
import { percentageChange, money } from '../../domain/money.js';
import type { BandPosition } from '../../domain/compensation.js';
import type {
  EmployeeQuery,
  EmployeeRecord,
  EmployeeRepository,
  ManagerRef,
  Page,
  RecordSalaryChangeInput,
  SalaryHistoryEntry,
} from './employee.types.js';
import type { ChangeReason, EmployeeStatus, Gender } from '../../domain/types.js';

/**
 * The only place in the application that knows SQL.
 *
 * The directory query is written by hand rather than through the Prisma query
 * builder for two reasons: it has to join only the *current* salary record, and it
 * has to compare a salary against band columns on another table, which the builder
 * cannot express. Writing it out also lets the row count ride along on the same
 * round trip via `count(*) OVER ()`.
 */
export class PrismaEmployeeRepository implements EmployeeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: EmployeeQuery): Promise<Page<EmployeeRecord>> {
    const conditions: Prisma.Sql[] = [Prisma.sql`s."effectiveTo" IS NULL`];

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        Prisma.sql`(e."firstName" ILIKE ${term} OR e."lastName" ILIKE ${term} OR e."email" ILIKE ${term} OR e."employeeCode" ILIKE ${term})`,
      );
    }
    pushIdFilter(conditions, Prisma.sql`e."departmentId"`, query.departmentIds);
    pushIdFilter(conditions, Prisma.sql`e."countryId"`, query.countryIds);
    pushIdFilter(conditions, Prisma.sql`e."jobLevelId"`, query.jobLevelIds);

    if (query.statuses?.length) {
      conditions.push(
        Prisma.sql`e."status"::text IN (${Prisma.join(query.statuses)})`,
      );
    }
    if (query.bandPositions?.length) {
      conditions.push(
        Prisma.sql`(${Prisma.join(query.bandPositions.map(bandCondition), ' OR ')})`,
      );
    }

    const offset = (query.page - 1) * query.pageSize;
    const rows = await this.prisma.$queryRaw<DirectoryRow[]>(Prisma.sql`
      SELECT
        e.id, e."employeeCode", e."firstName", e."lastName", e.email, e.gender::text AS gender,
        e."jobTitle", e."hireDate", e.status::text AS status,
        d.id AS "departmentId", d.code AS "departmentCode", d.name AS "departmentName",
        c.id AS "countryId", c.code AS "countryCode", c.name AS "countryName", c.currency, c."usdRate",
        l.id AS "jobLevelId", l.code AS "jobLevelCode", l.name AS "jobLevelName", l.rank,
        l."bandMinUsd", l."bandMidUsd", l."bandMaxUsd",
        s."baseAmount", s."amountUsd", s."effectiveFrom", s."changeReason"::text AS "changeReason",
        COUNT(*) OVER () AS "totalCount"
      FROM "Employee" e
      JOIN "Department" d ON d.id = e."departmentId"
      JOIN "Country" c ON c.id = e."countryId"
      JOIN "JobLevel" l ON l.id = e."jobLevelId"
      JOIN "SalaryRecord" s ON s."employeeId" = e.id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY ${orderBy(query)}
      LIMIT ${query.pageSize} OFFSET ${offset}
    `);

    return {
      items: rows.map(toEmployeeRecord),
      total: rows.length > 0 ? Number((rows[0] as DirectoryRow).totalCount) : 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        department: true,
        country: true,
        jobLevel: true,
        manager: { select: { id: true, employeeCode: true, firstName: true, lastName: true } },
        salaryRecords: { orderBy: [{ effectiveFrom: 'desc' }, { id: 'desc' }] },
      },
    });
    if (!employee) return null;

    const current = employee.salaryRecords.find((record) => record.effectiveTo === null);
    if (!current) {
      throw new Error(`Employee ${id} has no current salary record.`);
    }

    const manager: ManagerRef | null = employee.manager
      ? {
          id: employee.manager.id,
          employeeCode: employee.manager.employeeCode,
          name: `${employee.manager.firstName} ${employee.manager.lastName}`,
        }
      : null;

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      gender: employee.gender as Gender,
      jobTitle: employee.jobTitle,
      hireDate: toIsoDate(employee.hireDate),
      status: employee.status as EmployeeStatus,
      department: {
        id: employee.department.id,
        code: employee.department.code,
        name: employee.department.name,
      },
      country: {
        id: employee.country.id,
        code: employee.country.code,
        name: employee.country.name,
        currency: employee.country.currency,
        usdRate: Number(employee.country.usdRate),
      },
      jobLevel: {
        id: employee.jobLevel.id,
        code: employee.jobLevel.code,
        name: employee.jobLevel.name,
        rank: employee.jobLevel.rank,
        bandMinUsd: Number(employee.jobLevel.bandMinUsd),
        bandMidUsd: Number(employee.jobLevel.bandMidUsd),
        bandMaxUsd: Number(employee.jobLevel.bandMaxUsd),
      },
      currentSalary: {
        baseAmount: Number(current.baseAmount),
        currency: current.currency,
        amountUsd: Number(current.amountUsd),
        effectiveFrom: toIsoDate(current.effectiveFrom),
        changeReason: current.changeReason as ChangeReason,
      },
      manager,
      salaryHistory: toSalaryHistory(employee.salaryRecords),
    };
  }

  async recordSalaryChange(input: RecordSalaryChangeInput): Promise<void> {
    // One transaction: the old record is closed the day before the new one starts,
    // so the history never has a gap and never has an overlap.
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.salaryRecord.findFirst({
        where: { employeeId: input.employeeId, effectiveTo: null },
      });
      if (!current) {
        throw new Error(`Employee ${input.employeeId} has no current salary record.`);
      }

      await tx.salaryRecord.update({
        where: { id: current.id },
        data: { effectiveTo: previousDay(input.effectiveFrom) },
      });

      await tx.salaryRecord.create({
        data: {
          employeeId: input.employeeId,
          baseAmount: BigInt(input.baseAmount),
          currency: input.currency,
          amountUsd: BigInt(input.amountUsd),
          usdRate: input.usdRate.toFixed(6),
          effectiveFrom: input.effectiveFrom,
          effectiveTo: null,
          changeReason: input.changeReason,
          note: input.note ?? null,
        },
      });
    });
  }
}

interface DirectoryRow {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  jobTitle: string;
  hireDate: Date;
  status: string;
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  countryId: number;
  countryCode: string;
  countryName: string;
  currency: string;
  usdRate: Prisma.Decimal;
  jobLevelId: number;
  jobLevelCode: string;
  jobLevelName: string;
  rank: number;
  bandMinUsd: bigint;
  bandMidUsd: bigint;
  bandMaxUsd: bigint;
  baseAmount: bigint;
  amountUsd: bigint;
  effectiveFrom: Date;
  changeReason: string;
  totalCount: bigint;
}

function toEmployeeRecord(row: DirectoryRow): EmployeeRecord {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    gender: row.gender as Gender,
    jobTitle: row.jobTitle,
    hireDate: toIsoDate(row.hireDate),
    status: row.status as EmployeeStatus,
    department: { id: row.departmentId, code: row.departmentCode, name: row.departmentName },
    country: {
      id: row.countryId,
      code: row.countryCode,
      name: row.countryName,
      currency: row.currency,
      usdRate: Number(row.usdRate),
    },
    jobLevel: {
      id: row.jobLevelId,
      code: row.jobLevelCode,
      name: row.jobLevelName,
      rank: row.rank,
      bandMinUsd: Number(row.bandMinUsd),
      bandMidUsd: Number(row.bandMidUsd),
      bandMaxUsd: Number(row.bandMaxUsd),
    },
    currentSalary: {
      baseAmount: Number(row.baseAmount),
      currency: row.currency,
      amountUsd: Number(row.amountUsd),
      effectiveFrom: toIsoDate(row.effectiveFrom),
      changeReason: row.changeReason as ChangeReason,
    },
  };
}

interface SalaryRow {
  id: number;
  baseAmount: bigint;
  currency: string;
  amountUsd: bigint;
  usdRate: Prisma.Decimal;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  changeReason: string;
  note: string | null;
}

/** History is returned newest first, each entry annotated with its own increase. */
export function toSalaryHistory(records: readonly SalaryRow[]): SalaryHistoryEntry[] {
  const ascending = [...records].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime() || a.id - b.id,
  );

  return ascending
    .map((record, index) => {
      const previous = index > 0 ? ascending[index - 1] : undefined;
      const changePercent =
        previous && previous.currency === record.currency && previous.baseAmount !== 0n
          ? percentageChange(
              money(Number(previous.baseAmount), previous.currency),
              money(Number(record.baseAmount), record.currency),
            )
          : null;

      return {
        id: record.id,
        baseAmount: Number(record.baseAmount),
        currency: record.currency,
        amountUsd: Number(record.amountUsd),
        usdRate: Number(record.usdRate),
        effectiveFrom: toIsoDate(record.effectiveFrom),
        effectiveTo: record.effectiveTo ? toIsoDate(record.effectiveTo) : null,
        changeReason: record.changeReason as ChangeReason,
        note: record.note,
        changePercent,
      };
    })
    .reverse();
}

function pushIdFilter(conditions: Prisma.Sql[], column: Prisma.Sql, ids?: number[]): void {
  if (ids?.length) {
    conditions.push(Prisma.sql`${column} IN (${Prisma.join(ids)})`);
  }
}

function bandCondition(position: BandPosition): Prisma.Sql {
  switch (position) {
    case 'BELOW_BAND':
      return Prisma.sql`s."amountUsd" < l."bandMinUsd"`;
    case 'ABOVE_BAND':
      return Prisma.sql`s."amountUsd" > l."bandMaxUsd"`;
    case 'LOWER_HALF':
      return Prisma.sql`s."amountUsd" >= l."bandMinUsd" AND s."amountUsd" <= l."bandMidUsd"`;
    case 'UPPER_HALF':
      return Prisma.sql`s."amountUsd" > l."bandMidUsd" AND s."amountUsd" <= l."bandMaxUsd"`;
  }
}

/**
 * Sort columns come from a closed set that Zod has already validated, so the only
 * raw fragment in the query is one of these five expressions.
 */
function orderBy(query: EmployeeQuery): Prisma.Sql {
  const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC';
  const column = {
    name: 'e."lastName", e."firstName"',
    employeeCode: 'e."employeeCode"',
    salaryUsd: 's."amountUsd"',
    compaRatio: 's."amountUsd"::numeric / l."bandMidUsd"',
    hireDate: 'e."hireDate"',
  }[query.sortBy];
  // `e.id` is appended so that pages never repeat or skip a row on ties.
  return Prisma.raw(`${column} ${direction}, e.id ASC`);
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function previousDay(date: Date): Date {
  return new Date(date.getTime() - 86_400_000);
}
