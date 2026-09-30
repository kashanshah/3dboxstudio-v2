'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Grid3X3 } from 'lucide-react';
import { CartonEngine } from '@/components/studio/carton-engine';
import type { StudioProjectState } from '@/lib/studio-project';
import { Brand } from '@/components/site-shell';

export function SharedDesignViewer({name,state,legacy}:{name:string;state:StudioProjectState;legacy:boolean}){
  const initialFormation=state.formation ?? (state.templateId==='reverse-tuck-carton'?state.opening:100);
  const [opening,setOpening]=useState(state.templateId==='reverse-tuck-carton'&&state.formation===undefined?0:state.opening);
  const [formation,setFormation]=useState(initialFormation);
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

  return <main className="shared-design-viewer">
    <header className="shared-design-header">
      <Brand/>
      <div><strong>{name}</strong><span>{legacy?'Legacy shared design':'Shared design'} · View only</span></div>
      <Link href="/studio">Open 3D Box Studio</Link>
    </header>
    <section className="shared-design-stage">
      <div className="shared-design-canvas">
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
          zoom={82}
        />
      </div>
      <aside className="shared-design-controls">
        <span>Assembly</span>
        <div className="shared-design-control-head">
          <Grid3X3 size={18}/>
          <strong>{Math.round(assemblyProgress)}%</strong>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(assemblyProgress)}
          onChange={event=>setAssemblyProgress(Number(event.target.value))}
          aria-label="Assemble or flatten box"
        />
        <div className="shared-design-endpoints"><small>Flat</small><small>Closed</small></div>
        <strong className="shared-design-stage-label">{stage}</strong>
        <p>{hasOpeningStage?'The package passes through its assembled/open state before fully closing. ':''}Drag the model to rotate it. This shared link is view-only.</p>
      </aside>
    </section>
  </main>;
}
