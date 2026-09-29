'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Aperture, Box, Boxes, Check, ChevronDown, CirclePlay, Download, Expand,
  FileUp, Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2, Minus,
  MousePointer2, PackageOpen, Plus, Redo2, Rotate3d, Search, Share2, Sparkles,
  Undo2, Upload, X, ZoomIn
} from 'lucide-react';
import { Brand } from '@/components/site-shell';

type Tool = 'structure' | 'artwork' | 'material' | 'opening' | 'scene' | 'export';
type Mode = '3d' | 'dieline';

const tools: { id: Tool; label: string; icon: typeof Box }[] = [
  { id: 'structure', label: 'Structure', icon: Box },
  { id: 'artwork', label: 'Artwork', icon: ImageIcon },
  { id: 'material', label: 'Material', icon: Layers3 },
  { id: 'opening', label: 'Opening', icon: PackageOpen },
  { id: 'scene', label: 'Scene', icon: Lightbulb },
  { id: 'export', label: 'Export', icon: Download },
];

const families = ['Folding carton','Mailer','Rigid box','Bottle','Jar','Can','Tube','Pouch','Cup'];
const panels = ['Front','Back','Left','Right','Top','Bottom'];
const materials = ['White board','Kraft','Soft touch','Matte coated','Gloss coated','Foil'];
const cameras = ['Perspective','Front','Back','Left','Right','Top'];

export function StudioShell() {
  const [tool, setTool] = useState<Tool>('artwork');
  const [mode, setMode] = useState<Mode>('3d');
  const [family, setFamily] = useState('Folding carton');
  const [panel, setPanel] = useState('Front');
  const [material, setMaterial] = useState('Soft touch');
  const [camera, setCamera] = useState('Perspective');
  const [opening, setOpening] = useState(18);
  const [zoom, setZoom] = useState(82);
  const [artworkName, setArtworkName] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [message, setMessage] = useState('Prototype state · not yet persisted');
  const fileRef = useRef<HTMLInputElement>(null);

  const activeLabel = tools.find(item => item.id === tool)?.label ?? 'Studio';
  const boxStyle = useMemo(() => ({
    '--studio-open': opening / 100,
    '--studio-zoom': zoom / 100,
  }) as React.CSSProperties, [opening, zoom]);

  const chooseTool = (id: Tool) => {
    setTool(id);
    setInspectorOpen(true);
  };

  const handleArtwork = (file?: File) => {
    if (!file) return;
    setArtworkName(file.name);
    setPanel('Front');
    setMessage('Artwork loaded into prototype state');
  };

  return <main className="pro-studio" style={boxStyle}>
    <header className="pro-studio-header">
      <div className="pro-project">
        <Brand />
        <span className="pro-divider" />
        <div className="pro-project-copy"><strong>Noma Tea — Spring</strong><span>Prototype · local state</span></div>
        <ChevronDown size={14} />
      </div>
      <div className="pro-header-actions">
        <button aria-label="Undo" title="Undo"><Undo2 size={16} /></button>
        <button aria-label="Redo" title="Redo"><Redo2 size={16} /></button>
        <button className="pro-secondary"><Share2 size={15} /> <span>Share</span></button>
        <button className="pro-primary" onClick={() => chooseTool('export')}><Download size={15} /> <span>Export</span></button>
      </div>
    </header>

    <div className="pro-studio-body">
      <aside className="pro-tool-rail" aria-label="Studio tools">
        {tools.map(({ id, label, icon: Icon }) => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => chooseTool(id)} aria-pressed={tool === id}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
        </button>)}
      </aside>

      <section className="pro-canvas" aria-label="Packaging workspace">
        <div className="pro-canvas-top">
          <div className="pro-mode-switch" role="group" aria-label="Canvas mode">
            <button className={mode === 'dieline' ? 'is-active' : ''} onClick={() => setMode('dieline')}><Grid3X3 size={14} /> Dieline</button>
            <button className={mode === '3d' ? 'is-active' : ''} onClick={() => setMode('3d')}><Boxes size={14} /> 3D Preview</button>
          </div>
          <div className="pro-camera-menu">
            <button><Aperture size={14} /> {camera} <ChevronDown size={13} /></button>
            <div className="pro-camera-popover">{cameras.map(item => <button key={item} onClick={() => setCamera(item)} className={camera === item ? 'is-active' : ''}>{item}</button>)}</div>
          </div>
        </div>

        {mode === '3d' ? <ThreeDPrototype family={family} panel={panel} artworkName={artworkName} material={material} opening={opening} /> : <DielinePrototype panel={panel} artworkName={artworkName} />}

        <div className="pro-canvas-controls">
          <button title="Select"><MousePointer2 size={16} /></button>
          <button title="Orbit"><Rotate3d size={16} /></button>
          <span />
          <button onClick={() => setZoom(Math.max(40, zoom - 10))}><Minus size={15} /></button>
          <strong>{zoom}%</strong>
          <button onClick={() => setZoom(Math.min(140, zoom + 10))}><Plus size={15} /></button>
          <button title="Fit view"><Maximize2 size={16} /></button>
        </div>

        <button className="pro-mobile-inspector" onClick={() => setInspectorOpen(true)}><Sparkles size={14} /> Edit {activeLabel}</button>
        <div className="pro-status-bar"><span><span className="pro-status-dot" /> {message}</span><span>{family} · 120 × 180 × 55 mm</span></div>
      </section>

      <aside className={`pro-inspector ${inspectorOpen ? 'is-open' : ''}`}>
        <div className="pro-inspector-title"><div><span>Inspector</span><h2>{activeLabel}</h2></div><button className="pro-inspector-close" onClick={() => setInspectorOpen(false)}><X size={17} /></button></div>
        <Inspector tool={tool} family={family} setFamily={setFamily} panel={panel} setPanel={setPanel} material={material} setMaterial={setMaterial} opening={opening} setOpening={setOpening} artworkName={artworkName} fileRef={fileRef} onArtwork={handleArtwork} setMessage={setMessage} />
      </aside>
    </div>

    <nav className="pro-mobile-dock" aria-label="Mobile studio tools">
      {tools.slice(0,5).map(({ id, label, icon: Icon }) => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => chooseTool(id)}><Icon size={18} /><span>{label}</span></button>)}
    </nav>
  </main>;
}

