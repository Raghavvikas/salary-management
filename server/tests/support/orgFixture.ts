import type {
  EmployeeRecord,
  SalaryHistoryEntry,
} from '../../src/modules/employees/employee.types.js';

/**
 * A six person organisation that is small enough to reason about by hand and wide
 * enough to exercise every filter: two countries, three levels, one person under
 * their band and one above it.
 */

export const DEPARTMENTS = {
  engineering: { id: 1, code: 'ENG', name: 'Engineering' },
  sales: { id: 2, code: 'SAL', name: 'Sales' },
};

export const COUNTRIES = {
  us: { id: 1, code: 'US', name: 'United States', currency: 'USD', usdRate: 1 },
  india: { id: 2, code: 'IN', name: 'India', currency: 'INR', usdRate: 0.012 },
};

export const LEVELS = {
  l2: {
    id: 2,
    code: 'L2',
    name: 'Professional',
    rank: 2,
    bandMinUsd: 52_000_00,
    bandMidUsd: 64_000_00,
    bandMaxUsd: 78_000_00,
  },
  l3: {
    id: 3,
    code: 'L3',
    name: 'Senior',
    rank: 3,
    bandMinUsd: 74_000_00,
    bandMidUsd: 92_000_00,
    bandMaxUsd: 112_000_00,
  },
  l5: {
    id: 5,
    code: 'L5',
    name: 'Manager',
    rank: 5,
    bandMinUsd: 125_000_00,
    bandMidUsd: 155_000_00,
    bandMaxUsd: 188_000_00,
  },
};

interface FixtureInput {
  id: number;
  firstName: string;
  lastName: string;
  department: EmployeeRecord['department'];
  country: EmployeeRecord['country'];
  jobLevel: EmployeeRecord['jobLevel'];
  gender: EmployeeRecord['gender'];
  status?: EmployeeRecord['status'];
  hireDate: string;
  /** Annual base in the local currency, major units. */
  baseMajor: number;
  effectiveFrom: string;
}

function employee(input: FixtureInput): EmployeeRecord {
  const baseAmount = Math.round(input.baseMajor * 100);
  return {
    id: input.id,
    employeeCode: `ACM${String(input.id).padStart(5, '0')}`,
    firstName: input.firstName,
    lastName: input.lastName,
    email: `${input.firstName}.${input.lastName}@acme.example`.toLowerCase(),
    gender: input.gender,
    jobTitle: 'Engineer',
    hireDate: input.hireDate,
    status: input.status ?? 'ACTIVE',
    department: input.department,
    country: input.country,
    jobLevel: input.jobLevel,
    currentSalary: {
      baseAmount,
      currency: input.country.currency,
      amountUsd: Math.round(baseAmount * input.country.usdRate),
      effectiveFrom: input.effectiveFrom,
      changeReason: 'MERIT_INCREASE',
    },
  };
}

export const ORG: EmployeeRecord[] = [
  employee({
    id: 1,
    firstName: 'Ada',
    lastName: 'Byron',
    department: DEPARTMENTS.engineering,
    country: COUNTRIES.us,
    jobLevel: LEVELS.l5,
    gender: 'FEMALE',
    hireDate: '2019-02-01',
    baseMajor: 160_000,
    effectiveFrom: '2025-01-01',
  }),
  employee({
    id: 2,
    firstName: 'Grace',
    lastName: 'Hopper',
    department: DEPARTMENTS.engineering,
    country: COUNTRIES.us,
    jobLevel: LEVELS.l3,
    gender: 'FEMALE',
    hireDate: '2021-06-15',
    // Below the L3 band minimum of 74,000 on purpose.
    baseMajor: 68_000,
    effectiveFrom: '2024-07-01',
  }),
  employee({
    id: 3,
    firstName: 'Alan',
    lastName: 'Turing',
    department: DEPARTMENTS.engineering,
    country: COUNTRIES.us,
    jobLevel: LEVELS.l3,
    // Above the L3 band maximum of 112,000 on purpose.
    gender: 'MALE',
    hireDate: '2018-09-01',
    baseMajor: 120_000,
    effectiveFrom: '2025-04-01',
  }),
  employee({
    id: 4,
    firstName: 'Priya',
    lastName: 'Sharma',
    department: DEPARTMENTS.engineering,
    country: COUNTRIES.india,
    jobLevel: LEVELS.l2,
    gender: 'FEMALE',
    hireDate: '2022-01-10',
    // 4,000,000 INR at 0.012 = 48,000 USD.
    baseMajor: 4_000_000,
    effectiveFrom: '2025-03-01',
  }),
  employee({
    id: 5,
    firstName: 'Rohan',
    lastName: 'Mehta',
    department: DEPARTMENTS.sales,
    country: COUNTRIES.india,
    jobLevel: LEVELS.l3,
    gender: 'MALE',
    hireDate: '2020-11-20',
    baseMajor: 7_000_000,
    effectiveFrom: '2025-02-01',
  }),
  employee({
    id: 6,
    firstName: 'Lena',
    lastName: 'Weber',
    department: DEPARTMENTS.sales,
    country: COUNTRIES.us,
    jobLevel: LEVELS.l2,
    gender: 'OTHER',
    status: 'TERMINATED',
    hireDate: '2023-03-01',
    baseMajor: 60_000,
    effectiveFrom: '2024-01-01',
  }),
];

export const INITIAL_HISTORY: Record<number, SalaryHistoryEntry[]> = {
  2: [
    {
      id: 20,
      baseAmount: 68_000_00,
      currency: 'USD',
      amountUsd: 68_000_00,
      usdRate: 1,
      effectiveFrom: '2024-07-01',
      effectiveTo: null,
      changeReason: 'MERIT_INCREASE',
      note: null,
      changePercent: 13.33,
    },
    {
      id: 10,
      baseAmount: 60_000_00,
      currency: 'USD',
      amountUsd: 60_000_00,
      usdRate: 1,
      effectiveFrom: '2021-06-15',
      effectiveTo: '2024-06-30',
      changeReason: 'HIRE',
      note: null,
      changePercent: null,
    },
  ],
};
