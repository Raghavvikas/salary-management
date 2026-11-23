# Performance notes

Measured on the seeded dataset: 10,000 employees, 44,637 salary records, Postgres 17
in Docker on a developer laptop. Figures are warm; the first request after boot pays
for the connection pool and is roughly twice as slow.

## Where the time goes

| Endpoint | Warm p50 end to end |
| --- | --- |
| `GET /api/employees` (25 rows, sorted by salary) | ~80 ms |
| `GET /api/employees?search=...` | ~70 ms |
| `GET /api/analytics/overview` | ~42 ms |
| `GET /api/analytics/breakdown` | ~20 ms |
| `GET /api/analytics/pay-gap` | ~15 ms |

The target in the requirements was under 200 ms at 10,000 employees, which these meet
with room to grow.

## The one index that mattered

Every read in the application starts the same way: join each employee to their
*current* salary record, `effectiveTo IS NULL`. That is 10,000 of the 44,637 salary
rows, and Postgres was reaching it with a sequential scan that threw away 34,637 rows
each time.

```
Seq Scan on "SalaryRecord"  (actual time=0.016..10.813 rows=10000)
  Filter: ("effectiveTo" IS NULL)
  Rows Removed by Filter: 34637
Execution Time: 43.600 ms
```

Adding `@@index([effectiveTo, amountUsd])` gives the planner both the filter and the
sort order in one structure:

```
Bitmap Index Scan on "SalaryRecord_effectiveTo_amountUsd_idx" (actual time=0.487..0.488 rows=10000)
Execution Time: 11.742 ms
```

A 3.7x improvement on the query that every screen depends on, for one line of schema.

## Decisions made for speed

- **Aggregates run in SQL.** `percentile_cont`, `avg`, `count ... filter` and the
  compa-ratio average are all computed by Postgres. Pulling 10,000 rows into Node to
  reduce them would be slower today and would get linearly worse.
- **The row count rides along with the page.** `COUNT(*) OVER ()` in the directory
  query means one round trip instead of a query plus a separate count.
- **USD is stored, not computed.** Converting every salary on every dashboard load
  would mean a multiplication per row per request, and historic figures would move
  whenever an FX rate did.
- **Page size is capped at 200** so a crafted request cannot ask for the whole org.

## What would need rethinking at 10x

- The search uses `ILIKE '%term%'`, which cannot use a plain B-tree index. At 100,000
  employees this is the first thing to change: `pg_trgm` with a GIN index, or a
  dedicated search column. At 10,000 rows it costs a few milliseconds, so it stays
  simple for now.
- Offset pagination degrades on deep pages. Keyset pagination on `(sort column, id)`
  is the replacement, at the cost of losing numbered pages in the UI.
- The dashboard recomputes on every filter change. A materialised view refreshed
  nightly would serve the unfiltered case, with the live query kept for filtered ones.
