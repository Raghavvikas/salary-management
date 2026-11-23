import { describe, expect, it } from 'vitest';
import {
  applyPercentage,
  convertToUsd,
  formatMoney,
  fromMajor,
  money,
  MoneyError,
  percentageChange,
  roundHalfUp,
  sumMoney,
  toMajor,
} from '../../src/domain/money.js';

describe('money', () => {
  it('rejects fractional minor units', () => {
    expect(() => money(10.5, 'USD')).toThrow(MoneyError);
  });

  it('rejects anything that is not a 3 letter currency code', () => {
    expect(() => money(100, 'usd')).toThrow(MoneyError);
    expect(() => money(100, 'DOLLAR')).toThrow(MoneyError);
  });

  it('converts between major and minor units without drift', () => {
    const salary = fromMajor(85_000.5, 'USD');
    expect(salary.amountMinor).toBe(8_500_050);
    expect(toMajor(salary)).toBe(85_000.5);
  });

  it('rounds half away from zero', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(2.4)).toBe(2);
  });

  it('survives the classic float trap', () => {
    const total = sumMoney([fromMajor(0.1, 'USD'), fromMajor(0.2, 'USD')], 'USD');
    expect(toMajor(total)).toBe(0.3);
  });
});

describe('convertToUsd', () => {
  it('applies the rate to minor units', () => {
    // 1,200,000 INR a year at 0.012 USD per INR -> 14,400 USD.
    const inr = fromMajor(1_200_000, 'INR');
    expect(convertToUsd(inr, 0.012)).toEqual({ amountMinor: 1_440_000, currency: 'USD' });
  });

  it('refuses a non positive rate', () => {
    expect(() => convertToUsd(fromMajor(100, 'GBP'), 0)).toThrow(MoneyError);
    expect(() => convertToUsd(fromMajor(100, 'GBP'), -1.2)).toThrow(MoneyError);
  });

  it('refuses to convert USD with anything other than a rate of 1', () => {
    expect(() => convertToUsd(fromMajor(100, 'USD'), 1.1)).toThrow(MoneyError);
    expect(convertToUsd(fromMajor(100, 'USD'), 1).amountMinor).toBe(10_000);
  });
});

describe('applyPercentage', () => {
  it('applies a merit increase', () => {
    expect(applyPercentage(fromMajor(100_000, 'USD'), 4.5)).toEqual(
      fromMajor(104_500, 'USD'),
    );
  });

  it('rounds the half cent up rather than truncating it', () => {
    // 10,000.01 USD + 5% = 10,500.0105 -> 10,500.01
    expect(applyPercentage(fromMajor(10_000.01, 'USD'), 5).amountMinor).toBe(1_050_001);
  });
});

describe('percentageChange', () => {
  it('reports a raise to two decimals', () => {
    expect(percentageChange(fromMajor(90_000, 'USD'), fromMajor(99_000, 'USD'))).toBe(10);
    expect(percentageChange(fromMajor(90_000, 'USD'), fromMajor(93_150, 'USD'))).toBe(3.5);
  });

  it('reports a cut as a negative number', () => {
    expect(percentageChange(fromMajor(100_000, 'USD'), fromMajor(95_000, 'USD'))).toBe(-5);
  });

  it('refuses to mix currencies', () => {
    expect(() => percentageChange(fromMajor(1, 'USD'), fromMajor(1, 'EUR'))).toThrow(
      MoneyError,
    );
  });
});

describe('formatMoney', () => {
  it('formats whole currency units for the UI', () => {
    expect(formatMoney(fromMajor(125_000, 'USD'))).toBe('$125,000');
  });
});
