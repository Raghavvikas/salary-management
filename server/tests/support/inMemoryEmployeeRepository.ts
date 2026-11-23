import { bandPosition } from '../../src/domain/compensation.js';
import type {
  EmployeeQuery,
  EmployeeRecord,
  EmployeeRepository,
  ManagerRef,
  Page,
  RecordSalaryChangeInput,
  SalaryHistoryEntry,
} from '../../src/modules/employees/employee.types.js';
import { INITIAL_HISTORY, ORG } from './orgFixture.js';

/**
 * A full implementation of the repository contract that keeps everything in arrays.
 *
 * It exists so the service and the HTTP layer can be tested for real — filters,
 * sorting, paging and the write path all go through the same code the Postgres
 * implementation is held to — without a container, a migration or a fixture reset.
 */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private employees: EmployeeRecord[];
  private history: Map<number, SalaryHistoryEntry[]>;
  private nextSalaryRecordId = 1_000;

  constructor(employees: EmployeeRecord[] = ORG) {
    this.employees = employees.map((employee) => structuredClone(employee));
    this.history = new Map(
      this.employees.map((employee) => [
        employee.id,
        structuredClone(INITIAL_HISTORY[employee.id] ?? [defaultHistoryEntry(employee)]),
      ]),
    );
  }

  async list(query: EmployeeQuery): Promise<Page<EmployeeRecord>> {
    const matches = this.employees.filter((employee) => this.matches(employee, query));
    const sorted = matches.sort(comparator(query));
    const start = (query.page - 1) * query.pageSize;

    return {
      items: sorted.slice(start, start + query.pageSize).map((employee) => structuredClone(employee)),
      total: matches.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findById(id: number) {
    const employee = this.employees.find((candidate) => candidate.id === id);
    if (!employee) return null;
    return {
      ...structuredClone(employee),
      manager: null as ManagerRef | null,
      salaryHistory: structuredClone(this.history.get(id) ?? []),
    };
  }

  async recordSalaryChange(input: RecordSalaryChangeInput): Promise<void> {
    const employee = this.employees.find((candidate) => candidate.id === input.employeeId);
    if (!employee) throw new Error(`Employee ${input.employeeId} not found`);

    const entries = this.history.get(input.employeeId) ?? [];
    const current = entries.find((entry) => entry.effectiveTo === null);
    if (current) {
      current.effectiveTo = isoDate(new Date(input.effectiveFrom.getTime() - 86_400_000));
    }

    entries.unshift({
      id: (this.nextSalaryRecordId += 1),
      baseAmount: input.baseAmount,
      currency: input.currency,
      amountUsd: input.amountUsd,
      usdRate: input.usdRate,
      effectiveFrom: isoDate(input.effectiveFrom),
      effectiveTo: null,
      changeReason: input.changeReason,
      note: input.note ?? null,
      changePercent: current
        ? Math.round(((input.baseAmount - current.baseAmount) / current.baseAmount) * 10_000) / 100
        : null,
    });
    this.history.set(input.employeeId, entries);

    employee.currentSalary = {
      baseAmount: input.baseAmount,
      currency: input.currency,
      amountUsd: input.amountUsd,
      effectiveFrom: isoDate(input.effectiveFrom),
      changeReason: input.changeReason,
    };
  }

  private matches(employee: EmployeeRecord, query: EmployeeQuery): boolean {
    if (query.search?.trim()) {
      const term = query.search.trim().toLowerCase();
      const haystack = [
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.employeeCode,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (query.departmentIds?.length && !query.departmentIds.includes(employee.department.id)) {
      return false;
    }
    if (query.countryIds?.length && !query.countryIds.includes(employee.country.id)) {
      return false;
    }
    if (query.jobLevelIds?.length && !query.jobLevelIds.includes(employee.jobLevel.id)) {
      return false;
    }
    if (query.statuses?.length && !query.statuses.includes(employee.status)) {
      return false;
    }
    if (query.bandPositions?.length) {
      const position = bandPosition(employee.currentSalary.amountUsd, {
        minUsd: employee.jobLevel.bandMinUsd,
        midUsd: employee.jobLevel.bandMidUsd,
        maxUsd: employee.jobLevel.bandMaxUsd,
      });
      if (!query.bandPositions.includes(position)) return false;
    }
    return true;
  }
}

function comparator(query: EmployeeQuery): (a: EmployeeRecord, b: EmployeeRecord) => number {
  const sign = query.sortDirection === 'desc' ? -1 : 1;
  const key = (employee: EmployeeRecord): number | string => {
    switch (query.sortBy) {
      case 'name':
        return `${employee.lastName} ${employee.firstName}`;
      case 'employeeCode':
        return employee.employeeCode;
      case 'salaryUsd':
        return employee.currentSalary.amountUsd;
      case 'compaRatio':
        return employee.currentSalary.amountUsd / employee.jobLevel.bandMidUsd;
      case 'hireDate':
        return employee.hireDate;
    }
  };

  return (a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === right) return a.id - b.id;
    return (left < right ? -1 : 1) * sign;
  };
}

function defaultHistoryEntry(employee: EmployeeRecord): SalaryHistoryEntry {
  return {
    id: employee.id * 10,
    baseAmount: employee.currentSalary.baseAmount,
    currency: employee.currentSalary.currency,
    amountUsd: employee.currentSalary.amountUsd,
    usdRate: employee.country.usdRate,
    effectiveFrom: employee.currentSalary.effectiveFrom,
    effectiveTo: null,
    changeReason: employee.currentSalary.changeReason,
    note: null,
    changePercent: null,
  };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
