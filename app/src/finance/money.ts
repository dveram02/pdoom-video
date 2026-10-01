// Financial maths for scenes. Every number a video shows is computed here from the video's assumptions.json,
// never typed in by hand, so the script, the counters and the charts can't disagree.
// Conventions: rates are annual fractions (0.08 = 8%), compounding `n` times a year (default 12, monthly),
// contributions are made at the END of each period (ordinary annuity) unless `due` is set.

export interface GrowthOpts {
  /** Lump sum at the start. */
  principal?: number;
  /** Contribution per period (per month with the default n = 12). */
  contribution?: number;
  /** Annual rate as a fraction. */
  rate: number;
  years: number;
  /** Compounding (and contribution) periods per year. Default 12. */
  n?: number;
  /** Contributions at the start of each period instead of the end. */
  due?: boolean;
}

/** Future value of a lump sum: P(1 + r/n)^(n·t). */
export function futureValue(principal: number, rate: number, years: number, n = 12): number {
  return principal * Math.pow(1 + rate / n, n * years);
}

/** Future value of a stream of equal contributions: PMT · ((1 + i)^N − 1) / i  (× (1 + i) when due). */
export function annuityFV(contribution: number, rate: number, years: number, n = 12, due = false): number {
  const i = rate / n, N = Math.round(years * n);
  if (i === 0) return contribution * N;
  return contribution * ((Math.pow(1 + i, N) - 1) / i) * (due ? 1 + i : 1);
}

export interface GrowthPoint {
  /** Period index (0 = start). */
  period: number;
  /** Years since the start (period / n). */
  year: number;
  /** Total put in so far (principal + contributions). */
  contributed: number;
  /** Account value. */
  balance: number;
  /** balance − contributed. */
  growth: number;
}

/**
 * Period-by-period growth of a lump sum plus contributions (N + 1 points, period 0 = the start). The closed
 * forms above give the same final balance; the series is what a chart or a counter animates along.
 */
export function growthSeries(o: GrowthOpts): GrowthPoint[] {
  const n = o.n ?? 12, i = o.rate / n, N = Math.round(o.years * n);
  const pmt = o.contribution ?? 0;
  let balance = o.principal ?? 0, contributed = balance;
  const out: GrowthPoint[] = [{ period: 0, year: 0, contributed, balance, growth: 0 }];
  for (let k = 1; k <= N; k++) {
    if (o.due) { balance += pmt; contributed += pmt; }
    balance *= 1 + i;
    if (!o.due) { balance += pmt; contributed += pmt; }
    out.push({ period: k, year: k / n, contributed, balance, growth: balance - contributed });
  }
  return out;
}

/** One point per whole year (year 0, 1, … years) from a growth series. */
export function yearly(series: GrowthPoint[], n = 12): GrowthPoint[] {
  return series.filter((p) => p.period % n === 0);
}

/**
 * Value of a series at a fractional x along it (linear between points): what a counter shows while a chart's
 * line is drawing to x. `key` picks the field.
 */
export function valueAt(series: GrowthPoint[], year: number, key: 'balance' | 'contributed' | 'growth' = 'balance'): number {
  if (series.length === 0) return 0;
  const last = series[series.length - 1]!;
  if (year <= 0) return series[0]![key];
  if (year >= last.year) return last[key];
  const step = series[1]!.year - series[0]!.year;
  const k = Math.min(series.length - 2, Math.floor(year / step));
  const a = series[k]!, b = series[k + 1]!;
  return a[key] + (b[key] - a[key]) * ((year - a.year) / step);
}

/** Level payment of an amortizing loan: P · i / (1 − (1 + i)^−N), i = apr / 12. */
export function loanPayment(principal: number, apr: number, months: number): number {
  const i = apr / 12;
  if (i === 0) return principal / months;
  return (principal * i) / (1 - Math.pow(1 + i, -months));
}

export interface AmortRow { month: number; payment: number; interest: number; principal: number; balance: number }

/**
 * Month-by-month schedule of a loan or card balance paid with `payment(balance, interest, month)` per month
 * (a fixed amount, or a rule such as a card's minimum payment). Stops when paid off or after `maxMonths`.
 */
export function amortize(
  principal: number, apr: number, payment: number | ((balance: number, interest: number, month: number) => number), maxMonths = 1200,
): { rows: AmortRow[]; totalInterest: number; totalPaid: number; months: number; paidOff: boolean } {
  const i = apr / 12;
  const rows: AmortRow[] = [];
  let balance = principal, totalInterest = 0, totalPaid = 0;
  for (let m = 1; m <= maxMonths && balance > 0.005; m++) {
    const interest = balance * i;
    const due = typeof payment === 'number' ? payment : payment(balance, interest, m);
    const pay = Math.min(due, balance + interest);
    if (pay <= interest && pay < balance + interest) throw new Error(`payment ${pay.toFixed(2)} never pays down the balance (interest ${interest.toFixed(2)})`);
    balance = balance + interest - pay;
    totalInterest += interest; totalPaid += pay;
    rows.push({ month: m, payment: pay, interest, principal: pay - interest, balance: Math.max(0, balance) });
  }
  return { rows, totalInterest, totalPaid, months: rows.length, paidOff: balance <= 0.005 };
}

/**
 * A credit card's minimum payment rule: the larger of `floor` and `percent` of the balance (plus that month's
 * interest when `plusInterest`), capped at what is owed. Issuers differ: state the rule as an assumption on screen.
 */
export function minimumPayment(o: { percent: number; floor: number; plusInterest?: boolean }) {
  return (balance: number, interest: number) => Math.max(o.floor, balance * o.percent + (o.plusInterest ? interest : 0));
}

/** What `amount` in the future is worth in today's money after `years` of `inflation` (annual fraction). */
export function realValue(amount: number, inflation: number, years: number): number {
  return amount / Math.pow(1 + inflation, years);
}

/** Compound annual growth rate from `start` to `end` over `years`. */
export function cagr(start: number, end: number, years: number): number {
  return Math.pow(end / start, 1 / years) - 1;
}

/** Exact years to double at an annual rate compounded once a year (the rule of 72 approximates this). */
export function doublingYears(rate: number): number {
  return Math.log(2) / Math.log(1 + rate);
}

/** The rule of 72's estimate of doubling time (rate as a fraction). */
export const ruleOf72 = (rate: number) => 72 / (rate * 100);
