// Timeline registry: every video's edit lives in videos/<id>/timeline.ts and is built from the components in
// src/components/. Cues are anchored to the narration (phrases), never to hard-coded seconds, so a re-recorded
// voice re-times the whole edit.
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Narration, Phrase, Line } from './engine/narration';
import type { AudioData } from './engine/audio';
import type { VideoInfo } from './engine/video';

// Component and timeline modules are discovered lazily so a missing/broken one never breaks the build.
const components = import.meta.glob<{ default: SceneClass }>('./components/*.ts');
const timelines = import.meta.glob<{ default: MakeTimeline }>('../../videos/*/timeline.ts');

/** Video ids that have a timeline, sorted; ids starting with '_' (tests, scratch) sort last. */
export const videoIds = Object.keys(timelines)
  .map((k) => k.split('/').at(-2)!)
  .sort((a, b) => Number(a.startsWith('_')) - Number(b.startsWith('_')) || a.localeCompare(b));

/** Extra fields a timeline entry may carry besides the engine's (see TimelineEntry). */
export type EntryExtra = Partial<Omit<TimelineEntry, 'id' | 'load' | 'start' | 'end'>>;

export interface TimelineKit {
  video: VideoInfo;
  n: Narration;
  audio: AudioData;
  /** Video length in seconds. */
  duration: number;
  /** nth occurrence of a phrase (whole words, in order, ignoring case and punctuation). */
  phrase(q: string, nth?: number): Phrase;
  /** Start of a phrase, minus `lead` seconds (cut a little before the word: default 0.1). */
  at(q: string, opts?: { nth?: number; lead?: number }): number;
  /** End of a phrase plus `pad` seconds (default 0). */
  after(q: string, opts?: { nth?: number; pad?: number }): number;
  /** The nth sentence containing `q`. */
  sentence(q: string, nth?: number): Line;
  /** A timeline entry: component module name (src/components/<component>.ts), window, params for ctx.params. */
  E(id: string, component: string, start: number, end: number, params?: Record<string, any>, extra?: EntryExtra): TimelineEntry;
}

export type MakeTimeline = (k: TimelineKit) => TimelineEntry[];

export async function loadTimeline(video: VideoInfo, n: Narration, audio: AudioData): Promise<TimelineEntry[]> {
  const mod = timelines[`../../videos/${video.id}/timeline.ts`];
  if (!mod) throw new Error(`no timeline for video '${video.id}': create videos/${video.id}/timeline.ts`);
  const make = (await mod()).default;
  const load = (name: string) => () => {
    const m = components[`./components/${name}.ts`];
    return m ? m() : Promise.reject(new Error(`component not found: src/components/${name}.ts`));
  };
  const kit: TimelineKit = {
    video, n, audio, duration: video.duration,
    phrase: (q, nth = 0) => n.phrase(q, nth),
    at: (q, o = {}) => Math.max(0, n.phrase(q, o.nth ?? 0).start - (o.lead ?? 0.1)),
    after: (q, o = {}) => n.phrase(q, o.nth ?? 0).end + (o.pad ?? 0),
    sentence: (q, nth = 0) => n.get(q, nth),
    E: (id, component, start, end, params = {}, extra = {}) => ({ id, load: load(component), start, end, params, component, ...extra }),
  };
  return make(kit);
}
