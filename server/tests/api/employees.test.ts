import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/testApp.js';

let app: ReturnType<typeof buildTestApp>['app'];

beforeEach(() => {
  app = buildTestApp().app;
});

const names = (body: { items: Array<{ lastName: string }> }) =>
  body.items.map((item) => item.lastName);

describe('GET /api/employees', () => {
  it('returns the whole org sorted by name by default', async () => {
    const response = await request(app).get('/api/employees').expect(200);

    expect(response.body.total).toBe(6);
    expect(names(response.body)).toEqual([
      'Byron',
      'Hopper',
      'Mehta',
      'Sharma',
      'Turing',
      'Weber',
    ]);
  });

  it('adds compa-ratio and band position to every row', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ search: 'hopper' })
      .expect(200);

    const [grace] = response.body.items;
    // 68,000 against an L3 midpoint of 92,000.
    expect(grace.compaRatio).toBe(0.739);
    expect(grace.bandPosition).toBe('BELOW_BAND');
  });

  it('filters by country', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ countryIds: '2' })
      .expect(200);

    expect(names(response.body)).toEqual(['Mehta', 'Sharma']);
  });

  it('filters by band position, across currencies', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ bandPositions: 'BELOW_BAND' })
      .expect(200);

    // Grace in USD and Priya in INR, both compared in USD.
    expect(names(response.body)).toEqual(['Hopper', 'Sharma']);
  });

  it('combines filters', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ departmentIds: '1', statuses: 'ACTIVE', jobLevelIds: '3' })
      .expect(200);

    expect(names(response.body)).toEqual(['Hopper', 'Turing']);
  });

  it('sorts by salary in USD rather than by the local amount', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ sortBy: 'salaryUsd', sortDirection: 'desc' })
      .expect(200);

    // Rohan earns 7,000,000 INR, which is 84,000 USD, not the largest number.
    expect(names(response.body)).toEqual([
      'Byron',
      'Turing',
      'Mehta',
      'Hopper',
      'Weber',
      'Sharma',
    ]);
  });

  it('pages without losing or repeating rows', async () => {
    const first = await request(app)
      .get('/api/employees')
      .query({ page: 1, pageSize: 4 })
      .expect(200);
    const second = await request(app)
      .get('/api/employees')
      .query({ page: 2, pageSize: 4 })
      .expect(200);

    expect(first.body.items).toHaveLength(4);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.total).toBe(6);
    expect(new Set([...names(first.body), ...names(second.body)]).size).toBe(6);
  });

  it('rejects a page size outside the allowed range', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ pageSize: 5_000 })
      .expect(400);

    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('ignores an unparseable id filter rather than failing the request', async () => {
    const response = await request(app)
      .get('/api/employees')
      .query({ departmentIds: 'abc' })
      .expect(200);

    expect(response.body.total).toBe(6);
  });
});

describe('GET /api/employees/:id', () => {
  it('returns the employee with their salary history, newest first', async () => {
    const response = await request(app).get('/api/employees/2').expect(200);

    expect(response.body.employeeCode).toBe('ACM00002');
    expect(response.body.salaryHistory.map((entry: { effectiveFrom: string }) => entry.effectiveFrom))
      .toEqual(['2024-07-01', '2021-06-15']);
    expect(response.body.salaryHistory[0].changePercent).toBe(13.33);
  });

  it('answers 404 for someone who does not exist', async () => {
    const response = await request(app).get('/api/employees/999').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('answers 400 for an id that is not a number', async () => {
    await request(app).get('/api/employees/not-a-number').expect(400);
  });
});

describe('unknown routes', () => {
  it('answer with the standard error shape', async () => {
    const response = await request(app).get('/api/nope').expect(404);
    expect(response.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });
});
