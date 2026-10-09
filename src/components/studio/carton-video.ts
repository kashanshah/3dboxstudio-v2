import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { templateAssemblyValuesForProgress } from '@/lib/packaging/template-runtime';
import type { CartonRenderer } from './carton-renderer';
import type { Scene } from './carton-scene';

// A short product video, rendered frame by frame (never in real time, so it
// is smooth on any device) and encoded in the browser as H.264 MP4.

export class VideoExportUnsupportedError extends Error {
  constructor() {
    super('This browser cannot encode video. Use a recent Chrome, Edge, Safari or Firefox.');
    this.name = 'VideoExportUnsupportedError';
  }
}

export type VideoOptions = { width: number; height: number; fps?: number };

const TIMELINE = {
  holdFlat: 0.6,
  assemble: 3.6,
  holdClosed: 0.6,
  turn: 4.2,
  holdEnd: 0.5,
};

/** Seconds into the clip → what the carton and camera are doing. */
export function videoPose(time: number, start: { yaw: number; pitch: number }) {
  const { holdFlat, assemble, holdClosed, turn } = TIMELINE;
  const assembleEnd = holdFlat + assemble;
  const turnStart = assembleEnd + holdClosed;
  const progress = 100 * easeInOutSine(clamp01((time - holdFlat) / assemble));
  // Drift a little while it assembles, then make one full turn.
  const drift = 0.35 * easeInOutSine(clamp01(time / assembleEnd));
  const spin = 2 * Math.PI * easeInOutSine(clamp01((time - turnStart) / turn));
  // Start wide enough for the flat sheet, then push in on the finished box.
  const zoom = 78 + 22 * easeInOutSine(progress / 100);
  return { progress, yaw: start.yaw - 0.35 + drift + spin, pitch: start.pitch, zoom };
}

export function videoDuration() {
  return Object.values(TIMELINE).reduce((sum, value) => sum + value, 0);
}

// H.264 plays everywhere. Browsers built without an H.264 encoder (some
// Chromium builds) fall back to VP9 in the same MP4 container.
const CODECS = [
  { codec: 'avc1.640028', container: 'avc' },
  { codec: 'avc1.4d0028', container: 'avc' },
  { codec: 'avc1.42e028', container: 'avc' },
  { codec: 'vp09.00.40.08', container: 'vp9' },
] as const;

async function pickCodec(width: number, height: number, fps: number, bitrate: number) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new VideoExportUnsupportedError();
  for (const option of CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({ codec: option.codec, width, height, bitrate, framerate: fps });
      if (supported) return option;
    } catch {
      // Try the next profile.
    }
  }
  throw new VideoExportUnsupportedError();
}

export async function recordCartonVideo(renderer: CartonRenderer, { width, height, fps = 30 }: VideoOptions, onProgress?: (fraction: number) => void) {
  const bitrate = Math.round(width * height * fps * 0.14);
  const { codec, container } = await pickCodec(width, height, fps, bitrate);
  const live: Scene = renderer.currentScene();
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: container, width, height, frameRate: fps }, fastStart: 'in-memory' });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: error => { failure = error; },
  });
  encoder.configure({ codec, width, height, bitrate, framerate: fps });

  const frames = Math.round(videoDuration() * fps);
  const frameDuration = 1_000_000 / fps;
  renderer.beginCapture(width, height);
  try {
    for (let index = 0; index < frames; index++) {
      if (failure) throw failure;
      const pose = videoPose(index / fps, live);
      const assembly = templateAssemblyValuesForProgress(live.templateId, pose.progress, live.openingMode);
      const canvas = renderer.captureFrame({ ...assembly, yaw: pose.yaw, pitch: pose.pitch, zoom: pose.zoom, viewPan: { x: 0, y: 0 } });
      const frame = new VideoFrame(canvas, { timestamp: Math.round(index * frameDuration), duration: Math.round(frameDuration) });
      encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
      frame.close();
      // Keep memory flat and the page responsive while frames encode.
      while (encoder.encodeQueueSize > 6) await new Promise(resolve => setTimeout(resolve, 4));
      if (index % 5 === 0) {
        onProgress?.(index / frames);
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
      }
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    renderer.endCapture();
    if (encoder.state !== 'closed') encoder.close();
  }
  muxer.finalize();
  onProgress?.(1);
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

function easeInOutSine(value: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * value);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
