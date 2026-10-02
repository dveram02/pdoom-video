// Component gallery: each section shows one component variant. Values are computed from assumptions.json.
import type { MakeTimeline } from '@engine/timeline';
import { amortize, growthSeries, minimumPayment } from '@engine/finance';
import type { GrowthPoint } from '@engine/finance';

const timeline: MakeTimeline = ({ E, at, duration, video }) => {
  const a = video.assumptions.hundredAMonth;
  const end = growthSeries(a).at(-1)!;
  const card = video.assumptions.card;
  const debt = amortize(card.balance, card.apr, minimumPayment({ percent: card.minPercent, floor: card.minFloor, plusInterest: card.plusInterest }));
  const hypo = { note: 'Hypothetical · 8% avg annual return · not guaranteed' };

  const s1 = 0, s2 = at('Over thirty years'), s3 = at('But the account'), s4 = at('That assumes'), s5 = at('Now flip it');
  const s6 = at('Watch one hundred'), s7 = at('Sarah starts');

  // line chart: $100/month for 30 years, and the first year the account holds double the contributions
  const series = growthSeries(a);
  const doubled = series.find((p) => p.period > 0 && p.balance >= 2 * p.contributed)!;
  // two savers: same monthly amount, one starts 10 years later; x = age
  const sv = video.assumptions.savers;
  const saver = (startAge: number) => growthSeries({ contribution: sv.contribution, rate: sv.rate, years: sv.retireAge - startAge, n: sv.n })
    .map((p: GrowthPoint) => [startAge + p.year, p.balance] as [number, number]);
  return [
    E('reveal', 'big-number', s1, s2, { value: a.contribution, from: a.contribution, label: 'Every month', countOn: 0 }),
    E('contributions', 'big-number', s2, s3, {
      value: end.contributed, color: 'bone', kicker: 'Over 30 years', label: 'You put in', landOn: 'thirty-six thousand',
    }),
    E('growth', 'big-number', s3, s4, {
      value: end.balance, kicker: 'After 30 years', label: 'Account value', landOn: 'one hundred forty-nine thousand',
      delta: { value: end.growth, label: 'growth' },
    }, hypo),
    E('rate', 'big-number', s4, s5, { value: a.rate, from: 0, format: 'pct', color: 'bone', suffix: '/ yr', label: 'Avg annual return · hypothetical', landOn: 'eight percent' }, hypo),
    E('debt', 'big-number', s5, s6, {
      value: debt.totalInterest, align: 'left', color: 'bone', kicker: `$${card.balance.toLocaleString('en-US')} card · minimum payments`,
      label: 'Interest paid', sub: `${Math.round(debt.months / 12)} years to pay off`, countOn: 'Pay only', landOn: 'costs you thousands',
      delta: { value: -debt.totalInterest, label: 'to the lender' },
    }, { note: `Hypothetical · ${card.apr * 100}% APR · minimum = 1% of balance + interest, $25 floor`, source: undefined }),
    E('line', 'line-chart', s6, s7, {
      kicker: 'Hypothetical · 8% a year', title: '$100 a month for 30 years',
      x: { from: 0, to: a.years, label: 'Years', step: 5 },
      y: { format: 'usdCompact', follow: true },
      series: [
        { id: 'put', label: 'You put in', color: 'ash', points: series.map((p) => [p.year, p.contributed]), drawOn: 'Watch one hundred', drawTo: 'Somewhere along the way' },
        { id: 'bal', label: 'Account', color: 'gold', fill: true, points: series.map((p) => [p.year, p.balance]), drawOn: 'Watch one hundred', drawTo: 'Somewhere along the way' },
      ],
      notes: [{ series: 'bal', x: doubled.year, text: `Year ${Math.ceil(doubled.year)}: double what you put in`, on: 'double what you put in' }],
    }, hypo),
    E('savers', 'line-chart', s7, duration, {
      kicker: `Hypothetical · $${sv.contribution}/month at ${sv.rate * 100}%`, title: 'Starting 10 years later',
      x: { from: sv.sarahStart, to: sv.retireAge, label: 'Age', step: 5 },
      y: { format: 'usdCompact' },
      series: [
        { id: 'sarah', label: 'Sarah, from 25', points: saver(sv.sarahStart), drawOn: 'Sarah starts', drawTo: 'sixty-five', ease: 'linear' },
        { id: 'michael', label: 'Michael, from 35', points: saver(sv.michaelStart), drawOn: 'Michael waits', drawTo: 'sixty-five', ease: 'linear' },
      ],
    }, hypo),
  ];
};
export default timeline;
