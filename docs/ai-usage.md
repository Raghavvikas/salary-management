# How AI tools were used

The brief asks for AI to be used intentionally, and for the prompts and instructions
to be part of the submission. This is that record.

## The working pattern

The loop was the same for every piece of the system:

1. **Decide the shape by hand.** The data model, the layering, the repository seam and
   the list of things deliberately left out were written down in
   [requirements.md](requirements.md) and [architecture.md](architecture.md) *before*
   any code was generated. Those two documents were then given to the model as the
   standing context for the whole build.
2. **Ask for one layer at a time**, against an explicit contract. The TypeScript
   interfaces in `*.types.ts` were written or reviewed first; implementations were
   generated against them.
3. **Read everything, keep the tests honest.** Expected values in the test suite were
   worked out by hand from the fixture (six people, numbers chosen to be checkable with
   mental arithmetic) rather than copied from whatever the code happened to return.
4. **Commit in small steps**, so each commit is one reviewable idea.

## Instructions the model was given, standing

- Amounts are integers in minor units everywhere. No floating point money.
- Services depend on interfaces, never on Prisma. Only the `*.prisma-repository.ts`
  files may import the client.
- Every rule that is not about HTTP shape belongs in a pure function under `domain/`.
- Comments explain *why*, never *what*. No comment that restates the line beneath it.
- Tests must not need a database, a container, the network, or the wall clock.

## Prompts that produced the most useful output

> Model employee salary data for a 10,000 person, multi-country org so that "what did
> we pay this person in March 2024" and "what is the median at L3 in India" are both
> one query. Propose the schema and argue the trade-offs; do not write code yet.

This produced the validity-period table and the denormalised USD column, which are
the two decisions the rest of the system rests on.

> Here is the repository interface. Write a Postgres implementation where the
> directory query joins only the current salary record, supports filtering on band
> position (which compares a salary against columns on another table), and returns the
> total row count without a second round trip.

The `COUNT(*) OVER ()` and the band comparison in SQL came out of that constraint
being stated up front rather than discovered later.

> Write the salary change rules as a pure function returning every violation rather
> than throwing on the first. Include the date rules people forget.

> Here are the EXPLAIN ANALYZE results for the directory query. Which single index
> earns its place, and what do you expect it to change?

## Where the model was wrong, and how it was caught

- **The seed produced a current salary that was not the employee's current salary.**
  The generated history interpolated between a starting and a final figure but the
  loop never actually reached the final one. Caught by a `TRUNCATE`-and-reseed check
  that asserts every employee has exactly one current record, then by querying for
  current salaries that were not round numbers. Fixed in its own commit.
- **The first version compared everyone against a single global USD band**, which put
  54% of the organisation below band — a number that looks like a finding and is
  actually a modelling error. Caught by running the analytics against the seeded data
  and not believing the result. Led to the country market index.
- **Generated tests tended to assert whatever the implementation returned.** Several
  were rewritten with figures derived by hand; the percentile test in particular is
  pinned to `percentile_cont` semantics (median of 1,2,3,4 is 2.5) rather than to
  what the first implementation happened to do.
- **Generated comments restated the code.** Most were deleted; what survives explains
  a decision or a constraint.

## What was not delegated

The scope, the exclusions and the reasoning behind them; the data model; the choice of
what to measure and what to index; and the numbers in the test fixtures. AI wrote a
large share of the lines, and none of the decisions.
