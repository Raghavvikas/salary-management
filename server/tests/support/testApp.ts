import { createApp } from '../../src/http/app.js';
import { EmployeeService } from '../../src/modules/employees/employee.service.js';
import type { EmployeeRecord } from '../../src/modules/employees/employee.types.js';
import type { ReferenceData } from '../../src/modules/reference/reference.types.js';
import { COUNTRIES, DEPARTMENTS, LEVELS } from './orgFixture.js';
import { InMemoryEmployeeRepository } from './inMemoryEmployeeRepository.js';

/** Fixed "today" so date rules in the tests never depend on when they are run. */
export const TEST_TODAY = new Date('2026-01-15T00:00:00Z');

const referenceData: ReferenceData = {
  departments: Object.values(DEPARTMENTS),
  countries: Object.values(COUNTRIES),
  jobLevels: Object.values(LEVELS),
};

export function buildTestApp(employees?: EmployeeRecord[]) {
  const repository = new InMemoryEmployeeRepository(employees);
  const app = createApp({
    employeeService: new EmployeeService(repository, () => TEST_TODAY),
    referenceRepository: { all: async () => referenceData },
  });
  return { app, repository };
}
