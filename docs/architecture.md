# Architecture & design decisions

## Shape of the system

```
web (React + TypeScript + Vite + Ant Design)
  |  REST/JSON over HTTP
server (Node + Express + TypeScript)
  |  modules/<domain>/{routes,service,repository}
  |  domain/  <- pure functions, no I/O, no framework
  |  Prisma Client
postgres 17
```

Three layers on the server, deliberately boring:

- **routes** — HTTP only: parse, validate with Zod, map errors to status codes.
- **service** — use cases and rules. Depends on a *repository interface*, not Prisma.
- **repository** — SQL. A Prisma implementation for production, an in-memory one for tests.

The repository seam is the one piece of indirection worth paying for here: it keeps
the test suite fast and deterministic (no database, no containers in CI) and it keeps
the aggregation SQL in exactly one place.

## Data model

```
Country (code, name, currency, usdRate)
Department (code, name)
JobLevel (code, name, rank, bandMinUsd, bandMidUsd, bandMaxUsd)

Employee (id, employeeCode, firstName, lastName, email, gender,
          departmentId, countryId, jobLevelId, managerId, hireDate, status)

SalaryRecord (id, employeeId, baseAmount, currency, amountUsd,
              effectiveFrom, effectiveTo, changeReason, note, createdAt)
```

### Decisions worth defending

**Salary history is a table, not a column.** `Employee.currentSalary` would be one
join cheaper and permanently lossy. A salary is a fact with a validity period, so it
is modelled as one: `effectiveTo IS NULL` is the current record, and a correction is
an insert plus a close, inside one transaction. Every question of the form "what did
we pay in period X" stays answerable, and raise history comes for free.

**Money is stored twice: local and USD.** `baseAmount` + `currency` is the truth the
HR manager types and the employee is paid. `amountUsd` is a denormalised snapshot
computed with the FX rate *at the time of the record*. Converting 10,000 rows in
JavaScript on every dashboard load would be both slow and non-reproducible; storing
the converted value lets Postgres do `percentile_cont` directly and makes historic
comparisons stable when rates move.

**Amounts are integers (minor units).** Annual base in cents, never a float. The
domain layer never sees a `0.1 + 0.2` problem.

**Bands live on the job level, in USD.** Compa-ratio = `amountUsd / bandMidUsd`.
This makes "who is outside their band" one indexed query rather than per-country
band tables, at the cost of ignoring local market differentials — an acceptable
simplification for a single-org tool, and called out in the requirements.

**Pagination is keyset-friendly but offset-based.** At 10k rows with an indexed sort
column, `LIMIT/OFFSET` is measurably fine and the UI needs page numbers. Keyset would
be the change if the directory grows past a few hundred thousand rows.

## Performance notes

- Indexes: `SalaryRecord(employeeId, effectiveTo)` for the current-salary lookup,
  `Employee(departmentId)`, `Employee(countryId)`, `Employee(jobLevelId)`, and a
  trigram-free `ILIKE` search backed by an index on `lastName` and `employeeCode`.
- Analytics use `percentile_cont` / `avg` / `count` in a single grouped query per
  dimension; nothing streams 10,000 rows into Node.
- The directory query joins only the current salary row (`effectiveTo IS NULL`),
  so page size stays constant regardless of how long an employee has been with ACME.

## Testing strategy

| Layer | How it is tested |
| --- | --- |
| `domain/` | Pure unit tests. Money, FX, percentiles, compa-ratio, raise validation. |
| `service/` | Unit tests against the in-memory repository. Real rules, no I/O. |
| `routes/` | Supertest against the app wired to the in-memory repository — contract and status codes. |
| SQL | Exercised by the seed script and manual timing; deliberately not mocked. |

Everything in `npm test` runs without a database, finishes in seconds, and has no
randomness or wall-clock dependency (the clock is injected where it matters).
