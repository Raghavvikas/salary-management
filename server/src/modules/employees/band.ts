import { localiseBand, type SalaryBand } from '../../domain/compensation.js';
import type { CountryRef, JobLevelRef } from './employee.types.js';

/**
 * The band an individual is actually measured against: their level's published
 * band, scaled to the market they are paid in. Used by the service and by the
 * in-memory repositories; the SQL repositories apply the same multiplication in
 * the query so both sides agree.
 */
export function bandFor(employee: {
  jobLevel: JobLevelRef;
  country: CountryRef;
}): SalaryBand {
  return localiseBand(
    {
      minUsd: employee.jobLevel.bandMinUsd,
      midUsd: employee.jobLevel.bandMidUsd,
      maxUsd: employee.jobLevel.bandMaxUsd,
    },
    employee.country.marketIndex,
  );
}
