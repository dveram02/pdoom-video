// Component gallery: each section shows one component variant. Values are computed from assumptions.json.
import type { MakeTimeline } from '@engine/timeline';
import { amortize, growthSeries, minimumPayment, yearly } from '@engine/finance';
import type { GrowthPoint } from '@engine/finance';

const timeline: MakeTimeline = ({ E, at, duration, video }) => {
  const a = video.assumptions.hundredAMonth;
  const end = growthSeries(a).at(-1)!;
  const card = video.assumptions.card;
  const debt = amortize(card.balance, card.apr, minimumPayment({ percent: card.minPercent, floor: card.minFloor, plusInterest: card.plusInterest }));
  const hypo = { note: 'Hypothetical · 8% avg annual return · not guaranteed' };

  const s1 = 0, s2 = at('Over thirty years'), s3 = at('But the account'), s4 = at('That assumes'), s5 = at('Now flip it');
  const s6 = at('Watch one hundred'), s7 = at('Sarah starts'), s8 = at('Every five years'), s9 = at('On a timeline'), s10 = at('At retirement'), s11 = at('The lesson is simple', { lead: 0.6 });

  // line chart: $100/month for 30 years, and the first year the account holds double the contributions
  const series = growthSeries(a);
  const doubled = series.find((p) => p.period > 0 && p.balance >= 2 * p.contributed)!;
  // two savers: same monthly amount, one starts 10 years later; x = age
  const sv = video.assumptions.savers;
  const saver = (startAge: number) => growthSeries({ contribution: sv.contribution, rate: sv.rate, years: sv.retireAge - startAge, n: sv.n })
    .map((p: GrowthPoint) => [startAge + p.year, p.balance] as [number, number]);
  const sarahEnd = saver(sv.sarahStart).at(-1)![1], michaelEnd = saver(sv.michaelStart).at(-1)![1];
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
      y: { format: 'usdCompact' }, // fixed $0–$150K: the curve's shape IS the point
      series: [
        { id: 'put', label: 'You put in', color: 'ash', points: series.map((p) => [p.year, p.contributed]), drawOn: 'Watch one hundred', drawTo: 'Somewhere along the way' },
        { id: 'bal', label: 'Account', color: 'gold', fill: true, points: series.map((p) => [p.year, p.balance]), drawOn: 'Watch one hundred', drawTo: 'Somewhere along the way' },
      ],
      notes: [{ series: 'bal', x: doubled.year, text: `Year ${Math.ceil(doubled.year)}: double what you put in`, on: 'double what you put in' }],
    }, hypo),
    E('savers', 'line-chart', s7, s8, {
      kicker: `Hypothetical · $${sv.contribution}/month at ${sv.rate * 100}%`, title: 'Starting 10 years later',
      x: { from: sv.sarahStart, to: sv.retireAge, label: 'Age', step: 5 },
      y: { format: 'usdCompact' },
      series: [
        { id: 'sarah', label: 'Sarah, from 25', points: saver(sv.sarahStart), drawOn: 'Sarah starts', drawTo: 'sixty-five', ease: 'linear' },
        { id: 'michael', label: 'Michael, from 35', points: saver(sv.michaelStart), drawOn: 'Michael waits', drawTo: 'sixty-five', ease: 'linear' },
      ],
    }, hypo),
    E('bars', 'stacked-bar', s8, s9, {
      kicker: 'Hypothetical · $100 a month at 8%', title: 'What you put in, and what it grew',
      segments: [{ key: 'put', label: 'You put in', color: 'ash' }, { key: 'grew', label: 'Growth', color: 'gold' }],
      bars: yearly(series).filter((p) => p.year > 0 && p.year % 5 === 0).map((p) => ({ label: `Year ${p.year}`, values: { put: p.contributed, grew: p.growth } })),
      buildOn: 'Every five years', buildTo: 'what it grew',
      breakdown: { bar: -1, on: 'most of the money' },
    }, hypo),
    E('ages', 'timeline', s9, s10, {
      kicker: 'Same $300 a month', title: 'Ten years apart',
      x: { from: 20, to: 70, step: 5, label: 'Age' },
      spans: [
        { label: 'Sarah invests', from: sv.sarahStart, to: sv.retireAge, color: 'gold', drawOn: 'Sarah invests', drawTo: 'to sixty-five' },
        { label: 'Michael invests', from: sv.michaelStart, to: sv.retireAge, color: 'blue', drawOn: 'Michael only begins', drawTo: 'ten years later' },
      ],
      markers: [
        { at: sv.sarahStart, label: 'Sarah starts', sub: `Age ${sv.sarahStart}`, on: 'Sarah invests' },
        { at: sv.michaelStart, label: 'Michael starts', sub: `Age ${sv.michaelStart}`, on: 'Michael only begins' },
        { at: sv.retireAge, label: 'Retirement', sub: `Age ${sv.retireAge}`, on: 'to sixty-five' },
      ],
    }),
    E('compare', 'comparison', s10, s11, {
      kicker: `Hypothetical · $${sv.contribution}/month at ${sv.rate * 100}%`, title: 'At 65',
      left: { label: 'Sarah', sub: `Starts at ${sv.sarahStart}`, value: sarahEnd, color: 'gold', rows: [
        { label: 'Put in', value: sv.contribution * 12 * (sv.retireAge - sv.sarahStart) },
        { label: 'Years investing', value: sv.retireAge - sv.sarahStart, format: 'num' },
      ] },
      right: { label: 'Michael', sub: `Starts at ${sv.michaelStart}`, value: michaelEnd, color: 'blue', rows: [
        { label: 'Put in', value: sv.contribution * 12 * (sv.retireAge - sv.michaelStart) },
        { label: 'Years investing', value: sv.retireAge - sv.michaelStart, format: 'num' },
      ] },
      countOn: 'At retirement', landOn: 'four hundred forty-seven thousand',
      gap: { label: 'The cost of waiting 10 years', on: 'Waiting ten years', ratio: true },
    }, hypo),
    E('chapter', 'chapter-card', s11, at('Time does')),
    E('takeaway', 'key-takeaway', at('Time does'), duration, { text: 'Time does the heavy lifting.', highlight: 'Time', on: 'Time does' }),
  ];
};
export default timeline;
