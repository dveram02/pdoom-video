// The engine test's edit: every cut is anchored to a phrase in the narration, never to seconds.
import type { MakeTimeline } from '@engine/timeline';

const timeline: MakeTimeline = ({ E, at, duration, video }) => {
  const growth = at('Imagine putting');
  return [
    E('intro', 'test-card', 0, growth, { kind: 'title' }),
    E('growth', 'test-card', growth, duration, { kind: 'growth', key: 'hundredAMonth', landOn: 'After thirty years' }, {
      note: 'Hypothetical · 8% avg annual return · not guaranteed',
      source: video.assumptions.hundredAMonth._label ? 'Engine test assumptions' : undefined,
    }),
  ];
};
export default timeline;
