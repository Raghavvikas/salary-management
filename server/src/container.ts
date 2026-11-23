import { prisma } from './db/prisma.js';
import type { AppDependencies } from './http/app.js';
import { PrismaAnalyticsRepository } from './modules/analytics/analytics.prisma-repository.js';
import { PrismaEmployeeRepository } from './modules/employees/employee.prisma-repository.js';
import { EmployeeService } from './modules/employees/employee.service.js';
import { PrismaReferenceRepository } from './modules/reference/reference.prisma-repository.js';

/** Wires the real, Postgres backed implementations together. */
export function createDependencies(): AppDependencies {
  return {
    employeeService: new EmployeeService(new PrismaEmployeeRepository(prisma)),
    analyticsRepository: new PrismaAnalyticsRepository(prisma),
    referenceRepository: new PrismaReferenceRepository(prisma),
  };
}
