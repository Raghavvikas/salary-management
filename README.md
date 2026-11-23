# Salary Management

Web based salary management for ACME's HR manager: 10,000 employees, ten countries,
one place to see what the organisation pays, change a salary with a reason attached,
and answer "how do we pay people?" without opening a spreadsheet.

Built with **React + TypeScript + Ant Design** on the front, **Node + Express +
Prisma** on the back, and **PostgreSQL** underneath.

---

## Quick start

Requires Node 20+ and Docker (for Postgres).

```bash
npm install
npm run db:up                               # Postgres 17 in Docker
cp server/.env.example server/.env
npm run prisma:migrate --workspace=server   # create the schema
npm run seed --workspace=server             # 10,000 employees, ~45,000 salary records
npm run dev                                 # API on :4000, UI on :5173
```

Open <http://localhost:5173>.

If port 5433 is taken, set `DB_PORT` in a root `.env` and point
`DATABASE_URL` in `server/.env` at the same port.

### Everything in one command

```bash
docker compose --profile app up --build
```

Builds the image, starts Postgres, runs the migrations and serves the API *and* the
built UI on <http://localhost:4000>. Seed it once with:

```bash
docker compose exec app npx prisma db seed --schema server/prisma/schema.prisma
```

### Tests

```bash
npm test
```

87 tests, no database, no containers, about a second. See
[Testing strategy](docs/architecture.md#testing-strategy).

---

## What it does

**How we pay** — headcount, annual base payroll, median with p25/p75, how many people
sit outside their band and what it would cost to fix it; the salary distribution;
median and spread by department, country or level; and median pay by gender within
each level, which is the only way that comparison means anything.

**Employees** — 10,000 rows with server-side search, filters (department, country,
level, status, band position), sorting and paging. Every row shows local pay and its
USD equivalent, and where the person sits in their band.

**One employee** — profile, current pay, band position, and the full salary history as
a timeline with the increase on each step.

**Change a salary** — a new record with an effective date and a reason. The previous
record is closed the day before, never overwritten. The server refuses changes that
break the rules and says exactly which ones.

---

## How it is put together

```
web/     React + TypeScript + Vite + Ant Design
server/
  src/domain/      pure functions: money, compa-ratio, percentiles, change rules
  src/modules/     employees, analytics, reference — routes, service, repository
  src/http/        app factory, error shape, query parsing
  prisma/          schema, migrations, deterministic seed
docs/            requirements, architecture, trade-offs, performance, AI usage
```

Services depend on repository *interfaces*. Postgres implementations back the running
application; in-memory implementations back the test suite, which is why the tests
need no database. The reasoning is in [architecture.md](docs/architecture.md).

### Documents

| | |
| --- | --- |
| [Requirements](docs/requirements.md) | Goal, scope, and what is deliberately left out |
| [Architecture](docs/architecture.md) | Data model and the decisions behind it |
| [Trade-offs](docs/trade-offs.md) | The choices that could have gone the other way |
| [Performance](docs/performance.md) | Measurements, and the index that mattered |
| [AI usage](docs/ai-usage.md) | How the tooling was used, and where it was wrong |

---

## API

All amounts are integers in **minor units** (cents). Dates are ISO calendar dates.

| Method | Path | |
| --- | --- | --- |
| `GET` | `/api/employees` | Directory. `search`, `departmentIds`, `countryIds`, `jobLevelIds`, `statuses`, `bandPositions`, `page`, `pageSize`, `sortBy`, `sortDirection`. List parameters are comma separated. |
| `GET` | `/api/employees/:id` | One employee with their full salary history |
| `POST` | `/api/employees/:id/salary` | Record a salary change |
| `GET` | `/api/analytics/overview` | Headcount, payroll, spread, band outliers |
| `GET` | `/api/analytics/breakdown` | `dimension=department\|country\|jobLevel` |
| `GET` | `/api/analytics/distribution` | Histogram, `bucketUsdMajor` |
| `GET` | `/api/analytics/pay-gap` | Median by gender within each level |
| `GET` | `/api/reference` | Departments, countries and levels for the filters |

Errors always have the same shape:

```json
{ "error": { "code": "UNPROCESSABLE", "message": "The salary change was rejected.",
  "details": [{ "code": "DECREASE_NEEDS_REASON", "message": "..." }] } }
```

### Example: give someone a raise

```bash
curl -X POST http://localhost:4000/api/employees/42/salary \
  -H 'Content-Type: application/json' \
  -d '{"baseAmountMajor": 78000, "currency": "USD",
       "effectiveFrom": "2026-04-01", "changeReason": "MERIT_INCREASE"}'
```

---

## Deployment

The `Dockerfile` builds one image that runs the migrations on boot and serves the API
and the UI on a single port — no CORS, no second deployment, no base URL to configure.
`render.yaml` deploys that image next to a managed Postgres.

```bash
docker build -t salary-management .
docker run -p 4000:4000 -e DATABASE_URL=postgresql://... salary-management
```
