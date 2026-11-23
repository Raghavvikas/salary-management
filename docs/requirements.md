# Salary Management — Requirements (one page)

## Goal

Give ACME's HR manager a single web application to **see, change and reason about
salaries for ~10,000 employees across multiple countries**, replacing the spreadsheets
that are used today.

## User & jobs to be done

Primary (and only) persona: **HR Manager of the org**.

1. "Find this employee and tell me what they earn today."
2. "Give this employee a raise / correct their salary, and keep a record of why."
3. "How do we pay people?" — cost, spread and fairness by department, country and level.
4. "Who is paid outside the band we publish for their level?"

## Scope (what is built)

| Area | Included |
| --- | --- |
| Employee directory | Server side search, filter (department, country, level, status), sort, pagination over 10k rows |
| Employee detail | Profile, current compensation, full salary history timeline |
| Salary changes | Record a new salary with effective date and reason; previous record is closed, never overwritten |
| Pay analytics | Headcount and annual payroll cost, median / p25 / p75 by department, country and level, compa-ratio against the level band, distribution histogram |
| Band governance | List of employees below band minimum or above band maximum |
| Multi-currency | Salaries stored in local currency; every comparison is normalised to USD with a stored FX rate |
| Seed | Deterministic script that generates 10,000 employees with realistic spread |

## Explicitly out of scope (and why)

| Left out | Reasoning |
| --- | --- |
| Authentication, roles, permissions | Single persona brief. Real deployment sits behind SSO; adding a half-baked auth layer would consume the time the brief wants spent on data modelling and product thinking. The API is written so an auth middleware drops in at one place. |
| Payroll execution — tax, deductions, payslips, bank files | A different product with heavy jurisdiction specific rules. This tool answers "what do we pay", not "how do we disburse". |
| Bonus, equity, benefits | Needed for true total compensation, but each has its own lifecycle. Base salary first; the salary record table is shaped so other components can be added as sibling rows later. |
| Approval workflow for raises | Real orgs need maker-checker. Out of scope for a single-persona tool; the immutable salary history is the foundation it would build on. |
| Live FX feed | Rates are seeded and stored per currency so analytics are reproducible and tests are deterministic. A scheduled job replacing the table is a small, isolated change. |
| Bulk upload / CSV import-export | The obvious next feature, and the honest migration path off Excel, but it is plumbing rather than product thinking. Noted as the first thing after this milestone. |
| i18n, timezone handling beyond dates | Single HR user, English UI, salary effective dates are plain calendar dates. |

## Non-functional targets

- Directory and analytics queries answer in **< 200 ms** at 10,000 employees — aggregation happens in SQL, never in JavaScript.
- Salary history is **append only**; a correction is a new record, so "what did we pay in March" is always answerable.
- Domain logic (FX, percentiles, compa-ratio, raise validation) is **pure and unit tested** without a database.

## Success criteria

The HR manager can, without a spreadsheet: find any of 10,000 employees in a few
seconds, change a salary with a reason attached, and answer "how does the org pay
people" from one screen.
