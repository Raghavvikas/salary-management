/**
 * Compensation maths the HR manager actually asks about: where does a salary sit
 * inside its band, and how is a group of salaries spread out.
 *
 * Pure functions over plain numbers (USD minor units) so they can be unit tested
 * without a database, and reused by both the API and the seed script.
 */

import { roundHalfUp } from './money.js';

export interface SalaryBand {
  readonly minUsd: number;
  readonly midUsd: number;
  readonly maxUsd: number;
}

/**
 * A level's band is published in USD for the whole company. Pay levels differ by
 * country, so before anyone is compared against their band it is scaled by the
 * market index of the country they are paid in. Without this, two thirds of a
 * globally distributed org reads as "below band", which tells the HR manager
 * nothing.
 */
export function localiseBand(band: SalaryBand, marketIndex: number): SalaryBand {
  if (!Number.isFinite(marketIndex) || marketIndex <= 0) {
    throw new CompensationError(`market index must be positive, got ${marketIndex}`);
  }
  return {
    minUsd: Math.round(band.minUsd * marketIndex),
    midUsd: Math.round(band.midUsd * marketIndex),
    maxUsd: Math.round(band.maxUsd * marketIndex),
  };
}

export type BandPosition = 'BELOW_BAND' | 'LOWER_HALF' | 'UPPER_HALF' | 'ABOVE_BAND';

export class CompensationError extends Error {}

export function assertValidBand(band: SalaryBand): void {
  if (!(band.minUsd <= band.midUsd && band.midUsd <= band.maxUsd)) {
    throw new CompensationError(
      `band must satisfy min <= mid <= max, got ${band.minUsd}/${band.midUsd}/${band.maxUsd}`,
    );
  }
  if (band.minUsd <= 0) {
    throw new CompensationError('band minimum must be positive');
  }
}

/**
 * Compa-ratio: salary divided by the band midpoint. 1.0 means paid exactly at the
 * market reference point for the level. Returned rounded to three decimals, which
 * is the precision HR reports are read at.
 */
export function compaRatio(amountUsd: number, band: SalaryBand): number {
  assertValidBand(band);
  return Math.round((amountUsd / band.midUsd) * 1000) / 1000;
}

export function bandPosition(amountUsd: number, band: SalaryBand): BandPosition {
  assertValidBand(band);
  if (amountUsd < band.minUsd) return 'BELOW_BAND';
  if (amountUsd > band.maxUsd) return 'ABOVE_BAND';
  return amountUsd <= band.midUsd ? 'LOWER_HALF' : 'UPPER_HALF';
}

/** What it would cost to bring someone up to the bottom of their band. */
export function costToBandMinimum(amountUsd: number, band: SalaryBand): number {
  assertValidBand(band);
  return Math.max(0, band.minUsd - amountUsd);
}

/**
 * Linear interpolation percentile, matching Postgres `percentile_cont`.
 * Keeping the two implementations in agreement means the dashboard reads the same
 * whether a figure was computed in SQL or in Node.
 */
export function percentile(sortedValues: readonly number[], fraction: number): number {
  if (sortedValues.length === 0) {
    throw new CompensationError('percentile of an empty set is undefined');
  }
  if (fraction < 0 || fraction > 1) {
    throw new CompensationError(`fraction must be within [0, 1], got ${fraction}`);
  }
  const position = (sortedValues.length - 1) * fraction;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sortedValues[lowerIndex] as number;
  const upper = sortedValues[upperIndex] as number;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

export interface SalarySpread {
  readonly count: number;
  readonly totalUsd: number;
  readonly averageUsd: number;
  readonly p25Usd: number;
  readonly medianUsd: number;
  readonly p75Usd: number;
  readonly minUsd: number;
  readonly maxUsd: number;
}

/** Summarises a group of salaries. Input need not be sorted. */
export function salarySpread(amountsUsd: readonly number[]): SalarySpread {
  if (amountsUsd.length === 0) {
    throw new CompensationError('cannot summarise an empty group of salaries');
  }
  const sorted = [...amountsUsd].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    totalUsd: total,
    averageUsd: roundHalfUp(total / sorted.length),
    p25Usd: roundHalfUp(percentile(sorted, 0.25)),
    medianUsd: roundHalfUp(percentile(sorted, 0.5)),
    p75Usd: roundHalfUp(percentile(sorted, 0.75)),
    minUsd: sorted[0] as number,
    maxUsd: sorted[sorted.length - 1] as number,
  };
}

/**
 * Buckets salaries for the distribution chart. Bucket width is given rather than
 * derived so the UI can keep the axis stable while filters change.
 */
export interface HistogramBucket {
  readonly fromUsd: number;
  readonly toUsd: number;
  readonly count: number;
}

export function histogram(
  amountsUsd: readonly number[],
  bucketWidthUsd: number,
): HistogramBucket[] {
  if (bucketWidthUsd <= 0) {
    throw new CompensationError('bucket width must be positive');
  }
  if (amountsUsd.length === 0) return [];

  const counts = new Map<number, number>();
  let highestIndex = 0;
  let lowestIndex = Number.POSITIVE_INFINITY;

  for (const amount of amountsUsd) {
    const index = Math.floor(amount / bucketWidthUsd);
    counts.set(index, (counts.get(index) ?? 0) + 1);
    highestIndex = Math.max(highestIndex, index);
    lowestIndex = Math.min(lowestIndex, index);
  }

  const buckets: HistogramBucket[] = [];
  for (let index = lowestIndex; index <= highestIndex; index += 1) {
    buckets.push({
      fromUsd: index * bucketWidthUsd,
      toUsd: (index + 1) * bucketWidthUsd,
      count: counts.get(index) ?? 0,
    });
  }
  return buckets;
}
