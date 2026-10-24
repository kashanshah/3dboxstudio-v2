'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { ArtworkByPanel } from '@/lib/packaging/artwork';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { trackEvent } from '@/lib/analytics';
import { cameraForPreset, clamp, easeInOutCubic, shortestAngleDelta, type RenderStyle } from './carton-scene';
import type { CartonRenderer } from './carton-renderer';
import { getTemplateRuntime } from '@/lib/packaging/template-runtime';
import type { VideoSettings } from '@/lib/packaging/video-timeline';
import { zipFiles, type ImageSettings } from '@/lib/packaging/image-export';

export { buildMeshes, studioViewProjection, type BoxMeshOptions, type RenderStyle } from './carton-scene';

/** Longest side of an exported PNG. Phones get a size their GPU memory can hold. */

const THUMBNAIL_WIDTHS = [320, 240, 180, 120];
// Under the server's 250,000-character limit for a saved preview, with headroom.
const MAX_THUMBNAIL_CHARS = 200_000;

// Report a missing or lost WebGL context once per page, not once per canvas.
let renderFailureReported = false;
function reportRenderFailure(reason: 'unavailable' | 'lost' | 'load_failed', templateId: string) {
  if (renderFailureReported) return;
  renderFailureReported = true;
  trackEvent('preview_render_failed', { reason, template_id: templateId, app_version: 'v2' });
}

// A size too small to fold, reported once per template and page: typing
// through such sizes is common and shouldn't flood the events.
const unfoldableReported = new Set<string>();
function reportUnfoldable(templateId: string, message: string) {
  if (unfoldableReported.has(templateId)) return;
  unfoldableReported.add(templateId);
  trackEvent('preview_render_failed', { reason: 'unfoldable_size', template_id: templateId, error_message: message.slice(0, 200), app_version: 'v2' });
}

export type CartonEngineHandle = {
  thumbnail: () => string | null;
  exportImage: (settings: ImageSettings) => Promise<boolean>;
  /** Renders and downloads an MP4 of the box assembling and turning. Rejects when video is unsupported. */
  exportVideo: (filename: string, settings: VideoSettings, onProgress?: (fraction: number) => void) => Promise<boolean>;
  resetCamera: () => void;
  /**
   * Draws the box at this formation and opening without waiting for new
   * props: an animation runs it every frame and sets the props once at the end.
   */
  showAssembly: (formation: number, opening: number) => void;
  /** Back to the formation and opening props, after an animation stops early. */
  releaseAssembly: () => void;
};

type Props = {
  dimensions: CartonDimensions;
  templateId: string;
  opening: number;
  formation?: number;
  openingMode?: LegacyOpeningMode;
  splitTopHingeSide?: 'side_a' | 'side_b';
  material: string;
  outsideColor?: string | null;
  insideColor?: string | null;
  artworkByPanel: ArtworkByPanel;
  cameraPreset: string;
  zoom: number;
  viewPan?: {x:number;y:number};
  panEnabled?: boolean;
  onViewPanChange?: (pan:{x:number;y:number})=>void;
  onZoomChange?: React.Dispatch<React.SetStateAction<number>>;
  lightIntensity?: number;
  onPanelSelect?: (panel: string, point: { x: number; y: number }) => void;
  /** Lit product render, or the flat colour-proofing view. */
  renderStyle?: RenderStyle;
  /** Soft shadow under the carton in the lit view. */
  floorShadow?: boolean;
  /**
   * Measurement labels for the box's width (x), height (y) and depth (z),
   * drawn along its nearest edges; null hides them.
   */
  measures?: { x: ReactNode; y: ReactNode; z: ReactNode } | null;
  /** Shown in place of the measurements while they can't be drawn (a flat or half-folded box). */
  measuresHint?: string | null;
  /**
   * Flap sizes laid on the flaps themselves: each on the first of its
   * panels (3D panel names, best first) that can be seen from the camera.
   */
  flapMeasures?: { key: string; panels: string[]; node: ReactNode }[] | null;
};

