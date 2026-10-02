// Finance maths and formatting. Expected values were computed independently (Python, closed forms) so the
// tests check the code against the formulas, not against itself. Run: bun test (from app/).
import { describe, expect, test } from 'bun:test';
import {
  amortize, annuityFV, cagr, doublingYears, futureValue, growthSeries, loanPayment, minimumPayment, realValue, ruleOf72, valueAt, yearly,
} from '../src/finance/money';
import { mult, num, padToFinal, pct, pts, usd, years } from '../src/finance/format';

const cents = (x: number) => Math.round(x * 100) / 100;

describe('growth', () => {
  test('$500/mo at 8%, monthly (the STEPS / ChatGPT example)', () => {
    expect(cents(annuityFV(500, 0.08, 5))).toBe(36738.43);
    expect(cents(annuityFV(500, 0.08, 10))).toBe(91473.02);
    expect(cents(annuityFV(500, 0.08, 20))).toBe(294510.21);
    expect(cents(annuityFV(500, 0.08, 30))).toBe(745179.72);
  });
  test('$100/mo for 30 years (the prototype)', () => {
    expect(cents(annuityFV(100, 0.08, 30))).toBe(149035.94);
    const s = growthSeries({ contribution: 100, rate: 0.08, years: 30 });
    expect(s.length).toBe(361);
    expect(s.at(-1)!.contributed).toBe(36000);
    expect(cents(s.at(-1)!.balance)).toBe(149035.94);
    expect(cents(s.at(-1)!.growth)).toBe(cents(149035.94 - 36000));
  });
  test('lump sum and lump + contributions', () => {
    expect(cents(futureValue(10000, 0.08, 30))).toBe(109357.3);
    const s = growthSeries({ principal: 10000, contribution: 500, rate: 0.08, years: 30 });
    expect(cents(s.at(-1)!.balance)).toBe(854537.02);
  });
  test('series agrees with closed forms every year', () => {
    const s = growthSeries({ contribution: 500, rate: 0.08, years: 30 });
    for (const p of yearly(s)) expect(p.balance).toBeCloseTo(annuityFV(500, 0.08, p.year), 6);
  });
  test('annuity due and zero rate', () => {
    expect(annuityFV(100, 0.08, 1, 12, true)).toBeCloseTo(annuityFV(100, 0.08, 1) * (1 + 0.08 / 12), 9);
    expect(annuityFV(100, 0, 10)).toBe(12000);
    expect(growthSeries({ contribution: 100, rate: 0, years: 10 }).at(-1)!.balance).toBe(12000);
  });
  test('valueAt interpolates and clamps', () => {
    const s = growthSeries({ contribution: 100, rate: 0.08, years: 2 });
    expect(valueAt(s, 0)).toBe(0);
    expect(valueAt(s, 1)).toBeCloseTo(s[12]!.balance, 9);
    expect(valueAt(s, 99)).toBe(s.at(-1)!.balance);
    const mid = valueAt(s, 0.5 / 12 + 1); // halfway between month 12 and 13
    expect(mid).toBeCloseTo((s[12]!.balance + s[13]!.balance) / 2, 9);
  });
});

describe('loans and cards', () => {
  test('30-year mortgage payment and total interest', () => {
    const pay = loanPayment(300000, 0.065, 360);
    expect(cents(pay)).toBe(1896.2);
    const a = amortize(300000, 0.065, pay);
    expect(a.months).toBe(360);
    expect(a.paidOff).toBe(true);
    expect(Math.round(a.totalInterest)).toBe(Math.round(382633.47));
  });
  test('minimum-payment rule pays off eventually and costs more than a fixed payment', () => {
    const minRule = minimumPayment({ percent: 0.01, floor: 25, plusInterest: true });
    const a = amortize(5000, 0.24, minRule);
    const b = amortize(5000, 0.24, 250);
    expect(a.paidOff && b.paidOff).toBe(true);
    expect(a.months).toBeGreaterThan(b.months);
    expect(a.totalInterest).toBeGreaterThan(b.totalInterest);
  });
  test('a payment below the interest throws', () => {
    expect(() => amortize(10000, 0.24, 100)).toThrow();
  });
});

describe('rates and inflation', () => {
  test('real value, CAGR, doubling', () => {
    expect(cents(realValue(100000, 0.03, 30))).toBe(41198.68);
    expect(cagr(10000, 20000, 9)).toBeCloseTo(0.08005973889, 9);
    expect(doublingYears(0.08)).toBeCloseTo(9.006468342, 8);
    expect(ruleOf72(0.08)).toBe(9);
  });
});

describe('format (style guide §4)', () => {
  test('usd exact', () => {
    expect(usd(91473.02)).toBe('$91,473');
    expect(usd(36000)).toBe('$36,000');
    expect(usd(4.17)).toBe('$4.17');
    expect(usd(100)).toBe('$100');
    expect(usd(-500)).toBe('−$500');
    expect(usd(31473, { sign: true })).toBe('+$31,473');
    expect(usd(0, { sign: true })).toBe('$0');
  });
  test('usd compact', () => {
    expect(usd(745179.72, { compact: true })).toBe('$745K');
    expect(usd(1200000, { compact: true })).toBe('$1.2M');
    expect(usd(1234567, { compact: true })).toBe('$1.23M');
    expect(usd(31.4e12, { compact: true })).toBe('$31.4T');
    expect(usd(999600, { compact: true })).toBe('$1M');
    expect(usd(950, { compact: true })).toBe('$950');
    expect(usd(-2500, { compact: true })).toBe('−$2.5K');
  });
  test('pct, pts, num, mult, years', () => {
    expect(pct(0.08)).toBe('8.0%');
    expect(pct(-0.124)).toBe('−12.4%');
    expect(pct(0.032, { sign: true })).toBe('+3.2%');
    expect(pct(0.249, { decimals: 1 })).toBe('24.9%');
    expect(pts(0.015, { sign: true })).toBe('+1.5 pts');
    expect(num(-1500)).toBe('−1,500');
    expect(mult(2.4)).toBe('2.4×');
    expect(years(1990, 2025)).toBe('1990–2025');
  });
});

describe('counter padding (big-number)', () => {
  test('lays the count out in the final shape', () => {
    expect(padToFinal('$2,823', '$149,036')).toEqual(['$', '00', '2,823']);
    expect(padToFinal('$0', '$149,036')).toEqual(['$', '000,00', '0']);
    expect(padToFinal('$149,036', '$149,036')).toEqual(['', '', '$149,036']);
    expect(padToFinal('3.2%', '8.0%')).toEqual(['', '', '3.2%']);
    expect(padToFinal('$950', '$1.2M')).toEqual(['', '', '$950']);
  });
});

describe('end-label spreading (line-chart)', async () => {
  const { spreadLabels } = await import('../src/components/_kit');
  test('pushes apart, keeps order, stays in range', () => {
    // two labels at the same spot near the bottom edge: stacked upward from max, 66 apart
    expect(spreadLabels([800, 800], 66, 330, 806)).toEqual([740, 806]);
    // far apart: untouched
    expect(spreadLabels([400, 700], 66, 330, 806)).toEqual([400, 700]);
    // input order is preserved in the output
    const out = spreadLabels([700, 690, 500], 66, 330, 806);
    expect(out[2]).toBe(500);
    expect(Math.abs(out[0]! - out[1]!)).toBeGreaterThanOrEqual(66 - 1e-9);
    expect(out[0]!).toBeGreaterThan(out[1]!);
    // near the top edge: stacked downward from min
    expect(spreadLabels([300, 310], 66, 330, 806)).toEqual([330, 396]);
  });
});
