'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Box, Check, RotateCcw, MoveUpRight } from 'lucide-react';

const materials = [{ name: 'Sage', color: '#b8c6aa' }, { name: 'Clay', color: '#d6ac93' }, { name: 'Lavender', color: '#bcb4d6' }];
export function PackagingPreview({ large = false }: { large?: boolean }) {
  const [material, setMaterial] = useState(0);
  const [rotation, setRotation] = useState(-28);
  const [view, setView] = useState<'perspective' | 'front'>('perspective');
  const reset = () => { setRotation(-28); setView('perspective'); setMaterial(0); };
  const style = { '--box-color': materials[material].color, '--rotation': `${view === 'front' ? 0 : rotation}deg`, '--tilt': `${view === 'front' ? 0 : -16}deg` } as CSSProperties;
  return <section className={`preview ${large ? 'preview-large' : ''}`} aria-label="Interactive packaging concept preview">
    <div className="preview-top"><span><span className="status-dot" /> Packaging concept</span><span className="preview-label">Interactive preview</span></div>
    <div className="preview-stage" style={style}>
      <div className="stage-ring" aria-hidden="true" />
      <div className="package-scene" role="img" aria-label={`${materials[material].name} sample skincare box, ${view === 'front' ? 'front view' : 'perspective view'}`}>
        <div className="package-box"><div className="box-face face-front"><span className="sample-brand">forma<span>®</span></span><div className="sample-flower">✳</div><div className="sample-copy">EVERYDAY<br />ESSENTIALS<span>Good things, thoughtfully made.</span></div><span className="sample-volume">BOTANICAL CARE · 100 ML</span></div><div className="box-face face-back" /><div className="box-face face-left" /><div className="box-face face-right"><span>Made for your everyday.</span></div><div className="box-face face-top"><span>forma</span></div><div className="box-face face-bottom" /></div>
      </div>
      <span className="preview-dimension">Sample box · 80 × 140 × 60 mm</span>
      <span className="preview-badge"><Box size={14} /> Your next idea, in 3D</span>
    </div>
    <div className="preview-bottom"><div className="swatches" role="group" aria-label="Sample color"><span>Make it yours</span>{materials.map((m, i) => <button key={m.name} style={{ backgroundColor: m.color }} aria-label={m.name} aria-pressed={material === i} onClick={() => setMaterial(i)}>{material === i && <Check size={14} />}</button>)}</div><button className="icon-button" aria-label="Reset sample preview" onClick={reset}><RotateCcw size={16} /></button></div>
    <div className="preview-controls"><label htmlFor={large ? 'studio-rotation' : 'hero-rotation'}>Rotate</label><input id={large ? 'studio-rotation' : 'hero-rotation'} type="range" min="-75" max="75" value={rotation} onChange={e => { setRotation(Number(e.target.value)); setView('perspective'); }} /><button className="view-button" aria-pressed={view === 'front'} onClick={() => setView(view === 'front' ? 'perspective' : 'front')}>Front <MoveUpRight size={13} /></button></div>
  </section>;
}
