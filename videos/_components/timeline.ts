// Component gallery: each section shows one component variant. Values are computed from assumptions.json.
import type { MakeTimeline } from '@engine/timeline';
import { amortize, growthSeries, minimumPayment } from '@engine/finance';

const timeline: MakeTimeline = ({ E, at, duration, video }) => {
  const a = video.assumptions.hundredAMonth;
  const end = growthSeries(a).at(-1)!;
  const card = video.assumptions.card;
  const debt = amortize(card.balance, card.apr, minimumPayment({ percent: card.minPercent, floor: card.minFloor, plusInterest: card.plusInterest }));
  const hypo = { note: 'Hypothetical · 8% avg annual return · not guaranteed' };

  const s1 = 0, s2 = at('Over thirty years'), s3 = at('But the account'), s4 = at('That assumes'), s5 = at('Now flip it');
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
    E('debt', 'big-number', s5, duration, {
      value: debt.totalInterest, align: 'left', color: 'bone', kicker: `$${card.balance.toLocaleString('en-US')} card · minimum payments`,
      label: 'Interest paid', sub: `${Math.round(debt.months / 12)} years to pay off`, countOn: 'Pay only', landOn: 'costs you thousands',
      delta: { value: -debt.totalInterest, label: 'to the lender' },
    }, { note: `Hypothetical · ${card.apr * 100}% APR · minimum = 1% of balance + interest, $25 floor`, source: undefined }),
  ];
};
export default timeline;
