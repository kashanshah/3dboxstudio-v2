// What a product video shows, second by second. Pure maths, so the timing
// can be tested without a browser.

export type VideoMotion = 'fold' | 'turntable' | 'open-close';
export type VideoLength = 'short' | 'standard' | 'long';
export type VideoBackground = { kind: 'studio' } | { kind: 'color'; color: string };
export type VideoSettings = { motion: VideoMotion; length: VideoLength; background: VideoBackground };

export const VIDEO_MOTIONS: VideoMotion[] = ['fold', 'turntable', 'open-close'];
export const VIDEO_LENGTHS: VideoLength[] = ['short', 'standard', 'long'];
export const VIDEO_SECONDS: Record<VideoLength, number> = { short: 6, standard: 10, long: 15 };
export const DEFAULT_VIDEO_SETTINGS: VideoSettings = { motion: 'fold', length: 'standard', background: { kind: 'studio' } };

export type VideoPose = { progress: number; yaw: number; pitch: number };
type Start = { yaw: number; pitch: number };

// Fold and turn, in parts of the whole clip: hold flat, assemble, hold
// closed, one full turn, hold at the end.
const FOLD = { holdFlat: 0.06, assemble: 0.38, holdClosed: 0.06, turn: 0.45 };

/**
 * Seconds into a clip of `duration` seconds → assembly progress (0 flat,
 * 70 assembled open when the box has a lid stage, 100 closed) and camera
 * angle. The recorder frames the camera to fit the box at each progress.
 * Turntable and open-and-close end where they start, so they loop cleanly.
 */
export function videoPose(time: number, duration: number, motion: VideoMotion, start: Start, hasOpeningStage: boolean): VideoPose {
  const t = clamp01(time / duration);
  if (motion === 'turntable') return { progress: 100, yaw: start.yaw + 2 * Math.PI * t, pitch: start.pitch };
  if (motion === 'open-close') {
    // Closed, open, a beat to look inside, closed again, while turning once.
    const open = t < 0.12 ? 0 : t < 0.4 ? easeInOutSine((t - 0.12) / 0.28) : t < 0.6 ? 1 : t < 0.88 ? 1 - easeInOutSine((t - 0.6) / 0.28) : 0;
    // A box with a lid opens its lid; one without unfolds back to the flat sheet.
    const progress = hasOpeningStage ? 100 - 30 * open : 100 - 100 * open;
    return { progress, yaw: start.yaw + 2 * Math.PI * t, pitch: start.pitch };
  }
  const { holdFlat, assemble, holdClosed, turn } = FOLD;
  const assembleEnd = holdFlat + assemble;
  const turnStart = assembleEnd + holdClosed;
  const progress = 100 * easeInOutSine(clamp01((t - holdFlat) / assemble));
  // Drift a little while it assembles, then make one full turn.
  const drift = 0.35 * easeInOutSine(clamp01(t / assembleEnd));
  const spin = 2 * Math.PI * easeInOutSine(clamp01((t - turnStart) / turn));
  return { progress, yaw: start.yaw - 0.35 + drift + spin, pitch: start.pitch };
}

/** A `#rrggbb` colour, or null. */
export function videoColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function easeInOutSine(value: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * value);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
