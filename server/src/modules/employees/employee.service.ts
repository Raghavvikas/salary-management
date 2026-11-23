import { bandPosition, compaRatio } from '../../domain/compensation.js';
import { bandFor } from './band.js';
import { convertToUsd, money } from '../../domain/money.js';
import { validateSalaryChange } from '../../domain/salaryChange.js';
import type { ChangeReason } from '../../domain/types.js';
import { notFound, unprocessable } from '../../http/errors.js';
import type {
  EmployeeDetail,
  EmployeeQuery,
  EmployeeRecord,
  EmployeeRepository,
  EmployeeSummary,
  Page,
} from './employee.types.js';

export interface ChangeSalaryCommand {
  /** Annual base in the employee's local currency, in minor units. */
  baseAmount: number;
  currency: string;
  effectiveFrom: Date;
  changeReason: ChangeReason;
  note?: string;
}

/**
 * Use cases for the employee directory.
 *
 * Derived numbers (compa-ratio, band position) are worked out here from the pure
 * domain functions rather than in SQL, so the dashboard and the directory can never
 * disagree about what a compa-ratio is.
 */
export class EmployeeService {
  constructor(
    private readonly repository: EmployeeRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(query: EmployeeQuery): Promise<Page<EmployeeSummary>> {
    const page = await this.repository.list(query);
    return { ...page, items: page.items.map(withDerivedFigures) };
  }

  async get(id: number): Promise<EmployeeDetail> {
    const employee = await this.repository.findById(id);
    if (!employee) throw notFound('Employee', id);
    return {
      ...withDerivedFigures(employee),
      manager: employee.manager,
      salaryHistory: employee.salaryHistory,
    };
  }

  async changeSalary(id: number, command: ChangeSalaryCommand): Promise<EmployeeDetail> {
    const employee = await this.repository.findById(id);
    if (!employee) throw notFound('Employee', id);

    if (employee.status === 'TERMINATED') {
      throw unprocessable('A terminated employee cannot receive a salary change.');
    }

    const newSalary = money(command.baseAmount, command.currency);
    const violations = validateSalaryChange(
      {
        newSalary,
        effectiveFrom: command.effectiveFrom,
        changeReason: command.changeReason,
        note: command.note,
      },
      {
        hireDate: new Date(employee.hireDate),
        countryCurrency: employee.country.currency,
        currentSalary: money(
          employee.currentSalary.baseAmount,
          employee.currentSalary.currency,
        ),
        currentEffectiveFrom: new Date(employee.currentSalary.effectiveFrom),
        today: this.now(),
      },
    );

    if (violations.length > 0) {
      throw unprocessable('The salary change was rejected.', violations);
    }

    const usdRate = employee.country.usdRate;
    await this.repository.recordSalaryChange({
      employeeId: id,
      baseAmount: newSalary.amountMinor,
      currency: newSalary.currency,
      amountUsd: convertToUsd(newSalary, usdRate).amountMinor,
      usdRate,
      effectiveFrom: command.effectiveFrom,
      changeReason: command.changeReason,
      note: command.note,
    });

    return this.get(id);
  }
}

function withDerivedFigures<T extends EmployeeRecord>(employee: T): T & EmployeeSummary {
  const band = bandFor(employee);
  const amountUsd = employee.currentSalary.amountUsd;
  return {
    ...employee,
    band,
    compaRatio: compaRatio(amountUsd, band),
    bandPosition: bandPosition(amountUsd, band),
  };
}