function Inspector(props: {
  tool: Tool; family: string; setFamily: (v:string)=>void; panel:string; setPanel:(v:string)=>void;
  material:string; setMaterial:(v:string)=>void; opening:number; setOpening:(v:number)=>void;
  artworkName:string|null; fileRef:React.RefObject<HTMLInputElement|null>; onArtwork:(file?:File)=>void;
  setMessage:(v:string)=>void;
}) {
  const { tool } = props;
  if (tool === 'structure') return <div className="pro-inspector-content">
    <SectionTitle title="Packaging family" meta="Template library" />
    <label className="pro-search"><Search size={14}/><input placeholder="Search 7,000+ class catalog" /></label>
    <div className="pro-chip-grid">{families.map(item => <button key={item} className={props.family===item?'is-selected':''} onClick={()=>props.setFamily(item)}>{item}</button>)}</div>
    <SectionTitle title="Dimensions" meta="mm" />
    <div className="pro-fields"><Field label="Width" value="120"/><Field label="Height" value="180"/><Field label="Depth" value="55"/></div>
    <ControlRow label="Board thickness" value="0.5 mm" />
    <input className="pro-range" type="range" min="2" max="12" defaultValue="5" />
    <div className="pro-callout"><Box size={15}/><span><strong>Reverse tuck end</strong> · ECMA-style carton fixture for the first production slice.</span></div>
  </div>;

  if (tool === 'artwork') return <div className="pro-inspector-content">
    <SectionTitle title="Panels" meta="2 of 6 designed" />
    <div className="pro-panel-grid">{panels.map((item,i)=><button key={item} className={props.panel===item?'is-selected':''} onClick={()=>props.setPanel(item)}><span className={i<2?'has-art':''}>{i===0?'NOMA':i===1?'FIELD':'+'}</span><b>{item}</b>{i<2&&<i/>}</button>)}</div>
    <input ref={props.fileRef} hidden type="file" accept="image/*,.pdf" onChange={e=>props.onArtwork(e.target.files?.[0])}/>
    <button className="pro-wide-button" onClick={()=>props.fileRef.current?.click()}><Upload size={15}/>{props.artworkName ? 'Replace artwork' : 'Upload artwork'}</button>
    {props.artworkName && <div className="pro-file"><Check size={14}/><span>{props.artworkName}</span></div>}
    <SectionTitle title="Placement" />
    <div className="pro-segmented"><button className="is-active">Fill</button><button>Fit</button><button>Tile</button></div>
    <ControlRow label="Scale" value="100%" /><input className="pro-range" type="range" defaultValue="72"/>
    <ControlRow label="Rotation" value="0°" /><input className="pro-range" type="range" min="-180" max="180" defaultValue="0"/>
    <div className="pro-alignment"><button>↤</button><button>↔</button><button>↦</button><button>↥</button><button>↕</button><button>↧</button></div>
  </div>;

  if (tool === 'material') return <div className="pro-inspector-content">
    <SectionTitle title="Board & finish" />
    <div className="pro-material-grid">{materials.map(item=><button key={item} className={props.material===item?'is-selected':''} onClick={()=>props.setMaterial(item)}><span className={`material-${item.toLowerCase().replaceAll(' ','-')}`}/><b>{item}</b></button>)}</div>
    <ControlRow label="Roughness" value="64" /><input className="pro-range" type="range" defaultValue="64"/>
    <ControlRow label="Reflectivity" value="18" /><input className="pro-range" type="range" defaultValue="18"/>
    <ControlRow label="Print depth" value="Subtle" /><input className="pro-range" type="range" defaultValue="22"/>
  </div>;

  if (tool === 'opening') return <div className="pro-inspector-content">
    <SectionTitle title="Closure" meta="Tuck top" />
    <div className="pro-opening-cards"><button className="is-selected"><PackageOpen/><span><b>Reverse tuck</b><small>Carton fixture</small></span></button><button><Box/><span><b>Mailer</b><small>Architecture proof</small></span></button><button><Layers3/><span><b>Drawer</b><small>Planned</small></span></button></div>
    <SectionTitle title="Opening preview" meta={`${props.opening}%`} />
    <div className="pro-play-row"><button><CirclePlay size={18}/></button><input className="pro-range" type="range" value={props.opening} onChange={e=>props.setOpening(Number(e.target.value))}/></div>
    <ControlRow label="Duration" value="1.8 s" /><input className="pro-range" type="range" defaultValue="45"/>
    <div className="pro-callout"><Sparkles size={15}/><span>Scrubbing is interactive now; physically validated hinge geometry lands in the engine slice.</span></div>
  </div>;

  if (tool === 'scene') return <div className="pro-inspector-content">
    <SectionTitle title="Scene" meta="3 objects" />
    <div className="pro-layer-list"><button className="is-selected"><Box/> Carton 01 <span>•••</span></button><button><Box/> Carton 02 <span>•••</span></button><button><Boxes/> Plinth <span>•••</span></button></div>
    <button className="pro-wide-button"><Plus size={15}/> Add object</button>
    <SectionTitle title="Environment" />
    <div className="pro-scene-preview"><span>Soft daylight</span></div>
    <ControlRow label="Light intensity" value="78" /><input className="pro-range" type="range" defaultValue="78"/>
    <ControlRow label="Shadow softness" value="62" /><input className="pro-range" type="range" defaultValue="62"/>
    <div className="pro-segmented"><button className="is-active">Floor</button><button>Floating</button><button>Transparent</button></div>
  </div>;

  return <div className="pro-inspector-content">
    <SectionTitle title="Export" meta="Engine-aware" />
    <ExportCard icon={<ImageIcon/>} title="Still image" text="PNG / JPG · HD, 2K, 4K, 8K" active/>
    <ExportCard icon={<CirclePlay/>} title="Animation" text="Turntable / opening · MP4"/>
    <ExportCard icon={<Share2/>} title="Share review" text="Versioned 3D link / embed"/>
    <ExportCard icon={<Grid3X3/>} title="Production file" text="Dieline · PDF / SVG / DXF"/>
    <SectionTitle title="Still settings" />
    <div className="pro-segmented"><button>HD</button><button>2K</button><button className="is-active">4K</button><button>8K</button></div>
    <div className="pro-segmented"><button className="is-active">PNG</button><button>JPG</button><button>Transparent</button></div>
    <button className="pro-primary pro-export-button" onClick={()=>props.setMessage('Export configured · production renderer not connected yet')}><Download size={15}/> Prepare PNG export</button>
    <div className="pro-import-box"><FileUp size={19}/><div><strong>Dieline to 3D</strong><span>Import SVG/DXF · classify cut/crease · assign folds</span></div><button onClick={()=>props.setMessage('Dieline import flow opened · parser not connected yet')}>Import</button></div>
  </div>;
}

