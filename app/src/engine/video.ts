// A video project: videos/<id>/ holds everything one YouTube video needs (see videos/README.md).
// The engine renders one video at a time, picked with ?video=<id> (preview) or --video <id> (render.ts).
import { AudioData } from './audio';
import { Narration } from './narration';

/** videos/<id>/video.json */
export interface VideoMeta {
  title: string;
  /** Narration audio (voice only), relative to the video folder. */
  audio?: string;
  /** Final mix (voice + music + SFX); preferred over `audio` for the preview and the export. */
  mix?: string;
  /** Seconds kept after the last spoken word (default 3). */
  tail?: number;
  /** Explicit length in seconds (default: the audio's length, or the last word + tail). */
  duration?: number;
}

/** One entry of videos/<id>/sources.json: every real-world figure in the video cites one of these. */
export interface Source {
  id: string;
  organization: string;
  title: string;
  url?: string;
  accessed?: string;
  note?: string;
}

export interface VideoInfo {
  id: string;
  /** URL prefix of the video folder ('videos/<id>/'). */
  base: string;
  meta: VideoMeta;
  /** videos/<id>/assumptions.json: every number the video computes from (single source of truth). */
  assumptions: Record<string, any>;
  sources: Source[];
  /** URL of the audio to play/mux (mix, else narration audio), or null when there is none yet. */
  audioUrl: string | null;
  /** Folder-relative audio file name, for render.ts. */
  audioFile: string | null;
  duration: number;
}

async function json<T>(url: string): Promise<T | null> {
  const r = await fetch(url);
  return r.ok && (r.headers.get('content-type') ?? '').includes('json') ? ((await r.json()) as T) : null;
}

export async function loadVideo(id: string): Promise<{ video: VideoInfo; narration: Narration; audio: AudioData }> {
  const base = `videos/${id}/`;
  const meta = await json<VideoMeta>(`${base}video.json`);
  if (!meta) throw new Error(`video not found: ${base}video.json`);
  const [narration, analysed, assumptions, sources] = await Promise.all([
    Narration.load(`${base}narration.json`),
    AudioData.load(`${base}audio.json`),
    json<Record<string, any>>(`${base}assumptions.json`),
    json<Source[]>(`${base}sources.json`),
  ]);
  const audioFile = meta.mix ?? meta.audio ?? null;
  const spoken = narration.end + (meta.tail ?? 3);
  const duration = meta.duration ?? Math.max(spoken, analysed?.duration ?? 0, narration.meta.audioDuration ?? 0);
  const audio = analysed ?? AudioData.silent(duration);
  audio.duration = duration;
  return {
    video: { id, base, meta, assumptions: assumptions ?? {}, sources: sources ?? [], audioUrl: audioFile ? base + audioFile : null, audioFile, duration },
    narration,
    audio,
  };
}
