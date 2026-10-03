'use client';

import { forwardRef, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pause, Play, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { CartonEngine, type CartonEngineHandle } from './carton-engine';
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
      <CartonEngine ref={ref} dimensions={props.dimensions} templateId={props.templateId} opening={assembly.opening} formation={assembly.formation} openingMode={props.openingMode} splitTopHingeSide={props.splitTopHingeSide} material={props.material} outsideColor={props.outsideColor} insideColor={props.insideColor} artworkByPanel={props.artworkByPanel} cameraPreset="Perspective" zoom={zoom}/>
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