type Point = { x: number; y: number };
type MeasureLine = { axis: 'x' | 'y' | 'z'; from: Point; to: Point; start: Point; end: Point; label: Point };

/**
 * Where to draw the width, height and depth lines for a box whose corners
 * are at these canvas positions (index bits: 1 = max x, 2 = max y, 4 = max z):
 * width and depth along the bottom edges nearest the viewer, height up the
 * front corner at the far end of the width line, each set a little outside.
 */
function measureLines(corners: (Point & { distance: number })[]): MeasureLine[] {
  const centre = corners.reduce((sum, corner) => ({ x: sum.x + corner.x / 8, y: sum.y + corner.y / 8 }), { x: 0, y: 0 });
  const nearer = (a: [number, number], b: [number, number]) => (corners[a[0]].distance + corners[a[1]].distance <= corners[b[0]].distance + corners[b[1]].distance ? a : b);
  const widthEdge = nearer([0, 1], [4, 5]);
  const depthEdge = nearer([0, 4], [1, 5]);
  // The width edge's corner not on the depth edge carries the height.
  const shared = widthEdge.find(index => depthEdge.includes(index))!;
  const foot = widthEdge.find(index => index !== shared)!;
  const heightEdge: [number, number] = [foot, foot | 2];
  const line = (axis: MeasureLine['axis'], [a, b]: [number, number]): MeasureLine => {
    const start = corners[a], end = corners[b];
    const along = { x: end.x - start.x, y: end.y - start.y };
    const length = Math.hypot(along.x, along.y) || 1;
    let normal = { x: -along.y / length, y: along.x / length };
    const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    if ((middle.x - centre.x) * normal.x + (middle.y - centre.y) * normal.y < 0) normal = { x: -normal.x, y: -normal.y };
    const offset = 22;
    const shift = (point: Point, by: number) => ({ x: point.x + normal.x * by, y: point.y + normal.y * by });
    return { axis, start: shift(start, 4), end: shift(end, 4), from: shift(start, offset), to: shift(end, offset), label: shift(middle, offset) };
  };
  return [line('x', widthEdge), line('z', depthEdge), line('y', heightEdge)];
}


// A shared default, so a preview without its own pan does not count as a
// changed scene (and redraw) every time its parent renders.
const NO_PAN = { x: 0, y: 0 };

