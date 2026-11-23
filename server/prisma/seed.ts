/**
 * Seeds a full organisation: reference data, 10,000 employees and their salary
 * history (roughly 25,000 salary records).
 *
 * Deterministic by design. A fixed PRNG seed and a fixed "as of" date mean two runs
 * produce byte-identical data, so a number seen on the dashboard can be reproduced
 * and discussed. Pass SEED_EMPLOYEES to generate a smaller set while developing.
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import {
  COUNTRIES,
  DEPARTMENTS,
  FIRST_NAMES,
  JOB_LEVELS,
  LAST_NAMES,
} from './reference-data.js';
import { convertToUsd, fromMajor, money, roundHalfUp } from '../src/domain/money.js';
import type { ChangeReason, EmployeeStatus, Gender } from '../src/domain/types.js';

const prisma = new PrismaClient();

const EMPLOYEE_COUNT = Number(process.env.SEED_EMPLOYEES ?? 10_000);
const RANDOM_SEED = 20_260_101;
/** Everything is generated relative to this date so the data never drifts. */
const AS_OF = new Date('2026-01-01T00:00:00Z');
const INSERT_BATCH_SIZE = 1_000;

/** mulberry32 — small, fast, and seedable, which Math.random is not. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = createRandom(RANDOM_SEED);

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

function pickWeighted<T extends { weight: number }>(items: readonly T[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let threshold = random() * total;
  for (const item of items) {
    threshold -= item.weight;
    if (threshold <= 0) return item;
  }
  return items[items.length - 1] as T;
}

/** Sum of three uniforms: a cheap bell curve, bounded and without a long tail. */
function bellCurve(): number {
  return (random() + random() + random()) / 3;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function dateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

async function resetTables(): Promise<void> {
  // TRUNCATE ... RESTART IDENTITY keeps ids stable across reseeds, which makes the
  // seeded data linkable from notes and screenshots.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "SalaryRecord", "Employee", "JobLevel", "Department", "Country" RESTART IDENTITY CASCADE',
  );
}

async function seedReferenceData() {
  await prisma.country.createMany({
    data: COUNTRIES.map(({ code, name, currency, usdRate }) => ({
      code,
      name,
      currency,
      usdRate,
    })),
  });
  await prisma.department.createMany({
    data: DEPARTMENTS.map(({ code, name }) => ({ code, name })),
  });
  await prisma.jobLevel.createMany({
    data: JOB_LEVELS.map((level) => ({
      code: level.code,
      name: level.name,
      rank: level.rank,
      bandMinUsd: BigInt(level.bandMinUsd * 100),
      bandMidUsd: BigInt(level.bandMidUsd * 100),
      bandMaxUsd: BigInt(level.bandMaxUsd * 100),
    })),
  });

  const [countries, departments, levels] = await Promise.all([
    prisma.country.findMany(),
    prisma.department.findMany(),
    prisma.jobLevel.findMany(),
  ]);

  return {
    countryIdByCode: new Map(countries.map((row) => [row.code, row.id])),
    departmentIdByCode: new Map(departments.map((row) => [row.code, row.id])),
    jobLevelIdByCode: new Map(levels.map((row) => [row.code, row.id])),
  };
}

interface GeneratedEmployee {
  employee: Prisma.EmployeeCreateManyInput;
  /** Target annual base in local minor units at hire time. */
  startingAmountMinor: number;
  currentAmountMinor: number;
  currency: string;
  usdRate: number;
  hireDate: Date;
}

function generateEmployee(
  index: number,
  ids: Awaited<ReturnType<typeof seedReferenceData>>,
): GeneratedEmployee {
  const country = pickWeighted(COUNTRIES);
  const department = pickWeighted(DEPARTMENTS);
  const level = pickWeighted(JOB_LEVELS);

  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const employeeCode = `ACM${String(index + 1).padStart(5, '0')}`;

  // Tenure drives both the hire date and how many raises the person has had.
  const tenureDays = Math.floor(bellCurve() * 2_900) + 30;
  const hireDate = dateOnly(addDays(AS_OF, -tenureDays));

  // Current pay: band midpoint, adjusted for country and function, then spread
  // around the midpoint. A small slice is pushed outside the band on purpose so the
  // band governance screen has something real to show.
  const spread = 0.78 + bellCurve() * 0.46;
  const outlier = random();
  const outlierFactor = outlier < 0.02 ? 0.82 : outlier > 0.985 ? 1.22 : 1;
  const currentUsdMajor =
    level.bandMidUsd * country.payFactor * department.payFactor * spread * outlierFactor;

  const usdRate = Number(country.usdRate);
  const currentLocalMajor = currentUsdMajor / usdRate;
  const currentAmountMinor = roundToLocalPrecision(currentLocalMajor, country.currency);

  // Work backwards from today's pay to a plausible starting salary.
  const yearsOfRaises = Math.min(tenureDays / 365, 8);
  const startingAmountMinor = roundToLocalPrecision(
    currentLocalMajor / Math.pow(1.06, yearsOfRaises),
    country.currency,
  );

  const statusRoll = random();
  const status: EmployeeStatus =
    statusRoll > 0.97 ? 'TERMINATED' : statusRoll > 0.94 ? 'ON_LEAVE' : 'ACTIVE';

  const genderRoll = random();
  const gender: Gender =
    genderRoll < 0.44 ? 'FEMALE' : genderRoll < 0.92 ? 'MALE' : genderRoll < 0.96 ? 'OTHER' : 'UNDISCLOSED';

  return {
    employee: {
      employeeCode,
      firstName,
      lastName,
      email: `${firstName}.${lastName}.${index + 1}@acme.example`.toLowerCase(),
      gender,
      jobTitle: pick(department.titles),
      hireDate,
      status,
      departmentId: ids.departmentIdByCode.get(department.code) as number,
      countryId: ids.countryIdByCode.get(country.code) as number,
      jobLevelId: ids.jobLevelIdByCode.get(level.code) as number,
    },
    startingAmountMinor,
    currentAmountMinor,
    currency: country.currency,
    usdRate,
    hireDate,
  };
}

