/**
 * Reference data for the organisation. Small, hand written and stable: these are
 * the rows every environment needs before a single employee can exist.
 *
 * FX rates are fixed snapshots, not live quotes, so that seeded data and the
 * figures in the dashboard are reproducible from one run to the next.
 */

export interface CountrySeed {
  code: string;
  name: string;
  currency: string;
  /** USD per one unit of the local currency. */
  usdRate: string;
  /** Share of headcount, relative to the other countries. */
  weight: number;
  /**
   * Local pay level against the USD band for the same job level, used both to
   * generate salaries and, as `marketIndex`, to localise the band people are
   * compared against.
   */
  payFactor: number;
}

export const COUNTRIES: CountrySeed[] = [
  { code: 'US', name: 'United States', currency: 'USD', usdRate: '1.000000', weight: 30, payFactor: 1.0 },
  { code: 'IN', name: 'India', currency: 'INR', usdRate: '0.012000', weight: 28, payFactor: 0.34 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', usdRate: '1.270000', weight: 10, payFactor: 0.82 },
  { code: 'DE', name: 'Germany', currency: 'EUR', usdRate: '1.080000', weight: 8, payFactor: 0.8 },
  { code: 'PL', name: 'Poland', currency: 'PLN', usdRate: '0.250000', weight: 6, payFactor: 0.52 },
  { code: 'CA', name: 'Canada', currency: 'CAD', usdRate: '0.730000', weight: 5, payFactor: 0.84 },
  { code: 'AU', name: 'Australia', currency: 'AUD', usdRate: '0.660000', weight: 4, payFactor: 0.86 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', usdRate: '0.740000', weight: 4, payFactor: 0.78 },
  { code: 'BR', name: 'Brazil', currency: 'BRL', usdRate: '0.180000', weight: 3, payFactor: 0.4 },
  { code: 'MX', name: 'Mexico', currency: 'MXN', usdRate: '0.055000', weight: 2, payFactor: 0.38 },
];

export interface DepartmentSeed {
  code: string;
  name: string;
  weight: number;
  /** Multiplier on the band midpoint for this function. */
  payFactor: number;
  titles: string[];
}

export const DEPARTMENTS: DepartmentSeed[] = [
  { code: 'ENG', name: 'Engineering', weight: 32, payFactor: 1.12, titles: ['Software Engineer', 'Platform Engineer', 'QA Engineer', 'Engineering Manager'] },
  { code: 'SAL', name: 'Sales', weight: 14, payFactor: 1.0, titles: ['Account Executive', 'Sales Development Rep', 'Sales Manager'] },
  { code: 'SUP', name: 'Customer Support', weight: 12, payFactor: 0.78, titles: ['Support Specialist', 'Support Team Lead'] },
  { code: 'OPS', name: 'Operations', weight: 10, payFactor: 0.9, titles: ['Operations Analyst', 'Operations Manager'] },
  { code: 'MKT', name: 'Marketing', weight: 8, payFactor: 0.95, titles: ['Marketing Associate', 'Content Strategist', 'Marketing Manager'] },
  { code: 'FIN', name: 'Finance', weight: 6, payFactor: 1.02, titles: ['Financial Analyst', 'Accountant', 'Finance Manager'] },
  { code: 'PRD', name: 'Product', weight: 6, payFactor: 1.15, titles: ['Product Manager', 'Product Analyst'] },
  { code: 'HR', name: 'People', weight: 5, payFactor: 0.92, titles: ['People Partner', 'Recruiter', 'People Operations Lead'] },
  { code: 'LEG', name: 'Legal', weight: 3, payFactor: 1.1, titles: ['Legal Counsel', 'Compliance Analyst'] },
  { code: 'DSN', name: 'Design', weight: 4, payFactor: 1.05, titles: ['Product Designer', 'Design Lead'] },
];

export interface JobLevelSeed {
  code: string;
  name: string;
  rank: number;
  /** Band bounds in USD major units; converted to minor units on insert. */
  bandMinUsd: number;
  bandMidUsd: number;
  bandMaxUsd: number;
  weight: number;
}

export const JOB_LEVELS: JobLevelSeed[] = [
  { code: 'L1', name: 'Associate', rank: 1, bandMinUsd: 38_000, bandMidUsd: 46_000, bandMaxUsd: 55_000, weight: 16 },
  { code: 'L2', name: 'Professional', rank: 2, bandMinUsd: 52_000, bandMidUsd: 64_000, bandMaxUsd: 78_000, weight: 26 },
  { code: 'L3', name: 'Senior', rank: 3, bandMinUsd: 74_000, bandMidUsd: 92_000, bandMaxUsd: 112_000, weight: 27 },
  { code: 'L4', name: 'Lead', rank: 4, bandMinUsd: 100_000, bandMidUsd: 124_000, bandMaxUsd: 150_000, weight: 16 },
  { code: 'L5', name: 'Manager', rank: 5, bandMinUsd: 125_000, bandMidUsd: 155_000, bandMaxUsd: 188_000, weight: 9 },
  { code: 'L6', name: 'Director', rank: 6, bandMinUsd: 165_000, bandMidUsd: 205_000, bandMaxUsd: 250_000, weight: 5 },
  { code: 'L7', name: 'Vice President', rank: 7, bandMinUsd: 220_000, bandMidUsd: 285_000, bandMaxUsd: 360_000, weight: 1 },
];

/**
 * Name pools. 96 x 72 combinations keeps duplicate names in a 10,000 person org
 * down to roughly one per name, which is what a real directory looks like.
 * Names are not tied to the generated gender; neither are real ones, reliably.
 */
export const FIRST_NAMES = [
  'Aarav', 'Priya', 'Rohan', 'Ananya', 'Vikram', 'Neha', 'Arjun', 'Meera',
  'Kabir', 'Isha', 'Aditya', 'Divya', 'Nikhil', 'Pooja', 'Siddharth', 'Riya',
  'James', 'Emily', 'Michael', 'Sarah', 'David', 'Laura', 'Daniel', 'Hannah',
  'Robert', 'Megan', 'Thomas', 'Rachel', 'Andrew', 'Chloe', 'Joshua', 'Grace',
  'Lukas', 'Anna', 'Jonas', 'Lena', 'Felix', 'Marie', 'Tobias', 'Clara',
  'Piotr', 'Zofia', 'Mateusz', 'Julia', 'Jakub', 'Maja', 'Tomasz', 'Hanna',
  'Lucas', 'Camila', 'Mateo', 'Valentina', 'Gabriel', 'Beatriz', 'Rafael', 'Larissa',
  'Diego', 'Ximena', 'Santiago', 'Lucia', 'Andres', 'Carmen', 'Javier', 'Elena',
  'Wei', 'Mei', 'Hao', 'Siti', 'Jun', 'Ling', 'Arif', 'Nadia',
  'Oliver', 'Charlotte', 'Noah', 'Amelia', 'Ethan', 'Isabella', 'Liam', 'Sofia',
  'Mason', 'Ava', 'Jack', 'Freya', 'Harry', 'Ruby', 'George', 'Erin',
  'Yusuf', 'Zara', 'Omar', 'Layla', 'Idris', 'Amina', 'Samuel', 'Nour',
];

export const LAST_NAMES = [
  'Sharma', 'Patel', 'Iyer', 'Reddy', 'Nair', 'Gupta', 'Mehta', 'Bose',
  'Chopra', 'Desai', 'Kulkarni', 'Banerjee', 'Rao', 'Malhotra', 'Pillai', 'Joshi',
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Clark', 'Walker', 'Hall', 'Young', 'King', 'Wright', 'Scott', 'Green',
  'Muller', 'Schmidt', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schulz',
  'Kowalski', 'Nowak', 'Wojcik', 'Lewandowski', 'Zielinski', 'Szymanski',
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Costa',
  'Rodriguez', 'Hernandez', 'Lopez', 'Martinez', 'Gonzalez', 'Ramirez',
  'Tan', 'Lim', 'Ng', 'Chen', 'Wong', 'Rahman',
  'Murphy', 'OBrien', 'Taylor', 'Wilson', 'Kelly', 'Doherty',
];
