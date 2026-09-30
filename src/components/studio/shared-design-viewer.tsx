'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Grid3X3, Maximize2, Move, ZoomIn, ZoomOut } from 'lucide-react';
import { CartonEngine } from '@/components/studio/carton-engine';
import type { StudioProjectState } from '@/lib/studio-project';
import { Brand } from '@/components/site-shell';
import { panForAnchoredZoom, scaleStudioZoom, wheelStudioZoom } from '@/lib/studio-zoom';

export function SharedDesignViewer({name,state,legacy}:{name:string;state:StudioProjectState;legacy:boolean}){
  const initialFormation=state.formation ?? (state.templateId==='reverse-tuck-carton'?state.opening:100);
  const [opening,setOpening]=useState(state.templateId==='reverse-tuck-carton'&&state.formation===undefined?0:state.opening);
  const [formation,setFormation]=useState(initialFormation);
  const [zoom,setZoom]=useState(82);
  const [viewPan,setViewPan]=useState({x:0,y:0});
  const [panEnabled,setPanEnabled]=useState(false);
  const [spacePanActive,setSpacePanActive]=useState(false);
  const canvasWrapRef=useRef<HTMLDivElement>(null);
  const zoomRef=useRef(zoom);
  const panRef=useRef(viewPan);

  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{panRef.current=viewPan;},[viewPan]);

  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(event.code!=='Space'||event.repeat)return;
      const target=event.target;
      if(target instanceof Element&&target.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"])'))return;
      event.preventDefault();
      setSpacePanActive(true);
    };
    const up=(event:KeyboardEvent)=>{if(event.code==='Space')setSpacePanActive(false);};
    const clear=()=>setSpacePanActive(false);
    window.addEventListener('keydown',down);
    window.addEventListener('keyup',up);
    window.addEventListener('blur',clear);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);};
  },[]);

  const hasOpeningStage=state.templateId!=='reverse-tuck-carton'
    && (state.templateId==='split-top-box' || state.openingMode!=='closed');
  const assemblyProgress=state.templateId==='reverse-tuck-carton'||!hasOpeningStage
    ? formation
    : formation<99.999
      ? formation*.7
      : 70+(100-opening)*.3;
  const setAssemblyProgress=(value:number)=>{
    const next=Math.max(0,Math.min(100,value));
    if(state.templateId==='reverse-tuck-carton'||!hasOpeningStage){
      setFormation(next);
      if(state.templateId!=='reverse-tuck-carton')setOpening(0);
      return;
    }
    if(next<=70){
      setFormation(next/70*100);
      setOpening(100);
    }else{
      setFormation(100);
      setOpening((100-next)/30*100);
    }
  };
  const stage=assemblyProgress<=1
    ? 'Flat dieline'
    : hasOpeningStage&&assemblyProgress>=69&&assemblyProgress<=71
      ? 'Assembled · open'
      : assemblyProgress<70
        ? 'Forming box'
        : assemblyProgress<99
          ? 'Closing package'
          : 'Closed package';

  const applyZoom=(next:number,clientX?:number,clientY?:number)=>{
    const rect=canvasWrapRef.current?.getBoundingClientRect();
    const old=zoomRef.current;
    const clamped=scaleStudioZoom(next,1);
    let nextPan=panRef.current;
    if(rect&&clientX!==undefined&&clientY!==undefined){
      const point={x:clientX-(rect.left+rect.width/2),y:clientY-(rect.top+rect.height/2)};
      nextPan=panForAnchoredZoom(panRef.current,old,clamped,point);
    }
    zoomRef.current=clamped;panRef.current=nextPan;
    setZoom(clamped);setViewPan(nextPan);
  };

  return <main className="shared-design-viewer">
    <header className="shared-design-header">
      <Brand/>
      <div><strong>{name}</strong><span>{legacy?'Legacy shared design':'Shared design'} · View only</span></div>
      <Link href="/studio">Open 3D Box Studio</Link>
    </header>
    <section className="shared-design-stage">
      <div
        ref={canvasWrapRef}
        className="shared-design-canvas"
        onWheel={event=>{
          event.preventDefault();
          const next=wheelStudioZoom(zoomRef.current,event.deltaY,event.deltaMode,event.ctrlKey);
          applyZoom(next,event.clientX,event.clientY);
        }}
      >
        <CartonEngine
          dimensions={state.dimensions}
          templateId={state.templateId}
          opening={opening}
          formation={formation}
          openingMode={state.openingMode}
          splitTopHingeSide={state.splitTopHingeSide}
          material={state.material}
          outsideColor={state.outsideColorMode==='custom'?state.outsideCustomColor:null}
          insideColor={state.insideColorMode==='custom'?state.insideCustomColor:null}
          artworkByPanel={state.artworkByPanel}
          cameraPreset="Perspective"
          zoom={zoom}
          viewPan={viewPan}
          panEnabled={panEnabled||spacePanActive}
          onViewPanChange={pan=>{panRef.current=pan;setViewPan(pan);}}
        />
        <div className="shared-design-view-controls" aria-label="3D view controls">
          <button type="button" className={panEnabled||spacePanActive?'is-active':''} onClick={()=>setPanEnabled(value=>!value)} aria-pressed={panEnabled||spacePanActive} title="Pan view · hold Space for temporary pan"><Move size={17}/></button>
          <button type="button" onClick={()=>applyZoom(scaleStudioZoom(zoomRef.current,1/1.1))} title="Zoom out"><ZoomOut size={17}/></button>
          <span>{Number(zoom.toFixed(1))}%</span>
          <button type="button" onClick={()=>applyZoom(scaleStudioZoom(zoomRef.current,1.1))} title="Zoom in"><ZoomIn size={17}/></button>
          <button type="button" onClick={()=>{zoomRef.current=82;panRef.current={x:0,y:0};setZoom(82);setViewPan({x:0,y:0});}} title="Fit view"><Maximize2 size={17}/></button>
        </div>
      </div>
      <aside className="shared-design-controls">
        <span>Assembly</span>
        <div className="shared-design-control-head">
          <Grid3X3 size={18}/>
          <strong>{Math.round(assemblyProgress)}%</strong>
        </div>
        <input type="range" min="0" max="100" step="1" value={Math.round(assemblyProgress)} onChange={event=>setAssemblyProgress(Number(event.target.value))} aria-label="Assemble or flatten box"/>
        <div className="shared-design-endpoints"><small>Flat</small><small>Closed</small></div>
        <strong className="shared-design-stage-label">{stage}</strong>
        <p>Drag to rotate. Turn on the hand tool—or hold Space—to pan. Scroll or pinch to zoom. This shared link is view-only.</p>
      </aside>
    </section>
  </main>;
}