/** Salaries are quoted in round numbers; nobody is offered 84,317.43. */
function roundToLocalPrecision(amountMajor: number, currency: string): number {
  const step = currency === 'INR' ? 5_000 : currency === 'MXN' || currency === 'BRL' ? 500 : 100;
  return roundHalfUp(Math.round(amountMajor / step) * step) * 100;
}

function buildSalaryHistory(
  employeeId: number,
  generated: GeneratedEmployee,
): Prisma.SalaryRecordCreateManyInput[] {
  const { hireDate, currency, usdRate, startingAmountMinor, currentAmountMinor } = generated;
  const tenureYears = (AS_OF.getTime() - hireDate.getTime()) / (365 * 86_400_000);
  const raiseCount = Math.min(Math.floor(tenureYears), 5);

  const records: Prisma.SalaryRecordCreateManyInput[] = [];
  let amountMinor = startingAmountMinor;
  let effectiveFrom = hireDate;
  let reason: ChangeReason = 'HIRE';

  for (let step = 0; step <= raiseCount; step += 1) {
    const isLast = step === raiseCount;
    const nextAmount = isLast
      ? currentAmountMinor
      : roundHalfUp(
          startingAmountMinor *
            Math.pow(currentAmountMinor / startingAmountMinor, (step + 1) / (raiseCount + 1)),
        );
    const nextEffectiveFrom = dateOnly(
      addDays(hireDate, Math.floor(((step + 1) / (raiseCount + 1)) * tenureYears * 365)),
    );

    const local = money(amountMinor, currency);
    records.push({
      employeeId,
      baseAmount: BigInt(amountMinor),
      currency,
      amountUsd: BigInt(convertToUsd(local, usdRate).amountMinor),
      usdRate: usdRate.toFixed(6),
      effectiveFrom,
      effectiveTo: isLast ? null : nextEffectiveFrom,
      changeReason: reason,
      note: null,
    });

    if (isLast) break;
    amountMinor = nextAmount;
    effectiveFrom = nextEffectiveFrom;
    reason = random() < 0.2 ? 'PROMOTION' : random() < 0.15 ? 'MARKET_ADJUSTMENT' : 'MERIT_INCREASE';
  }

  return records;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  console.log(`Seeding ${EMPLOYEE_COUNT.toLocaleString()} employees...`);

  await resetTables();
  const ids = await seedReferenceData();

  const generated: GeneratedEmployee[] = [];
  for (let index = 0; index < EMPLOYEE_COUNT; index += 1) {
    generated.push(generateEmployee(index, ids));
  }

  for (let offset = 0; offset < generated.length; offset += INSERT_BATCH_SIZE) {
    const batch = generated.slice(offset, offset + INSERT_BATCH_SIZE);
    await prisma.employee.createMany({ data: batch.map((item) => item.employee) });
  }

  const employees = await prisma.employee.findMany({
    select: { id: true, employeeCode: true },
    orderBy: { id: 'asc' },
  });

  const salaryRecords: Prisma.SalaryRecordCreateManyInput[] = [];
  employees.forEach((employee, index) => {
    salaryRecords.push(...buildSalaryHistory(employee.id, generated[index] as GeneratedEmployee));
  });

  for (let offset = 0; offset < salaryRecords.length; offset += INSERT_BATCH_SIZE) {
    await prisma.salaryRecord.createMany({
      data: salaryRecords.slice(offset, offset + INSERT_BATCH_SIZE),
    });
  }

  // Managers are assigned after the fact: a report points at someone more senior in
  // the same department, which is enough structure for the org to look believable.
  await prisma.$executeRawUnsafe(`
    UPDATE "Employee" AS e
    SET "managerId" = m.id
    FROM (
      SELECT DISTINCT ON (x."departmentId", x."jobLevelId")
             x.id, x."departmentId", x."jobLevelId"
      FROM "Employee" x
      ORDER BY x."departmentId", x."jobLevelId", x.id
    ) AS m
    WHERE m."departmentId" = e."departmentId"
      AND m."jobLevelId" = (
        SELECT MIN(l2.id) FROM "JobLevel" l1
        JOIN "JobLevel" l2 ON l2.rank = l1.rank + 1
        WHERE l1.id = e."jobLevelId"
      )
      AND m.id <> e.id
  `);

  const [employeeCount, recordCount, currentCount] = await Promise.all([
    prisma.employee.count(),
    prisma.salaryRecord.count(),
    prisma.salaryRecord.count({ where: { effectiveTo: null } }),
  ]);

  console.log(`  employees:       ${employeeCount.toLocaleString()}`);
  console.log(`  salary records:  ${recordCount.toLocaleString()}`);
  console.log(`  current records: ${currentCount.toLocaleString()}`);
  console.log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  if (currentCount !== employeeCount) {
    throw new Error('every employee must have exactly one current salary record');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