export const CartonEngine = forwardRef<CartonEngineHandle, Props>(function CartonEngine(
  { dimensions, templateId, opening, formation = 100, openingMode = 'closed', splitTopHingeSide = 'side_a', material, outsideColor = null, insideColor = null, artworkByPanel, cameraPreset, zoom, viewPan = NO_PAN, panEnabled = false, onViewPanChange, lightIntensity = 0, onPanelSelect, renderStyle = 'realistic', floorShadow = true, measures = null, measuresHint = null, flapMeasures = null },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CartonRenderer | null>(null);
  const [glStatus, setGlStatus] = useState<'ok' | 'unavailable' | 'lost'>('ok');
  // Bumped when a renderer is (re)created so the scene is pushed to it again.
  const [rendererVersion, setRendererVersion] = useState(0);
  const templateIdRef = useRef(templateId);
  templateIdRef.current = templateId;
  const [yaw, setYaw] = useState(-0.55);
  const [pitch, setPitch] = useState(0.28);
  const [hoverPanel, setHoverPanel] = useState<string | null>(null);
  const yawRef = useRef(-0.55);
  const pitchRef = useRef(0.28);
  const cameraAnimationRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; panX:number; panY:number; mode:'rotate'|'pan'; moved: boolean } | null>(null);

  const cancelCameraAnimation = useCallback(() => {
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
  }, []);

  const animateCameraTo = useCallback((targetYaw: number, targetPitch: number) => {
    cancelCameraAnimation();

    const startYaw = yawRef.current;
    const startPitch = pitchRef.current;
    const yawDelta = shortestAngleDelta(startYaw, targetYaw);
    const pitchDelta = targetPitch - startPitch;
    const startedAt = performance.now();
    const duration = 520;

    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      const nextYaw = startYaw + yawDelta * eased;
      const nextPitch = startPitch + pitchDelta * eased;

      yawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      setYaw(nextYaw);
      setPitch(nextPitch);

      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(frame);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    cameraAnimationRef.current = requestAnimationFrame(frame);
  }, [cancelCameraAnimation]);

  const resetCamera = useCallback(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useImperativeHandle(ref, () => ({
    showAssembly(formation: number, opening: number) {
      shownAssemblyRef.current = { formation, opening, from: { formation: formationRef.current, opening: openingRef.current } };
      const renderer = rendererRef.current;
      if (renderer) renderer.setScene({ ...renderer.currentScene(), formation, opening });
    },
    releaseAssembly() {
      if (!shownAssemblyRef.current) return;
      shownAssemblyRef.current = null;
      const renderer = rendererRef.current;
      if (renderer) renderer.setScene({ ...renderer.currentScene(), formation: formationRef.current, opening: openingRef.current });
    },
    thumbnail() {
      const source = canvasRef.current;
      if (!source || !source.width || !source.height) return null;
      rendererRef.current?.render();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      // Saves reject previews over 250,000 characters, and a detailed render on
      // a real GPU can exceed that at full size, so step the width down until it fits.
      let preview = '';
      for (const width of THUMBNAIL_WIDTHS) {
        canvas.width = width;
        canvas.height = Math.max(1, Math.round(width * source.height / source.width));
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        preview = canvas.toDataURL('image/png');
        if (preview.length <= MAX_THUMBNAIL_CHARS) break;
      }
      return preview;
    },
    async exportImage(settings) {
      const renderer = rendererRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return false;
      const { renderCartonImages } = await import('./carton-image');
      const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
      const images = await renderCartonImages(renderer, settings, { aspect: Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight), coarse });
      if (!images.length) return false;
      if (images.length === 1) downloadBlob(images[0].blob, images[0].name);
      else {
        const files = await Promise.all(images.map(async image => ({ name: image.name, data: new Uint8Array(await image.blob.arrayBuffer()) })));
        downloadBlob(new Blob([zipFiles(files)], { type: 'application/zip' }), `3d-box-studio-${renderer.currentScene().templateId}-views.zip`);
      }
      return true;
    },
    async exportVideo(filename, settings, onProgress) {
      const renderer = rendererRef.current;
      if (!renderer) return false;
      const { recordCartonVideo } = await import('./carton-video');
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const blob = await recordCartonVideo(renderer, { ...(coarse ? { width: 1280, height: 720 } : { width: 1920, height: 1080 }), settings }, onProgress);
      downloadBlob(blob, filename);
      return true;
    },
    resetCamera,
  }), [resetCamera]);

  useEffect(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: CartonRenderer | null = null;
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
    let observer: ResizeObserver | null = null;
    let disposed = false;

    const start = async () => {
      let rendererModule: typeof import('./carton-renderer');
      try {
        // three.js is only downloaded where a 3D preview is actually shown.
        rendererModule = await import('./carton-renderer');
      } catch {
        if (disposed) return;
        setGlStatus('unavailable');
        reportRenderFailure('load_failed', templateIdRef.current);
        return;
      }
      if (disposed) return;
      try {
        renderer = rendererModule.createCartonRenderer(canvas);
      } catch {
        renderer = null;
      }
      if (!renderer) {
        setGlStatus('unavailable');
        reportRenderFailure('unavailable', templateIdRef.current);
        return;
      }
      const active = renderer;
      gl = active.gl;
      rendererRef.current = active;
      setGlStatus('ok');
      setRendererVersion(version => version + 1);
      observer = new ResizeObserver(() => active.resize());
      observer.observe(canvas);
    };
    const stop = () => {
      observer?.disconnect();
      observer = null;
      renderer?.dispose();
      renderer = null;
      rendererRef.current = null;
    };
    const onLost = (event: Event) => {
      // preventDefault asks the browser to restore the context when it can.
      event.preventDefault();
      stop();
      setGlStatus('lost');
      reportRenderFailure('lost', templateIdRef.current);
    };
    const onRestored = () => { void start(); };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    void start();

    return () => {
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      cancelCameraAnimation();
      stop();
      // Browsers keep only ~16 live WebGL contexts and silently drop the oldest,
      // so free this one as soon as the canvas is really gone (not on a
      // Strict Mode remount, where the same canvas is reused).
      window.setTimeout(() => {
        if (!canvas.isConnected) gl?.getExtension('WEBGL_lose_context')?.loseContext();
      }, 0);
    };
  }, [cancelCameraAnimation]);

  // An animation's frame, kept until the formation or opening props move on,
  // so a redraw for another reason (hovering a panel) doesn't jump back.
  const shownAssemblyRef = useRef<{ formation: number; opening: number; from: { formation: number | undefined; opening: number } } | null>(null);
  const formationRef = useRef(formation);
  const openingRef = useRef(opening);
  formationRef.current = formation;
  openingRef.current = opening;

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const shown = shownAssemblyRef.current;
    if (shown && (shown.from.formation !== formation || shown.from.opening !== opening)) shownAssemblyRef.current = null;
    const held = shownAssemblyRef.current;
    renderer.setScene({
      dimensions,
      templateId,
      opening: held ? held.opening : opening,
      formation: held ? held.formation : formation,
      openingMode,
      splitTopHingeSide,
      material,
      outsideColor,
      insideColor,
      artworkByPanel,
      yaw,
      pitch,
      zoom,
      viewPan,
      lightIntensity,
      hoverPanel,
      renderStyle,
      floorShadow,
    });
  }, [rendererVersion, dimensions, templateId, opening, formation, openingMode, splitTopHingeSide, material, outsideColor, insideColor, artworkByPanel, yaw, pitch, zoom, viewPan, lightIntensity, hoverPanel, renderStyle, floorShadow]);

  // A size the sheet can't be folded at keeps the last box that folds on
  // screen, with the template's own reason the size can't be made.
  const [unfoldable, setUnfoldable] = useState<string | null>(null);
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    return renderer.onUnfoldable(problem => {
      if (!problem) { setUnfoldable(null); return; }
      const { error, scene } = problem;
      reportUnfoldable(scene.templateId, error.message);
      const reason = getTemplateRuntime(scene.templateId)?.getSizeProblems?.(scene.dimensions, { openingMode: scene.openingMode, splitTopHingeSide: scene.splitTopHingeSide })[0];
      setUnfoldable(reason ?? 'This size is too small to fold.');
    });
  }, [rendererVersion]);

  // Measurement lines follow the box through every frame drawn: orbiting,
  // zooming and resizing. They hide while an animation moves the box.
  const [lines, setLines] = useState<MeasureLine[] | null>(null);
  const [flapSpots, setFlapSpots] = useState<{ key: string; panel: string; x: number; y: number }[]>([]);
  const showMeasures = Boolean(measures);
  // The flaps to look for, read on each frame without restarting the subscription.
  const flapPanelsRef = useRef<{ key: string; panels: string[] }[]>([]);
  flapPanelsRef.current = flapMeasures?.map(({ key, panels }) => ({ key, panels })) ?? [];
  const showFlapMeasures = Boolean(flapMeasures?.length);
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || (!showMeasures && !showFlapMeasures)) { setLines(null); setFlapSpots([]); return; }
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const animating = Boolean(shownAssemblyRef.current);
      const corners = !showMeasures || animating ? null : renderer.projectBounds();
      setLines(corners ? measureLines(corners) : null);
      const spots = animating ? [] : flapPanelsRef.current.flatMap(({ key, panels }) => {
        const seen = renderer.projectPanels(panels).find(spot => spot?.visible);
        return seen ? [{ key, panel: seen.name, x: seen.x, y: seen.y }] : [];
      });
      setFlapSpots(previous => (JSON.stringify(previous) === JSON.stringify(spots) ? previous : spots));
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(update); };
    schedule();
    const unsubscribe = renderer.onRender(schedule);
    return () => { unsubscribe(); if (frame !== null) cancelAnimationFrame(frame); };
  }, [rendererVersion, showMeasures, showFlapMeasures]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    cancelCameraAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: yawRef.current, pitch: pitchRef.current, panX:viewPan.x, panY:viewPan.y, mode:panEnabled?'pan':'rotate', moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if(drag.mode==='pan'){
        onViewPanChange?.({x:drag.panX+dx,y:drag.panY+dy});
      }else{
        const nextYaw = drag.yaw - dx * 0.008;
        const nextPitch = clamp(drag.pitch + dy * 0.006, -1.15, 1.15);
        yawRef.current = nextYaw;
        pitchRef.current = nextPitch;
        setYaw(nextYaw);
        setPitch(nextPitch);
      }
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const hovered = rendererRef.current?.pickPanel(event.clientX - rect.left, event.clientY - rect.top) ?? null;
    setHoverPanel(hovered);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag?.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const panel = rendererRef.current?.pickPanel(x, y);
      if (panel) onPanelSelect?.(panel, { x, y });
    }
  };


  return <>{glStatus !== 'ok' && <div className="carton-engine-fallback" role="status">
    <strong>{glStatus === 'lost' ? '3D preview paused' : '3D preview unavailable'}</strong>
    <span>{glStatus === 'lost'
      ? 'Your browser reset the graphics context. It should come back on its own; reload the page if it doesn’t.'
      : 'This browser has WebGL turned off or unsupported. You can still set up, design and save your box.'}</span>
  </div>}<canvas
    ref={canvasRef}
    className={`carton-engine-canvas${panEnabled?' is-pan-enabled':''}`}
    aria-label="Interactive 3D packaging preview"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { dragRef.current = null; }}
    onPointerLeave={() => { dragRef.current = null; setHoverPanel(null); }}
  />{measures && lines && <div className="carton-engine-measures">
    <svg aria-hidden="true">
      {lines.map(line => <g key={line.axis}>
        <line className="is-extension" x1={line.start.x} y1={line.start.y} x2={line.from.x} y2={line.from.y}/>
        <line className="is-extension" x1={line.end.x} y1={line.end.y} x2={line.to.x} y2={line.to.y}/>
        <line className="is-dimension" x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y}/>
      </g>)}
    </svg>
    {lines.map(line => <span key={line.axis} className="carton-engine-measure-label" style={{ left: line.label.x, top: line.label.y }}>{measures[line.axis]}</span>)}
  </div>}{flapMeasures && flapSpots.length > 0 && <div className="carton-engine-measures">
    {flapSpots.map(spot => <span key={spot.key} className="carton-engine-measure-label is-flap" style={{ left: spot.x, top: spot.y }}
      onPointerEnter={() => setHoverPanel(spot.panel)} onPointerLeave={() => setHoverPanel(null)}>
      {flapMeasures.find(item => item.key === spot.key)?.node}
    </span>)}
  </div>}{unfoldable ? <div className="carton-engine-measures-hint is-unfoldable" role="status">
    <strong>Too small to fold in 3D, showing the last size that folds.</strong> {unfoldable}
  </div> : !measures && measuresHint && <div className="carton-engine-measures-hint" role="status">{measuresHint}</div>}</>;
});

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
