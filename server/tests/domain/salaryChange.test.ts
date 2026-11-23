import { describe, expect, it } from 'vitest';
import { fromMajor } from '../../src/domain/money.js';
import {
  validateSalaryChange,
  type SalaryChangeContext,
  type SalaryChangeRequest,
  type SalaryChangeViolationCode,
} from '../../src/domain/salaryChange.js';

const context: SalaryChangeContext = {
  hireDate: new Date('2021-03-01T00:00:00Z'),
  countryCurrency: 'USD',
  currentSalary: fromMajor(100_000, 'USD'),
  currentEffectiveFrom: new Date('2024-04-01T00:00:00Z'),
  today: new Date('2025-06-15T00:00:00Z'),
};

const validRequest: SalaryChangeRequest = {
  newSalary: fromMajor(106_000, 'USD'),
  effectiveFrom: new Date('2025-07-01T00:00:00Z'),
  changeReason: 'MERIT_INCREASE',
};

function codesFor(
  request: Partial<SalaryChangeRequest>,
  overrides: Partial<SalaryChangeContext> = {},
): SalaryChangeViolationCode[] {
  return validateSalaryChange(
    { ...validRequest, ...request },
    { ...context, ...overrides },
  ).map((violation) => violation.code);
}

describe('validateSalaryChange', () => {
  it('accepts an ordinary merit increase', () => {
    expect(codesFor({})).toEqual([]);
  });

  it('rejects a zero or negative salary', () => {
    expect(codesFor({ newSalary: fromMajor(0, 'USD') })).toContain('NON_POSITIVE_AMOUNT');
  });

  it('rejects a salary in a currency the employee is not paid in', () => {
    expect(codesFor({ newSalary: fromMajor(106_000, 'EUR') })).toContain(
      'CURRENCY_MISMATCH',
    );
  });

  it('rejects an effective date before the hire date', () => {
    expect(
      codesFor({ effectiveFrom: new Date('2020-01-01T00:00:00Z') }),
    ).toContain('EFFECTIVE_BEFORE_HIRE');
  });

  it('rejects an effective date that overlaps the current record', () => {
    expect(codesFor({ effectiveFrom: new Date('2024-04-01T00:00:00Z') })).toContain(
      'EFFECTIVE_NOT_AFTER_CURRENT',
    );
  });

  it('allows a date one day after the current record starts', () => {
    expect(
      codesFor({ effectiveFrom: new Date('2024-04-02T00:00:00Z') }),
    ).toEqual([]);
  });

  it('rejects a change scheduled more than a year ahead', () => {
    expect(codesFor({ effectiveFrom: new Date('2026-07-01T00:00:00Z') })).toContain(
      'EFFECTIVE_TOO_FAR_AHEAD',
    );
  });

  it('allows a change exactly a year ahead', () => {
    expect(codesFor({ effectiveFrom: new Date('2026-06-15T00:00:00Z') })).toEqual([]);
  });

  it('rejects a change that changes nothing', () => {
    expect(codesFor({ newSalary: fromMajor(100_000, 'USD') })).toContain('NO_CHANGE');
  });

  it('requires an explicit reason for a decrease', () => {
    expect(codesFor({ newSalary: fromMajor(95_000, 'USD') })).toContain(
      'DECREASE_NEEDS_REASON',
    );
    expect(
      codesFor({
        newSalary: fromMajor(95_000, 'USD'),
        changeReason: 'ROLE_CHANGE',
        note: 'Moved to a part time contract at their request.',
      }),
    ).toEqual([]);
  });

  it('requires promotion or correction for an increase above 40%', () => {
    expect(codesFor({ newSalary: fromMajor(145_000, 'USD') })).toContain(
      'LARGE_INCREASE_NEEDS_REASON',
    );
    expect(
      codesFor({ newSalary: fromMajor(145_000, 'USD'), changeReason: 'PROMOTION' }),
    ).toEqual([]);
  });

  it('leaves a 40% increase alone', () => {
    expect(codesFor({ newSalary: fromMajor(140_000, 'USD') })).toEqual([]);
  });

  it('requires a note on a correction', () => {
    expect(codesFor({ changeReason: 'CORRECTION' })).toEqual(['NOTE_REQUIRED']);
    expect(
      codesFor({ changeReason: 'CORRECTION', note: '   ' }),
    ).toEqual(['NOTE_REQUIRED']);
    expect(
      codesFor({ changeReason: 'CORRECTION', note: 'Original offer was keyed in wrong.' }),
    ).toEqual([]);
  });

  it('reports every problem at once rather than the first one', () => {
    expect(
      codesFor({
        newSalary: fromMajor(-1, 'EUR'),
        effectiveFrom: new Date('2019-01-01T00:00:00Z'),
      }),
    ).toEqual([
      'NON_POSITIVE_AMOUNT',
      'CURRENCY_MISMATCH',
      'EFFECTIVE_BEFORE_HIRE',
      'EFFECTIVE_NOT_AFTER_CURRENT',
    ]);
  });
});
