# Trade-offs

A record of the choices that could reasonably have gone the other way, and why they
went this way.

## Postgres rather than MongoDB

Salary data is relational and the questions asked of it are relational: group by
department, compare against a band on another table, find the record valid on a date.
Postgres also gives `percentile_cont` in one line, which is most of the dashboard.
A document store would have meant either embedding salary history inside the employee
document, which makes "median by level across the org" a full collection scan, or
rebuilding joins in application code.

## Salary history as rows, not a current-salary column

Covered in [architecture.md](architecture.md): a salary is a fact with a validity
period. The cost is a join on every read of an employee and a transaction on every
write. The benefit is that no question about the past is ever unanswerable, and that
"give a raise" and "fix a typo in a salary" are the same operation with a different
reason attached.

## One band per level, scaled by country, rather than a band per country and function

The organisation publishes one band per level in USD. Each country carries a market
index and the band is scaled by it before anyone is measured against it — without
that, more than half a globally distributed org reads as "below band" and the signal
is worthless.

What this still misses is the **job family**: support is paid differently from
engineering at the same level, and the dashboard shows that as Customer Support
sitting at an average compa-ratio near 0.8 while Engineering sits above 1.1. That is
a real property of the data rather than a bug, but a mature compensation tool would
publish bands per (level, job family, market) and compare against those. It is the
single change that would most improve the fairness view, and it is additive: a
`bandOverride` table keyed on those three columns, consulted before the level band.

## Repository interface with two implementations

The alternative was to let the services talk to Prisma directly and test against a
throwaway database. That is a legitimate choice and arguably tests more. It also makes
the suite slower, order-dependent, and dependent on a container being up — and the
assessment asks for tests that are fast and deterministic. The seam costs one
interface per module and buys a suite that runs in about a second anywhere.

The risk it introduces is honest to name: the in-memory implementation could drift
from the SQL one and the tests would stay green. That is mitigated by keeping derived
figures (compa-ratio, band position, spread) in shared pure functions that *both*
implementations call, so only the filtering and ordering logic is duplicated, and by
the seeded database being exercised by hand against the same expectations.

## Validation in the domain layer, not in Zod

Zod checks shape: is this a number, is this an ISO date. Everything that needs to know
about the employee — can this date overlap the current record, does this currency match
the country, is a 60% raise allowed with this reason — lives in a pure function that
returns *all* violations rather than throwing on the first. The UI can then show the HR
manager every problem at once instead of one per submit.

## No authentication

The brief describes one persona and no access control. Rather than build a login that
would have to be thrown away, the API is written so a single middleware in front of
`/api` is the whole integration point. This is called out in the requirements as an
explicit omission rather than left to be discovered.

## Ant Design over a hand-rolled component set

The directory needs a table with server-side sorting, pagination and multi-select
filters, and the brief asks for a component library. Ant Design covers that on day one
and keeps the code about the product rather than about a table implementation. The cost
is bundle size — the production build is ~1.6 MB raw, ~505 kB gzipped — which for an
internal HR tool is an acceptable trade for the time saved.
