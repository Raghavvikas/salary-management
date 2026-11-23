import { describe, expect, it } from 'vitest';
import {
  bandPosition,
  compaRatio,
  CompensationError,
  costToBandMinimum,
  histogram,
  localiseBand,
  percentile,
  salarySpread,
  type SalaryBand,
} from '../../src/domain/compensation.js';

// All figures are USD minor units: 90_000_00 is $90,000.
const band: SalaryBand = { minUsd: 90_000_00, midUsd: 110_000_00, maxUsd: 130_000_00 };

describe('compaRatio', () => {
  it('is 1 at the midpoint', () => {
    expect(compaRatio(110_000_00, band)).toBe(1);
  });

  it('rounds to three decimals', () => {
    expect(compaRatio(95_000_00, band)).toBe(0.864);
  });

  it('rejects a band whose bounds are out of order', () => {
    expect(() => compaRatio(1, { minUsd: 10, midUsd: 5, maxUsd: 20 })).toThrow(
      CompensationError,
    );
  });
});

describe('bandPosition', () => {
  it.each([
    [89_999_99, 'BELOW_BAND'],
    [90_000_00, 'LOWER_HALF'],
    [110_000_00, 'LOWER_HALF'],
    [110_000_01, 'UPPER_HALF'],
    [130_000_00, 'UPPER_HALF'],
    [130_000_01, 'ABOVE_BAND'],
  ])('places %i as %s', (amount, expected) => {
    expect(bandPosition(amount, band)).toBe(expected);
  });
});

describe('costToBandMinimum', () => {
  it('is the gap for someone under the band', () => {
    expect(costToBandMinimum(84_000_00, band)).toBe(6_000_00);
  });

  it('is zero for someone already inside the band', () => {
    expect(costToBandMinimum(120_000_00, band)).toBe(0);
  });
});

describe('percentile', () => {
  it('interpolates the way postgres percentile_cont does', () => {
    // percentile_cont(0.5) over (1,2,3,4) is 2.5, not 2 or 3.
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([1, 2, 3, 4], 0.25)).toBe(1.75);
  });

  it('returns the single value for a one element set', () => {
    expect(percentile([42], 0.9)).toBe(42);
  });

  it('returns the bounds at 0 and 1', () => {
    expect(percentile([10, 20, 30], 0)).toBe(10);
    expect(percentile([10, 20, 30], 1)).toBe(30);
  });

  it('refuses an empty set or a fraction outside [0, 1]', () => {
    expect(() => percentile([], 0.5)).toThrow(CompensationError);
    expect(() => percentile([1], 1.5)).toThrow(CompensationError);
  });
});

describe('salarySpread', () => {
  it('summarises a group regardless of input order', () => {
    const spread = salarySpread([120_000_00, 80_000_00, 100_000_00, 140_000_00]);
    expect(spread).toEqual({
      count: 4,
      totalUsd: 440_000_00,
      averageUsd: 110_000_00,
      p25Usd: 95_000_00,
      medianUsd: 110_000_00,
      p75Usd: 125_000_00,
      minUsd: 80_000_00,
      maxUsd: 140_000_00,
    });
  });

  it('does not mutate the caller array', () => {
    const input = [3, 1, 2];
    salarySpread(input);
    expect(input).toEqual([3, 1, 2]);
  });

  it('refuses an empty group rather than reporting zeroes', () => {
    expect(() => salarySpread([])).toThrow(CompensationError);
  });
});

describe('histogram', () => {
  it('buckets salaries and keeps empty buckets in the middle', () => {
    const buckets = histogram([10, 12, 31], 10);
    expect(buckets).toEqual([
      { fromUsd: 10, toUsd: 20, count: 2 },
      { fromUsd: 20, toUsd: 30, count: 0 },
      { fromUsd: 30, toUsd: 40, count: 1 },
    ]);
  });

  it('returns nothing for an empty input', () => {
    expect(histogram([], 10)).toEqual([]);
  });

  it('refuses a non positive bucket width', () => {
    expect(() => histogram([1], 0)).toThrow(CompensationError);
  });
});

describe('localiseBand', () => {
  it('scales the published band to the local market', () => {
    expect(localiseBand(band, 0.34)).toEqual({
      minUsd: 30_600_00,
      midUsd: 37_400_00,
      maxUsd: 44_200_00,
    });
  });

  it('leaves the reference market untouched', () => {
    expect(localiseBand(band, 1)).toEqual(band);
  });

  it('refuses a non positive index', () => {
    expect(() => localiseBand(band, 0)).toThrow(CompensationError);
  });
});
