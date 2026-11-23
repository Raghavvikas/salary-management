/**
 * Formatting helpers. Everything the API sends is in minor units, so there is
 * exactly one place in the UI that divides by 100.
 */

const MINOR_UNITS_PER_MAJOR = 100;

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}

export const formatUsd = (amountMinor: number): string => formatMoney(amountMinor, 'USD');

/** Large payroll totals are unreadable in full; $68.1M says more than the digits. */
export function formatUsdCompact(amountMinor: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amountMinor / MINOR_UNITS_PER_MAJOR);
}

export function toMajor(amountMinor: number): number {
  return amountMinor / MINOR_UNITS_PER_MAJOR;
}

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
