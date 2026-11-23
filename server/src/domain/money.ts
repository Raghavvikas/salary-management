/**
 * Money handling for the whole application.
 *
 * Every amount that crosses this module is an integer number of *minor units*
 * (cents, pence, paise). Floating point rupees never exist, so there is no place
 * for 0.1 + 0.2 to appear in a payroll figure.
 *
 * All currencies used by the seed are two-decimal currencies. Zero-decimal
 * currencies (JPY, KRW) would need a per-currency exponent before they are added;
 * `MINOR_UNITS_PER_MAJOR` is the single place that assumption lives.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

export interface Money {
  readonly amountMinor: number;
  readonly currency: string;
}

export class MoneyError extends Error {}

export function money(amountMinor: number, currency: string): Money {
  if (!Number.isInteger(amountMinor)) {
    throw new MoneyError(`amount must be an integer number of minor units, got ${amountMinor}`);
  }
  if (!Number.isSafeInteger(amountMinor)) {
    throw new MoneyError('amount is outside the safe integer range');
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new MoneyError(`currency must be a 3 letter ISO code, got "${currency}"`);
  }
  return { amountMinor, currency };
}

/** Builds Money from a major-unit figure, e.g. 85_000.5 USD -> 8_500_050 minor. */
export function fromMajor(amountMajor: number, currency: string): Money {
  if (!Number.isFinite(amountMajor)) {
    throw new MoneyError(`amount must be finite, got ${amountMajor}`);
  }
  return money(roundHalfUp(amountMajor * MINOR_UNITS_PER_MAJOR), currency);
}

export function toMajor(value: Money): number {
  return value.amountMinor / MINOR_UNITS_PER_MAJOR;
}

/**
 * Rounds half away from zero, which is what a payroll team expects and what
 * Math.round does not do for negative numbers.
 */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Converts to USD minor units.
 *
 * `usdRate` is how many USD one major unit of the source currency is worth, so the
 * rate applies unchanged to minor units as well.
 */
export function convertToUsd(value: Money, usdRate: number): Money {
  if (!Number.isFinite(usdRate) || usdRate <= 0) {
    throw new MoneyError(`usd rate must be a positive finite number, got ${usdRate}`);
  }
  if (value.currency === 'USD' && usdRate !== 1) {
    throw new MoneyError('USD amounts must be converted with a rate of 1');
  }
  return money(roundHalfUp(value.amountMinor * usdRate), 'USD');
}

/** Applies a percentage increase, e.g. 4.5 for a 4.5% merit raise. */
export function applyPercentage(value: Money, percentage: number): Money {
  if (!Number.isFinite(percentage)) {
    throw new MoneyError(`percentage must be finite, got ${percentage}`);
  }
  return money(roundHalfUp(value.amountMinor * (1 + percentage / 100)), value.currency);
}

/** Percentage difference from `from` to `to`, rounded to two decimals. */
export function percentageChange(from: Money, to: Money): number {
  assertSameCurrency(from, to);
  if (from.amountMinor === 0) {
    throw new MoneyError('cannot express a change from zero as a percentage');
  }
  const raw = ((to.amountMinor - from.amountMinor) / from.amountMinor) * 100;
  return Math.round(raw * 100) / 100;
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function sumMoney(values: readonly Money[], currency: string): Money {
  return values.reduce((acc, value) => addMoney(acc, value), money(0, currency));
}

export function formatMoney(value: Money, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    maximumFractionDigits: 0,
  }).format(toMajor(value));
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`currency mismatch: ${a.currency} and ${b.currency}`);
  }
}
