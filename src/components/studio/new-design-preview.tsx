'use client';

import { forwardRef, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CartonEngine, type CartonEngineHandle } from './carton-engine';
import { buildMeshes, meshReach, studioFitZoom } from './carton-scene';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import type { ArtworkByPanel } from '@/lib/packaging/artwork';
import { requireTemplateRuntime, templateAssemblyValuesForProgress, getTemplateAssemblyState } from '@/lib/packaging/template-runtime';
import { previewLoopProgress } from '@/lib/packaging/preview-loop';
import { scaleStudioZoom, wheelStudioZoom } from '@/lib/studio-zoom';

const motionQuery = '(prefers-reduced-motion: reduce)';
function subscribeMotion(notify: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
}
const readMotion = () => window.matchMedia(motionQuery).matches;
const serverMotion = () => true;

const FIT_SAMPLES = 16;

/**
 * How far the box reaches from its centre across the preview loop, sampled
 * evenly from `from` to 100% assembly: lids stand up and sheets lie flat
 * well outside the closed box the camera is framed for. Reach can change
 * sharply between samples (a lid still up at 99%), so each sample between
 * the ends takes the largest of itself and its neighbours, and the camera
 * never comes in before the box has.
 */
function loopReach(templateId: string, dimensions: CartonDimensions, openingMode: LegacyOpeningMode, splitTopHingeSide: 'side_a' | 'side_b', from: number) {
  const reach = Array.from({ length: FIT_SAMPLES + 1 }, (_, i) => {
    const values = templateAssemblyValuesForProgress(templateId, from + (100 - from) * i / FIT_SAMPLES, openingMode);
    try {
      return meshReach(buildMeshes(dimensions, values.opening, [1, 1, 1], [1, 1, 1], { templateId, formation: values.formation, openingMode, splitTopHingeSide }));
    } catch {
      return 0;
    }
  });
  return reach.map((value, i) => (i === 0 || i === FIT_SAMPLES ? value : Math.max(reach[i - 1], value, reach[i + 1])));
}

type Props = {
  templateId: string;
  dimensions: CartonDimensions;
  openingMode: LegacyOpeningMode;
  splitTopHingeSide: 'side_a' | 'side_b';
  material: string;
  outsideColor: string | null;
  insideColor: string | null;
  artworkByPanel: ArtworkByPanel;
  disabled: boolean;
};

export const NewDesignPreview = forwardRef<CartonEngineHandle, Props>(function NewDesignPreview(props, ref) {
  const canvasContainer = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const [progress, setProgress] = useState(100);
  const [zoom, setZoom] = useState(82);
  const [playRequested, setPlayRequested] = useState<boolean | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeMotion, readMotion, serverMotion);
  const playing = (playRequested ?? !reducedMotion) && !props.disabled;
  const hasOpeningStage = requireTemplateRuntime(props.templateId).assembly.hasOpeningStage(props.openingMode);
  const openProgress = hasOpeningStage ? 70 : 0;
  const assembly = templateAssemblyValuesForProgress(props.templateId, progress, props.openingMode);
  const stage = getTemplateAssemblyState(props.templateId, { ...assembly, openingMode: props.openingMode }).stage;
  const [aspect, setAspect] = useState(1.4);
  const reach = useMemo(
    () => loopReach(props.templateId, props.dimensions, props.openingMode, props.splitTopHingeSide, openProgress),
    [props.templateId, props.dimensions, props.openingMode, props.splitTopHingeSide, openProgress],
  );
  // The camera pulls back as the box unfolds and comes in again as it closes,
  // so opened lids and the flat sheet stay in frame; the user's zoom applies on top.
  const position = Math.max(0, Math.min(1, (progress - openProgress) / Math.max(1, 100 - openProgress))) * FIT_SAMPLES;
  const below = Math.floor(position), above = Math.min(FIT_SAMPLES, below + 1);
  const reachNow = reach[below] + (reach[above] - reach[below]) * (position - below);
  const maxDimension = Math.max(props.dimensions.width, props.dimensions.height, props.dimensions.depth);
  const fit = Number.isFinite(maxDimension) && maxDimension > 0 && reachNow > 0 ? studioFitZoom(maxDimension, reachNow, aspect) : 1;

  useEffect(() => {
    const container = canvasContainer.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAspect(width / height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0, previous: number | null = null;
    const tick = (now: number) => {
      // Resume smoothly after a background tab without jumping the animation.
      if (previous !== null && !document.hidden) elapsed.current += Math.min(100, now - previous);
      previous = now;
      setProgress(previewLoopProgress(elapsed.current, openProgress));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, openProgress]);

  useEffect(() => {
    const container = canvasContainer.current;
    if (!container) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setZoom(current => wheelStudioZoom(current, event.deltaY, event.deltaMode, event.ctrlKey));
    };
    container.addEventListener('wheel', wheel, { passive: false });
    return () => container.removeEventListener('wheel', wheel);
  }, []);

  return <>
    <div ref={canvasContainer} className="pro-new-design-preview-canvas">
      <CartonEngine ref={ref} dimensions={props.dimensions} templateId={props.templateId} opening={assembly.opening} formation={assembly.formation} openingMode={props.openingMode} splitTopHingeSide={props.splitTopHingeSide} material={props.material} outsideColor={props.outsideColor} insideColor={props.insideColor} artworkByPanel={props.artworkByPanel} cameraPreset="Perspective" zoom={zoom * fit}/>
      <span className="pro-new-design-preview-hint">Drag to rotate · Scroll to zoom</span>
      <div className="pro-new-design-zoom" role="group" aria-label="Preview zoom">
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={()=>setZoom(current=>scaleStudioZoom(current,1/1.2))}><ZoomOut size={16}/></button>
        <button type="button" aria-label="Reset zoom" title="Reset zoom" onClick={()=>setZoom(82)}><RotateCcw size={14}/><span>{Math.round(zoom/82*100)}%</span></button>
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={()=>setZoom(current=>scaleStudioZoom(current,1.2))}><ZoomIn size={16}/></button>
      </div>
    </div>
    <div className="pro-new-design-opening">
      <div className="pro-new-design-opening-head"><span>Open / close preview</span><span>{stage}</span></div>
      <div className="pro-new-design-opening-range">
        <button type="button" className="pro-new-design-play" disabled={props.disabled} aria-label={playing?'Pause preview animation':'Play preview animation'} title={playing?'Pause preview animation':'Play preview animation'} onClick={()=>setPlayRequested(!playing)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button>
        <progress max="100" value={progress} aria-label="Box assembly progress" aria-valuetext={stage}/>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  </>;
});