function ThreeDPrototype({family,panel,artworkName,material,opening}:{family:string;panel:string;artworkName:string|null;material:string;opening:number}) {
  return <div className="pro-3d-stage">
    <div className="pro-grid-floor" />
    <div className="pro-stage-badge"><span/> Perspective · prototype renderer</div>
    <div className="pro-box-wrap">
      <div className="pro-box-model">
        <div className="pro-face pro-front"><small>{panel==='Front'?'SELECTED PANEL':'FRONT'}</small><strong>{artworkName?'NOMA':'YOUR'}<br/>{artworkName?'FIELD TEA':'ARTWORK'}</strong><i/></div>
        <div className="pro-face pro-side">3D BOX STUDIO</div>
        <div className="pro-face pro-top" style={{ transform: `rotateX(${90 + opening * .55}deg) translateZ(70px)` }}>OPEN</div>
      </div>
      <div className="pro-box-shadow"/>
    </div>
    <div className="pro-stage-meta"><span>{family}</span><span>{material}</span><span>Opening {opening}%</span></div>
  </div>;
}

function DielinePrototype({panel,artworkName}:{panel:string;artworkName:string|null}) {
  return <div className="pro-dieline-stage">
    <div className="pro-dieline">
      <span className="dl dl-top">TOP</span><span className="dl dl-left">LEFT</span><span className="dl dl-front">FRONT<br/><b>{artworkName?'NOMA':'+'}</b></span><span className="dl dl-right">RIGHT</span><span className="dl dl-back">BACK</span><span className="dl dl-bottom">BOTTOM</span>
    </div>
    <div className="pro-dieline-legend"><span><i className="cut"/>Cut</span><span><i className="crease"/>Crease</span><span><i className="bleed"/>Bleed</span><strong>{panel} panel selected</strong></div>
  </div>;
}

function SectionTitle({title,meta}:{title:string;meta?:string}) { return <div className="pro-section-title"><strong>{title}</strong>{meta&&<span>{meta}</span>}</div>; }
function ControlRow({label,value}:{label:string;value:string}) { return <div className="pro-control-row"><span>{label}</span><strong>{value}</strong></div>; }
function Field({label,value}:{label:string;value:string}) { return <label><span>{label}</span><input defaultValue={value}/></label>; }
function ExportCard({icon,title,text,active=false}:{icon:React.ReactNode;title:string;text:string;active?:boolean}) { return <button className={`pro-export-card ${active?'is-selected':''}`}>{icon}<span><b>{title}</b><small>{text}</small></span></button>; }
