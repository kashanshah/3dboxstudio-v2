'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { ArtworkByPanel } from '@/lib/packaging/artwork';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { trackEvent } from '@/lib/analytics';
import { cameraForPreset, clamp, easeInOutCubic, shortestAngleDelta, type RenderStyle } from './carton-scene';
import type { CartonRenderer } from './carton-renderer';

export { buildMeshes, studioViewProjection, type BoxMeshOptions, type RenderStyle } from './carton-scene';

/** Longest side of an exported PNG. Phones get a size their GPU memory can hold. */
const EXPORT_LONG_SIDE = 3840;
const EXPORT_LONG_SIDE_COARSE = 2560;

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

export type CartonEngineHandle = {
  thumbnail: () => string | null;
  exportPng: (filename?: string) => boolean;
  /** Renders and downloads an MP4 of the box assembling and turning. Rejects when video is unsupported. */
  exportVideo: (filename: string, onProgress?: (fraction: number) => void) => Promise<boolean>;
  resetCamera: () => void;
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
};


// A shared default, so a preview without its own pan does not count as a
// changed scene (and redraw) every time its parent renders.
const NO_PAN = { x: 0, y: 0 };

export const CartonEngine = forwardRef<CartonEngineHandle, Props>(function CartonEngine(
  { dimensions, templateId, opening, formation = 100, openingMode = 'closed', splitTopHingeSide = 'side_a', material, outsideColor = null, insideColor = null, artworkByPanel, cameraPreset, zoom, viewPan = NO_PAN, panEnabled = false, onViewPanChange, lightIntensity = 0, onPanelSelect, renderStyle = 'realistic', floorShadow = true },
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
    exportPng(filename = '3d-box-studio-carton.png') {
      const renderer = rendererRef.current;
      if (!renderer) return false;
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const link = document.createElement('a');
      link.href = renderer.snapshot(coarse ? EXPORT_LONG_SIDE_COARSE : EXPORT_LONG_SIDE);
      link.download = filename;
      link.click();
      return true;
    },
    async exportVideo(filename, onProgress) {
      const renderer = rendererRef.current;
      if (!renderer) return false;
      const { recordCartonVideo } = await import('./carton-video');
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const blob = await recordCartonVideo(renderer, coarse ? { width: 1280, height: 720 } : { width: 1920, height: 1080 }, onProgress);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setScene({
      dimensions,
      templateId,
      opening,
      formation,
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
  /></>;
});
