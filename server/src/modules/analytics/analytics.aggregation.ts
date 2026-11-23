import type { Gender } from '../../domain/types.js';
import type { DistributionBucket, PayGapRow } from './analytics.types.js';

/**
 * The two reshaping steps that SQL does not do for us. Pure, so they are unit
 * tested directly and reused by the in-memory repository the API tests run against.
 */

/** Postgres only returns buckets that contain someone; the chart needs the gaps. */
export function fillGaps(
  buckets: DistributionBucket[],
  bucketUsd: number,
): DistributionBucket[] {
  if (buckets.length === 0) return [];
  const filled: DistributionBucket[] = [];
  const last = buckets[buckets.length - 1] as DistributionBucket;
  const byFrom = new Map(buckets.map((bucket) => [bucket.fromUsd, bucket]));

  for (
    let from = (buckets[0] as DistributionBucket).fromUsd;
    from <= last.fromUsd;
    from += bucketUsd
  ) {
    filled.push(byFrom.get(from) ?? { fromUsd: from, toUsd: from + bucketUsd, count: 0 });
  }
  return filled;
}

interface FlatPayGapRow {
  jobLevel: PayGapRow['jobLevel'];
  gender: Gender;
  count: number;
  medianUsd: number;
}

/** Turns one row per (level, gender) into one row per level. */
export function groupPayGapRows(rows: readonly FlatPayGapRow[]): PayGapRow[] {
  const byLevel = new Map<number, PayGapRow>();

  for (const row of rows) {
    const existing = byLevel.get(row.jobLevel.id) ?? {
      jobLevel: row.jobLevel,
      medianByGender: {},
      countByGender: {},
      gapPercent: null,
    };
    existing.medianByGender[row.gender] = row.medianUsd;
    existing.countByGender[row.gender] = row.count;
    byLevel.set(row.jobLevel.id, existing);
  }

  return [...byLevel.values()]
    .map((level) => {
      const female = level.medianByGender.FEMALE;
      const male = level.medianByGender.MALE;
      return {
        ...level,
        gapPercent:
          female !== undefined && male !== undefined && male !== 0
            ? Math.round(((female - male) / male) * 10_000) / 100
            : null,
      };
    })
    .sort((a, b) => a.jobLevel.rank - b.jobLevel.rank);
}
