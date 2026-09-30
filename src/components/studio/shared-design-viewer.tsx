'use client';
import { useState } from 'react';
import { Box,Grid3X3,PackageOpen } from 'lucide-react';
import { CartonEngine } from '@/components/studio/carton-engine';
import type { StudioProjectState } from '@/lib/studio-project';
import { Brand } from '@/components/site-shell';

export function SharedDesignViewer({name,state,legacy}:{name:string;state:StudioProjectState;legacy:boolean}){
  const [opening,setOpening]=useState(state.opening);
  const [formation,setFormation]=useState(state.formation ?? (state.templateId==='reverse-tuck-carton'?state.opening:100));
  const formationMode=state.templateId==='reverse-tuck-carton';
  const value=formationMode?formation:opening;
  return <main className="shared-design-viewer">
    <header className="shared-design-header">
      <Brand/>
      <div><strong>{name}</strong><span>{legacy?'Legacy shared design':'Shared design'} · View only</span></div>
      <a href="/studio">Open 3D Box Studio</a>
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
        <span>{formationMode?'Formation':'Open / close'}</span>
        <div className="shared-design-control-head">
          {formationMode?<Grid3X3 size={18}/>:<PackageOpen size={18}/>}
          <strong>{Math.round(value)}%</strong>
        </div>
        <input type="range" min="0" max="100" step="1" value={Math.round(value)}
          onChange={event=>formationMode?setFormation(Number(event.target.value)):setOpening(Number(event.target.value))}
          aria-label={formationMode?'Box formation':'Open or close box'}/>
        <div className="shared-design-endpoints"><small>{formationMode?'Flat dieline':'Closed'}</small><small>{formationMode?'Assembled':'Open'}</small></div>
        {!formationMode&&formation<99&&<button type="button" onClick={()=>setFormation(100)}><Box size={16}/> Assemble box</button>}
        <p>Drag the model to rotate it. This shared link is view-only.</p>
      </aside>
    </section>
  </main>;
}
