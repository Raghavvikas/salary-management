import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../support/testApp.js';

let app: ReturnType<typeof buildTestApp>['app'];

beforeEach(() => {
  app = buildTestApp().app;
});

const validRaise = {
  baseAmountMajor: 75_000,
  currency: 'USD',
  effectiveFrom: '2026-02-01',
  changeReason: 'MERIT_INCREASE',
};

function violationCodes(body: { error: { details: Array<{ code: string }> } }): string[] {
  return body.error.details.map((violation) => violation.code);
}

describe('POST /api/employees/:id/salary', () => {
  it('records the raise and returns the employee with the new history', async () => {
    const response = await request(app)
      .post('/api/employees/2/salary')
      .send(validRaise)
      .expect(201);

    expect(response.body.currentSalary).toMatchObject({
      baseAmount: 75_000_00,
      currency: 'USD',
      amountUsd: 75_000_00,
      effectiveFrom: '2026-02-01',
    });
    // Grace moves from below her band into it.
    expect(response.body.bandPosition).toBe('LOWER_HALF');
    expect(response.body.salaryHistory[0].changePercent).toBe(10.29);
  });

  it('closes the previous record the day before the new one starts', async () => {
    const response = await request(app)
      .post('/api/employees/2/salary')
      .send(validRaise)
      .expect(201);

    const [current, previous] = response.body.salaryHistory;
    expect(current.effectiveTo).toBeNull();
    expect(previous.effectiveTo).toBe('2026-01-31');
  });

  it('converts a local currency raise to USD using the country rate', async () => {
    const response = await request(app)
      .post('/api/employees/4/salary')
      .send({ ...validRaise, baseAmountMajor: 5_000_000, currency: 'INR' })
      .expect(201);

    // 5,000,000 INR at 0.012 is 60,000 USD.
    expect(response.body.currentSalary.amountUsd).toBe(60_000_00);
    expect(response.body.compaRatio).toBe(0.938);
  });

  it('refuses a salary in the wrong currency', async () => {
    const response = await request(app)
      .post('/api/employees/4/salary')
      .send({ ...validRaise, currency: 'USD' })
      .expect(422);

    expect(violationCodes(response.body)).toContain('CURRENCY_MISMATCH');
  });

  it('refuses a cut that is not explained', async () => {
    const response = await request(app)
      .post('/api/employees/2/salary')
      .send({ ...validRaise, baseAmountMajor: 60_000 })
      .expect(422);

    expect(violationCodes(response.body)).toContain('DECREASE_NEEDS_REASON');
  });

  it('accepts the same cut once it is recorded as a role change with a note', async () => {
    await request(app)
      .post('/api/employees/2/salary')
      .send({
        ...validRaise,
        baseAmountMajor: 60_000,
        changeReason: 'ROLE_CHANGE',
        note: 'Moved to a four day week at their request.',
      })
      .expect(201);
  });

  it('refuses a change that would overlap the current record', async () => {
    const response = await request(app)
      .post('/api/employees/2/salary')
      .send({ ...validRaise, effectiveFrom: '2024-07-01' })
      .expect(422);

    expect(violationCodes(response.body)).toContain('EFFECTIVE_NOT_AFTER_CURRENT');
  });

  it('refuses a change for a terminated employee', async () => {
    const response = await request(app)
      .post('/api/employees/6/salary')
      .send({ ...validRaise, baseAmountMajor: 70_000 })
      .expect(422);

    expect(response.body.error.message).toMatch(/terminated/i);
  });

  it('refuses a malformed body with 400 and says which field is wrong', async () => {
    const response = await request(app)
      .post('/api/employees/2/salary')
      .send({ ...validRaise, effectiveFrom: '01-02-2026' })
      .expect(400);

    expect(response.body.error.details[0].path).toBe('effectiveFrom');
  });

  it('answers 404 for an employee who does not exist', async () => {
    await request(app).post('/api/employees/999/salary').send(validRaise).expect(404);
  });

  it('leaves the employee untouched when the change is rejected', async () => {
    await request(app)
      .post('/api/employees/2/salary')
      .send({ ...validRaise, baseAmountMajor: 60_000 })
      .expect(422);

    const after = await request(app).get('/api/employees/2').expect(200);
    expect(after.body.currentSalary.baseAmount).toBe(68_000_00);
    expect(after.body.salaryHistory).toHaveLength(2);
  });
});
