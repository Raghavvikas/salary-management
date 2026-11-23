import type { CountryRef, DepartmentRef, JobLevelRef } from '../employees/employee.types.js';

/** Everything the filter controls in the UI need, in one call. */
export interface ReferenceData {
  departments: DepartmentRef[];
  countries: CountryRef[];
  jobLevels: JobLevelRef[];
}

export interface ReferenceRepository {
  all(): Promise<ReferenceData>;
}
