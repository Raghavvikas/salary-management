/**
 * The rules that decide whether a salary change may be recorded.
 *
 * Kept as a pure function so the same rules can be exercised by unit tests, called
 * from the service before it opens a transaction, and later reused by a bulk import
 * without dragging Express or Prisma along.
 */

import { percentageChange, type Money } from './money.js';
import type { ChangeReason } from './types.js';

export interface SalaryChangeRequest {
  readonly newSalary: Money;
  readonly effectiveFrom: Date;
  readonly changeReason: ChangeReason;
  readonly note?: string;
}

export interface SalaryChangeContext {
  readonly hireDate: Date;
  readonly countryCurrency: string;
  readonly currentSalary: Money;
  readonly currentEffectiveFrom: Date;
  /** Injected so tests never depend on the wall clock. */
  readonly today: Date;
}

export type SalaryChangeViolationCode =
  | 'NON_POSITIVE_AMOUNT'
  | 'CURRENCY_MISMATCH'
  | 'EFFECTIVE_BEFORE_HIRE'
  | 'EFFECTIVE_NOT_AFTER_CURRENT'
  | 'EFFECTIVE_TOO_FAR_AHEAD'
  | 'NO_CHANGE'
  | 'DECREASE_NEEDS_REASON'
  | 'LARGE_INCREASE_NEEDS_REASON'
  | 'NOTE_REQUIRED';

export interface SalaryChangeViolation {
  readonly code: SalaryChangeViolationCode;
  readonly message: string;
}

/** A raise beyond this needs an explanation that a merit cycle cannot give. */
export const LARGE_INCREASE_THRESHOLD_PERCENT = 40;
const MAX_FUTURE_DAYS = 365;
const DECREASE_REASONS: readonly ChangeReason[] = [
  'CORRECTION',
  'ROLE_CHANGE',
  'MARKET_ADJUSTMENT',
];
const LARGE_INCREASE_REASONS: readonly ChangeReason[] = ['PROMOTION', 'CORRECTION'];
const REASONS_REQUIRING_NOTE: readonly ChangeReason[] = ['CORRECTION', 'ROLE_CHANGE'];

export function validateSalaryChange(
  request: SalaryChangeRequest,
  context: SalaryChangeContext,
): SalaryChangeViolation[] {
  const violations: SalaryChangeViolation[] = [];

  if (request.newSalary.amountMinor <= 0) {
    violations.push({
      code: 'NON_POSITIVE_AMOUNT',
      message: 'A salary must be greater than zero.',
    });
  }

  if (request.newSalary.currency !== context.countryCurrency) {
    violations.push({
      code: 'CURRENCY_MISMATCH',
      message: `Salary must be recorded in ${context.countryCurrency}, the currency of the employee's country.`,
    });
  }

  if (isBefore(request.effectiveFrom, context.hireDate)) {
    violations.push({
      code: 'EFFECTIVE_BEFORE_HIRE',
      message: 'A salary cannot take effect before the employee was hired.',
    });
  }

  if (!isBefore(context.currentEffectiveFrom, request.effectiveFrom)) {
    violations.push({
      code: 'EFFECTIVE_NOT_AFTER_CURRENT',
      message:
        'The new salary must take effect after the current one started. Correct the existing record instead of overlapping it.',
    });
  }

  if (daysBetween(context.today, request.effectiveFrom) > MAX_FUTURE_DAYS) {
    violations.push({
      code: 'EFFECTIVE_TOO_FAR_AHEAD',
      message: 'A salary cannot be scheduled more than a year ahead.',
    });
  }

  // The remaining rules compare amounts, which only makes sense in one currency.
  if (request.newSalary.currency === context.currentSalary.currency) {
    if (request.newSalary.amountMinor === context.currentSalary.amountMinor) {
      violations.push({
        code: 'NO_CHANGE',
        message: 'The new salary is identical to the current one.',
      });
    } else {
      const change = percentageChange(context.currentSalary, request.newSalary);
      if (change < 0 && !DECREASE_REASONS.includes(request.changeReason)) {
        violations.push({
          code: 'DECREASE_NEEDS_REASON',
          message: `A decrease must be recorded as one of: ${DECREASE_REASONS.join(', ')}.`,
        });
      }
      if (
        change > LARGE_INCREASE_THRESHOLD_PERCENT &&
        !LARGE_INCREASE_REASONS.includes(request.changeReason)
      ) {
        violations.push({
          code: 'LARGE_INCREASE_NEEDS_REASON',
          message: `An increase above ${LARGE_INCREASE_THRESHOLD_PERCENT}% must be recorded as one of: ${LARGE_INCREASE_REASONS.join(', ')}.`,
        });
      }
    }
  }

  if (REASONS_REQUIRING_NOTE.includes(request.changeReason) && !request.note?.trim()) {
    violations.push({
      code: 'NOTE_REQUIRED',
      message: `A ${request.changeReason} must carry a note explaining it.`,
    });
  }

  return violations;
}

/** Dates are calendar dates; the time part is deliberately ignored. */
function atMidnightUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function isBefore(a: Date, b: Date): boolean {
  return atMidnightUtc(a) < atMidnightUtc(b);
}

function daysBetween(from: Date, to: Date): number {
  return (atMidnightUtc(to) - atMidnightUtc(from)) / 86_400_000;
}
