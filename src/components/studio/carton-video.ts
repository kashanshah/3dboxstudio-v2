import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { getTemplateAssemblyState, templateAssemblyValuesForProgress } from '@/lib/packaging/template-runtime';
import { DEFAULT_VIDEO_SETTINGS, VIDEO_SECONDS, videoPose, type VideoSettings } from '@/lib/packaging/video-timeline';
import type { CartonRenderer } from './carton-renderer';
import type { Scene } from './carton-scene';
import { framingMeshes, screenReach, zoomForReach } from './carton-framing';

// A short product video, rendered frame by frame (never in real time, so it
// is smooth on any device) and encoded in the browser as H.264 MP4.

export class VideoExportUnsupportedError extends Error {
  constructor() {
    super('This browser cannot encode video. Use a recent Chrome, Edge, Safari or Firefox.');
    this.name = 'VideoExportUnsupportedError';
  }
}

export type VideoOptions = { width: number; height: number; fps?: number; settings?: VideoSettings };

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

export async function recordCartonVideo(renderer: CartonRenderer, { width, height, fps = 30, settings = DEFAULT_VIDEO_SETTINGS }: VideoOptions, onProgress?: (fraction: number) => void) {
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

  const duration = VIDEO_SECONDS[settings.length];
  const { hasOpeningStage } = getTemplateAssemblyState(live.templateId, { formation: 100, opening: 0, openingMode: live.openingMode });
  const frames = Math.round(duration * fps);
  const frameDuration = 1_000_000 / fps;
  const zoomAt = framing(live, width / height);
  renderer.beginCapture(width, height, settings.background);
  try {
    for (let index = 0; index < frames; index++) {
      if (failure) throw failure;
      const pose = videoPose(index / fps, duration, settings.motion, live, hasOpeningStage);
      const assembly = templateAssemblyValuesForProgress(live.templateId, pose.progress, live.openingMode);
      const canvas = renderer.captureFrame({ ...assembly, yaw: pose.yaw, pitch: pose.pitch, zoom: zoomAt(pose.progress), viewPan: { x: 0, y: 0 } });
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

const FIT_SAMPLES = 40;

/**
 * Assembly progress → camera zoom that keeps the whole box in frame: wide for
 * the flat sheet and a raised lid, close on the finished box. Reach is
 * sampled once per clip (the turn does not change it, so the zoom never
 * pulses as the box spins); each sample takes the largest of its neighbours so
 * a lid that jumps up between samples is never cut off.
 */
function framing(scene: Scene, aspect: number) {
  const raw = Array.from({ length: FIT_SAMPLES + 1 }, (_, i) => {
    const values = templateAssemblyValuesForProgress(scene.templateId, 100 * i / FIT_SAMPLES, scene.openingMode);
    try {
      return screenReach(framingMeshes(scene, values.formation, values.opening), scene.pitch, aspect);
    } catch {
      return 0;
    }
  });
  const reach = raw.map((value, i) => Math.max(raw[i - 1] ?? value, value, raw[i + 1] ?? value));
  return (progress: number) => {
    const position = Math.min(1, Math.max(0, progress / 100)) * FIT_SAMPLES;
    const below = Math.floor(position), above = Math.min(FIT_SAMPLES, below + 1);
    return zoomForReach(scene, reach[below] + (reach[above] - reach[below]) * (position - below), aspect);
  };
}
