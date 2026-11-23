import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/testApp.js';

/**
 * The fixture org, in USD minor units:
 *   Byron   L5 US  16,000,000      Hopper  L3 US   6,800,000 (below band)
 *   Turing  L3 US  12,000,000      Weber   L2 US   6,000,000 (terminated)
 *   Mehta   L3 IN   3,360,000      Sharma  L2 IN   1,680,000 (below band)
 */

let app: ReturnType<typeof buildTestApp>['app'];

beforeEach(() => {
  app = buildTestApp().app;
});

describe('GET /api/analytics/overview', () => {
  it('adds up the payroll and reports the spread', async () => {
    const response = await request(app).get('/api/analytics/overview').expect(200);

    expect(response.body).toEqual({
      headcount: 6,
      annualPayrollUsd: 45_840_000,
      averageUsd: 7_640_000,
      p25Usd: 4_020_000,
      medianUsd: 6_400_000,
      p75Usd: 10_700_000,
      belowBandCount: 2,
      aboveBandCount: 1,
      costToFixBelowBandUsd: 688_000,
    });
  });

  it('respects filters', async () => {
    const response = await request(app)
      .get('/api/analytics/overview')
      .query({ countryIds: '2' })
      .expect(200);

    expect(response.body).toMatchObject({
      headcount: 2,
      annualPayrollUsd: 5_040_000,
      medianUsd: 2_520_000,
    });
  });

  it('returns zeroes rather than failing when nothing matches', async () => {
    const response = await request(app)
      .get('/api/analytics/overview')
      .query({ departmentIds: '99' })
      .expect(200);

    expect(response.body.headcount).toBe(0);
    expect(response.body.medianUsd).toBe(0);
  });
});

describe('GET /api/analytics/breakdown', () => {
  it('groups by department by default', async () => {
    const response = await request(app).get('/api/analytics/breakdown').expect(200);

    expect(response.body.dimension).toBe('department');
    expect(response.body.rows.map((row: { key: { code: string } }) => row.key.code)).toEqual([
      'ENG',
      'SAL',
    ]);
  });

  it('groups by country, in USD', async () => {
    const response = await request(app)
      .get('/api/analytics/breakdown')
      .query({ dimension: 'country' })
      .expect(200);

    const [india, us] = response.body.rows;
    expect(india.key.name).toBe('India');
    expect(india).toMatchObject({ headcount: 2, totalUsd: 5_040_000, medianUsd: 2_520_000 });
    expect(us).toMatchObject({ headcount: 4, totalUsd: 40_800_000 });
  });

  it('orders levels by seniority rather than alphabetically', async () => {
    const response = await request(app)
      .get('/api/analytics/breakdown')
      .query({ dimension: 'jobLevel' })
      .expect(200);

    expect(response.body.rows.map((row: { key: { code: string } }) => row.key.code)).toEqual([
      'L2',
      'L3',
      'L5',
    ]);
  });

  it('rejects a dimension that is not a thing we group by', async () => {
    await request(app)
      .get('/api/analytics/breakdown')
      .query({ dimension: 'favourite-colour' })
      .expect(400);
  });
});

describe('GET /api/analytics/distribution', () => {
  it('buckets everyone and keeps the empty buckets in between', async () => {
    const response = await request(app)
      .get('/api/analytics/distribution')
      .query({ bucketUsdMajor: 5_000 })
      .expect(200);

    const { buckets, bucketUsd } = response.body;
    expect(bucketUsd).toBe(500_000);
    expect(buckets[0]).toEqual({ fromUsd: 1_500_000, toUsd: 2_000_000, count: 1 });
    expect(buckets.at(-1)).toEqual({ fromUsd: 16_000_000, toUsd: 16_500_000, count: 1 });
    expect(
      buckets.reduce((total: number, bucket: { count: number }) => total + bucket.count, 0),
    ).toBe(6);
  });

  it('rejects a bucket size that would produce an unreadable chart', async () => {
    await request(app)
      .get('/api/analytics/distribution')
      .query({ bucketUsdMajor: 5 })
      .expect(400);
  });
});

describe('GET /api/analytics/pay-gap', () => {
  it('compares medians by gender within each level', async () => {
    const response = await request(app).get('/api/analytics/pay-gap').expect(200);

    const level3 = response.body.rows.find(
      (row: { jobLevel: { code: string } }) => row.jobLevel.code === 'L3',
    );
    // Hopper on 6,800,000 against a male median of 7,680,000.
    expect(level3.medianByGender).toEqual({ FEMALE: 6_800_000, MALE: 7_680_000 });
    expect(level3.countByGender).toEqual({ FEMALE: 1, MALE: 2 });
    expect(level3.gapPercent).toBe(-11.46);
  });

  it('reports no gap where one side of the comparison is missing', async () => {
    const response = await request(app).get('/api/analytics/pay-gap').expect(200);

    const level5 = response.body.rows.find(
      (row: { jobLevel: { code: string } }) => row.jobLevel.code === 'L5',
    );
    expect(level5.gapPercent).toBeNull();
  });
});
