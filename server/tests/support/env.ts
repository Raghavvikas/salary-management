// The API test suite never touches a database, but `src/config/env.ts` insists on a
// complete configuration at import time. Supplying a placeholder here keeps the
// suite runnable on a clean checkout with no .env file and no Postgres.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://unused:unused@localhost:5432/unused';
