'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture, Box, Boxes, Check, ChevronDown, CirclePlay, Download,
  FileUp, Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2, Minus,
  MousePointer2, PackageOpen, Plus, Redo2, Rotate3d, Search, Share2, Sparkles,
  Trash2, Undo2, Upload, X
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { CartonEngine, type CartonEngineHandle } from '@/components/studio/carton-engine';
import { DEFAULT_CARTON_DIMENSIONS, reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { artworkCss, defaultArtworkPlacement, type ArtworkByPanel, type ArtworkMode, type LocalMediaAsset } from '@/lib/packaging/artwork';

type Tool = 'structure' | 'artwork' | 'material' | 'opening' | 'scene' | 'export';
type Mode = '3d' | 'dieline';

const tools: { id: Tool; label: string; icon: typeof Box }[] = [
  { id: 'structure', label: 'Structure', icon: Box },
  { id: 'artwork', label: 'Artwork', icon: ImageIcon },
  { id: 'material', label: 'Finish', icon: Layers3 },
  { id: 'opening', label: 'Open / Close', icon: PackageOpen },
  { id: 'scene', label: 'Scene', icon: Lightbulb },
  { id: 'export', label: 'Export', icon: Download },
];

const families = ['Folding carton','Mailer','Rigid box','Bottle','Jar','Can','Tube','Pouch','Cup'];
const panels = ['Front','Back','Left','Right','Top','Bottom'];
const materials = ['White board','Kraft','Soft touch','Matte coated','Gloss coated','Foil'];
const cameras = ['Perspective','Front','Back','Left','Right','Top'];

export function StudioShell() {
  const [tool, setTool] = useState<Tool | null>(null);
  const [mode, setMode] = useState<Mode>('3d');
  const [family, setFamily] = useState('Folding carton');
  const [panel, setPanel] = useState('Front');
  const [material, setMaterial] = useState('Soft touch');
  const [camera, setCamera] = useState('Perspective');
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [opening, setOpening] = useState(18);
  const [zoom, setZoom] = useState(82);
  const [dimensions, setDimensions] = useState<CartonDimensions>(DEFAULT_CARTON_DIMENSIONS);
  const [artworkByPanel, setArtworkByPanel] = useState<ArtworkByPanel>({});
  const [mediaAssets, setMediaAssets] = useState<LocalMediaAsset[]>([]);
  const mediaAssetsRef = useRef<LocalMediaAsset[]>([]);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<'library' | 'upload'>('library');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(null);
  const [mediaTargetPanel, setMediaTargetPanel] = useState('Front');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [faceAction, setFaceAction] = useState<{ panel: string; x: number; y: number } | null>(null);
  const [message, setMessage] = useState('Prototype state · not yet persisted');
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<CartonEngineHandle>(null);
  const faceActionRef = useRef<HTMLDivElement>(null);
  const cameraMenuRef = useRef<HTMLDivElement>(null);

  const activeLabel = tools.find(item => item.id === tool)?.label ?? 'Tools';
  const boxStyle = useMemo(() => ({ '--studio-zoom': zoom / 100 }) as React.CSSProperties, [zoom]);

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => () => {
    for (const asset of mediaAssetsRef.current) URL.revokeObjectURL(asset.url);
  }, []);

  useEffect(() => {
    if (!cameraMenuOpen) return;

    const dismissCameraMenu = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (cameraMenuRef.current?.contains(target)) return;
      setCameraMenuOpen(false);
    };

    document.addEventListener('pointerdown', dismissCameraMenu, true);
    return () => document.removeEventListener('pointerdown', dismissCameraMenu, true);
  }, [cameraMenuOpen]);

  useEffect(() => {
    if (!faceAction) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (faceActionRef.current?.contains(target)) return;
      setFaceAction(null);
    };

    document.addEventListener('pointerdown', dismissOnOutsidePointer, true);
    return () => document.removeEventListener('pointerdown', dismissOnOutsidePointer, true);
  }, [faceAction]);

  const chooseTool = (id: Tool) => {
    if (tool === id && inspectorOpen) {
      setInspectorOpen(false);
      setTool(null);
      return;
    }
    setTool(id);
    setInspectorOpen(true);
  };

  const applyAssetToPanel = (asset: LocalMediaAsset, targetPanel = panel) => {
    setArtworkByPanel(current => ({
      ...current,
      [targetPanel]: defaultArtworkPlacement(asset.name, asset.url, asset.id),
    }));
    setPanel(targetPanel);
    setTool('artwork');
    setInspectorOpen(true);
    setMediaLibraryOpen(false);
    setMessage(`${asset.name} applied to the ${targetPanel} panel`);
  };

  const openMediaLibrary = (targetPanel = panel, tab: 'library' | 'upload' = 'library') => {
    const currentAssetId = artworkByPanel[targetPanel]?.assetId ?? mediaAssets[0]?.id ?? null;
    setMediaTargetPanel(targetPanel);
    setPanel(targetPanel);
    setSelectedMediaAssetId(currentAssetId);
    setMediaLibraryTab(tab);
    setMediaLibraryOpen(true);
  };

  const handleArtwork = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage('Use PNG, JPG or WebP artwork');
      return;
    }

    const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
    const existing = mediaAssetsRef.current.find(asset => asset.fingerprint === fingerprint);
    if (existing) {
      setSelectedMediaAssetId(existing.id);
      setMediaLibraryTab('library');
      setMediaLibraryOpen(true);
      setMessage(`${existing.name} is already in your library`);
      return;
    }

    const url = URL.createObjectURL(file);
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const asset: LocalMediaAsset = {
      id,
      name: file.name,
      url,
      mimeType: file.type,
      byteSize: file.size,
      width: null,
      height: null,
      fingerprint,
      createdAt: Date.now(),
    };

    setMediaAssets(current => [asset, ...current]);
    setSelectedMediaAssetId(asset.id);
    setMediaLibraryTab('library');
    setMediaLibraryOpen(true);
    setMessage(`${asset.name} added to your library`);

    const image = new Image();
    image.onload = () => {
      setMediaAssets(current => current.map(item => item.id === id
        ? { ...item, width: image.naturalWidth, height: image.naturalHeight }
        : item));
    };
    image.src = url;
  };

  const pickArtwork = () => fileRef.current?.click();

  const removeArtwork = (targetPanel: string) => {
    setArtworkByPanel(current => {
      const artwork = current[targetPanel];
      if (!artwork) return current;
      const next = { ...current };
      delete next[targetPanel];
      return next;
    });
    setMessage(`Artwork removed from the ${targetPanel} panel`);
    setFaceAction(null);
  };

  const removeMediaAsset = (assetId: string) => {
    const inUse = Object.values(artworkByPanel).some(artwork => artwork.assetId === assetId);
    if (inUse) {
      setMessage('Remove this image from every panel before deleting it from the library');
      return;
    }
    setMediaAssets(current => {
      const asset = current.find(item => item.id === assetId);
      if (asset) URL.revokeObjectURL(asset.url);
      return current.filter(item => item.id !== assetId);
    });
    setMessage('Image removed from your local library');
  };

  const exportPng = () => {
    if (mode !== '3d') {
      setMode('3d');
      setMessage('Switched to 3D Preview — click export again to capture PNG');
      return;
    }
    const exported = engineRef.current?.exportPng('3d-box-studio-reverse-tuck.png');
    setMessage(exported ? 'PNG exported from the live WebGL canvas' : 'Renderer is not ready yet');
  };

  return <><input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{ handleArtwork(e.target.files?.[0]); e.currentTarget.value=''; }}/><main className="pro-studio" style={boxStyle}>
    <header className="pro-studio-header">
      <div className="pro-project">
        <Brand />
        <span className="pro-divider" />
        <div className="pro-project-copy"><strong>Noma Tea — Spring</strong><span>Saved on this device</span></div>
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
            <button className={mode === 'dieline' ? 'is-active' : ''} onClick={() => { setMode('dieline'); setFaceAction(null); }}><Grid3X3 size={14} /> Dieline</button>
            <button className={mode === '3d' ? 'is-active' : ''} onClick={() => { setMode('3d'); setFaceAction(null); }}><Boxes size={14} /> 3D Preview</button>
          </div>
          <div className="pro-camera-menu" ref={cameraMenuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={cameraMenuOpen}
              onClick={() => setCameraMenuOpen(open => !open)}
            >
              <Aperture size={14} /> {camera} <ChevronDown size={13} className={cameraMenuOpen ? 'is-open' : ''} />
            </button>
            {cameraMenuOpen && <div className="pro-camera-popover" role="menu">
              {cameras.map(item => <button
                key={item}
                type="button"
                role="menuitemradio"
                aria-checked={camera === item}
                onClick={() => {
                  setCamera(item);
                  setCameraMenuOpen(false);
                }}
                className={camera === item ? 'is-active' : ''}
              >{item}</button>)}
            </div>}
          </div>
        </div>

        {mode === '3d' ? <div className="pro-3d-stage">
          <div className="pro-grid-floor" />
          <div className="pro-stage-badge"><span/> Drag to rotate</div>
          <CartonEngine
            ref={engineRef}
            dimensions={dimensions}
            opening={opening}
            material={material}
            artworkByPanel={artworkByPanel}
            cameraPreset={camera}
            zoom={zoom}
            onPanelSelect={(selectedPanel, point) => {
              setPanel(selectedPanel);
              setFaceAction({ panel: selectedPanel, x: point.x, y: point.y });
              setMessage(`${selectedPanel} panel selected from the 3D carton`);
            }}
          />
          <div className="pro-stage-meta"><span>{family}</span><span>{material}</span><span>Opening {opening}%</span></div>
          {faceAction && <div
            ref={faceActionRef}
            className="pro-face-action"
            style={{
              left: `clamp(12px, ${faceAction.x + 12}px, calc(100% - 280px))`,
              top: `clamp(54px, ${faceAction.y - 18}px, calc(100% - 58px))`,
            }}
          >
            <span>{faceAction.panel}</span>
            <button onClick={() => {
              setTool('artwork');
              setInspectorOpen(true);
              setFaceAction(null);
              openMediaLibrary(faceAction.panel, artworkByPanel[faceAction.panel] ? 'library' : 'upload');
            }}>
              <Upload size={13} />
              {artworkByPanel[faceAction.panel] ? 'Replace artwork' : 'Add artwork'}
            </button>
            {artworkByPanel[faceAction.panel] && <button
              className="pro-face-action-remove"
              onClick={() => removeArtwork(faceAction.panel)}
            >
              <Trash2 size={13} /> Remove artwork
            </button>}
            <button className="pro-face-action-close" aria-label="Dismiss face action" onClick={() => setFaceAction(null)}><X size={12}/></button>
          </div>}
        </div> : <DielinePrototype
          panel={panel}
          artworkByPanel={artworkByPanel}
          dimensions={dimensions}
          onPanelSelect={(selectedPanel) => {
            setPanel(selectedPanel);
            setMessage(`${selectedPanel} panel selected from the dieline`);
          }}
        />}

        <div className="pro-canvas-controls">
          <button title="Select"><MousePointer2 size={16} /></button>
          <button title="Orbit"><Rotate3d size={16} /></button>
          <span />
          <button onClick={() => setZoom(Math.max(40, zoom - 10))}><Minus size={15} /></button>
          <strong>{zoom}%</strong>
          <button onClick={() => setZoom(Math.min(140, zoom + 10))}><Plus size={15} /></button>
          <button title="Fit view"><Maximize2 size={16} /></button>
        </div>

        <button className="pro-mobile-inspector" onClick={() => { if (tool) setInspectorOpen(true); }} disabled={!tool}><Sparkles size={14} /> {tool ? `Edit ${activeLabel}` : 'Choose a tool'}</button>
        <div className="pro-status-bar"><span><span className="pro-status-dot" /> {message}</span><span>{family} · {dimensions.width} × {dimensions.height} × {dimensions.depth} mm</span></div>
      </section>

      <aside className={`pro-inspector ${inspectorOpen ? 'is-open' : ''}`}>
        <div className="pro-inspector-title"><div><span>Inspector</span><h2>{activeLabel}</h2></div><button
  className="pro-inspector-close"
  aria-label="Close tool panel"
  title="Close"
  onClick={() => {
    setInspectorOpen(false);
    setTool(null);
  }}
><X size={18} /></button></div>
        {tool && <Inspector tool={tool} family={family} setFamily={setFamily} panel={panel} setPanel={setPanel} material={material} setMaterial={setMaterial} opening={opening} setOpening={setOpening} dimensions={dimensions} setDimensions={setDimensions} artworkByPanel={artworkByPanel} setArtworkByPanel={setArtworkByPanel} mediaAssets={mediaAssets} onUseMediaAsset={applyAssetToPanel} onDeleteMediaAsset={removeMediaAsset} onOpenMediaLibrary={openMediaLibrary} onPickArtwork={pickArtwork} onArtwork={handleArtwork} onRemoveArtwork={removeArtwork} onExport={exportPng} setMessage={setMessage} />}
      </aside>
    </div>

    {mediaLibraryOpen && <MediaLibraryModal
      assets={mediaAssets}
      artworkByPanel={artworkByPanel}
      targetPanel={mediaTargetPanel}
      tab={mediaLibraryTab}
      setTab={setMediaLibraryTab}
      selectedAssetId={selectedMediaAssetId}
      setSelectedAssetId={setSelectedMediaAssetId}
      onUpload={() => fileRef.current?.click()}
      onUse={(asset) => applyAssetToPanel(asset, mediaTargetPanel)}
      onDelete={removeMediaAsset}
      onClose={() => setMediaLibraryOpen(false)}
    />}

    <nav className="pro-mobile-dock" aria-label="Mobile studio tools">
      {tools.slice(0,5).map(({ id, label, icon: Icon }) => <button key={id} className={tool === id ? 'is-active' : ''} onClick={() => chooseTool(id)}><Icon size={18} /><span>{label}</span></button>)}
    </nav>
  </main></>;
}

function Inspector(props: {
  tool: Tool; family: string; setFamily: (v:string)=>void; panel:string; setPanel:(v:string)=>void;
  material:string; setMaterial:(v:string)=>void; opening:number; setOpening:(v:number)=>void;
  dimensions:CartonDimensions; setDimensions:(v:CartonDimensions)=>void;
  artworkByPanel:ArtworkByPanel; setArtworkByPanel:React.Dispatch<React.SetStateAction<ArtworkByPanel>>;
  mediaAssets: LocalMediaAsset[]; onUseMediaAsset:(asset:LocalMediaAsset,panel?:string)=>void; onDeleteMediaAsset:(assetId:string)=>void;
  onOpenMediaLibrary:(panel?:string,tab?:'library'|'upload')=>void; onPickArtwork:()=>void; onArtwork:(file?:File)=>void; onRemoveArtwork:(panel:string)=>void;
  onExport:()=>void; setMessage:(v:string)=>void;
}) {
  const { tool } = props;
  if (tool === 'structure') return <div className="pro-inspector-content">
    <PanelIntro title="Set up your box" text="Choose the packaging style, then enter the finished outside size." />
    <div className="pro-card-section">
      <SectionTitle title="Box style" />
      <label className="pro-search"><Search size={16}/><input placeholder="Search packaging styles" /></label>
      <div className="pro-chip-grid">{families.map(item => <button key={item} className={props.family===item?'is-selected':''} onClick={()=>props.setFamily(item)}>{item}</button>)}</div>
    </div>
    <div className="pro-card-section">
      <SectionTitle title="Finished size" meta="Outside measurements" />
      <div className="pro-fields">
        <Field label="Width" value={String(props.dimensions.width)} onChange={value=>props.setDimensions({...props.dimensions,width:value})}/>
        <Field label="Height" value={String(props.dimensions.height)} onChange={value=>props.setDimensions({...props.dimensions,height:value})}/>
        <Field label="Depth" value={String(props.dimensions.depth)} onChange={value=>props.setDimensions({...props.dimensions,depth:value})}/>
      </div>
      <p className="pro-help">Measure the box after it is folded and closed.</p>
    </div>
    <details className="pro-advanced">
      <summary>Construction details <ChevronDown size={16}/></summary>
      <div className="pro-advanced-body">
        <ControlRow label="Board thickness" value={`${props.dimensions.thickness.toFixed(1)} mm`} />
        <input className="pro-range" type="range" min="3" max="20" value={Math.round(props.dimensions.thickness*10)} onChange={e=>props.setDimensions({...props.dimensions,thickness:Number(e.target.value)/10})} />
        <div className="pro-callout"><Box size={16}/><span><strong>Reverse tuck end</strong><br/>Standard folding-carton construction.</span></div>
      </div>
    </details>
  </div>;

  if (tool === 'artwork') {
    const selectedArtwork = props.artworkByPanel[props.panel];
    const designedCount = panels.filter(item => props.artworkByPanel[item]).length;
    return <div className="pro-inspector-content">
    <PanelIntro title="Place your design" text="Choose a panel, then reuse artwork from your library or upload something new." />
    <div className="pro-card-section pro-artwork-source-card">
      <SectionTitle title="Artwork source" meta={props.mediaAssets.length > 0 ? `${props.mediaAssets.length} in library` : 'Library empty'} />
      <div className="pro-artwork-source-actions">
        <button className="pro-wide-button" onClick={() => props.onOpenMediaLibrary(props.panel, 'library')}><ImageIcon size={16}/> Choose from library</button>
        <button className="pro-secondary-button" onClick={() => props.onOpenMediaLibrary(props.panel, 'upload')}><Upload size={16}/> Upload new</button>
      </div>
    </div>
    <div className="pro-card-section">
    <SectionTitle title="Choose a panel" meta={`${designedCount} of 6 designed`} />
    <div className="pro-panel-grid">{panels.map(item=>{
      const artwork = props.artworkByPanel[item];
      return <button key={item} className={props.panel===item?'is-selected':''} onClick={()=>props.setPanel(item)}>
        <span className={artwork?'has-art pro-panel-art':''}>{artwork ? <span className="artwork-layer" style={artworkCss(artwork)} /> : '+'}</span>
        <b>{item}</b>{artwork&&<i/>}
      </button>;
    })}</div>
    </div>
    <div className="pro-card-section">
    <SectionTitle title={`${props.panel} artwork`} meta={selectedArtwork ? 'Ready' : 'Empty'} />
    {selectedArtwork && <div className="pro-artwork-preview" aria-label={`${props.panel} artwork preview`}><span className="artwork-layer" style={artworkCss(selectedArtwork)} /></div>}
    <div className="pro-artwork-actions">
      <button className="pro-wide-button" onClick={() => props.onOpenMediaLibrary(props.panel, 'library')}><ImageIcon size={15}/>{selectedArtwork ? 'Change artwork' : 'Choose artwork'}</button>
    </div>
    {selectedArtwork && <button className="pro-remove-artwork" onClick={() => props.onRemoveArtwork(props.panel)}><Trash2 size={15}/> Remove artwork</button>}
    {selectedArtwork && <div className="pro-file"><Check size={15}/><span>{selectedArtwork.name}</span></div>}
    </div>
    <div className="pro-card-section">
    <SectionTitle title="How it fits" />
    <div className="pro-segmented">{(['fill','fit','tile'] as ArtworkMode[]).map(mode => <button
      key={mode}
      className={selectedArtwork?.mode === mode ? 'is-active' : ''}
      disabled={!selectedArtwork}
      onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, mode } } : current)}
    >{mode[0].toUpperCase() + mode.slice(1)}</button>)}</div>
    <p className="pro-help">{selectedArtwork?.mode === 'fill' ? 'Fills the whole panel. Some artwork may be cropped.' : selectedArtwork?.mode === 'tile' ? 'Repeats your artwork as a pattern.' : 'Shows the whole artwork without cropping.'}</p>
    <details className="pro-advanced" open={false}>
      <summary>Fine tune placement <ChevronDown size={16}/></summary>
      <div className="pro-advanced-body">
    <ControlRow label="Artwork size" value={selectedArtwork ? `${selectedArtwork.scale}%` : '—'} />
    <input className="pro-range" type="range" min="25" max="250" value={selectedArtwork?.scale ?? 100} disabled={!selectedArtwork} onChange={e => {
      const scale = Number(e.target.value);
      props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, scale } } : current);
    }}/>
    <ControlRow label="Rotation" value={selectedArtwork ? `${selectedArtwork.rotation}°` : '—'} />
    <input className="pro-range" type="range" min="-180" max="180" value={selectedArtwork?.rotation ?? 0} disabled={!selectedArtwork} onChange={e => {
      const rotation = Number(e.target.value);
      props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, rotation } } : current);
    }}/>
    <div className="pro-alignment">
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === -1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignX: -1 } } : current)}>↤</button>
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === 0 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignX: 0 } } : current)}>↔</button>
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === 1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignX: 1 } } : current)}>↦</button>
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === -1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignY: -1 } } : current)}>↥</button>
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === 0 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignY: 0 } } : current)}>↕</button>
      <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === 1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [props.panel]: { ...selectedArtwork, alignY: 1 } } : current)}>↧</button>
    </div>
      </div>
    </details>
    </div>
  </div>;
  }

  if (tool === 'material') return <div className="pro-inspector-content">
    <SectionTitle title="Finish" />
    <div className="pro-material-grid">{materials.map(item=><button key={item} className={props.material===item?'is-selected':''} onClick={()=>props.setMaterial(item)}><span className={`material-${item.toLowerCase().replaceAll(' ','-')}`}/><b>{item}</b></button>)}</div>
    <ControlRow label="Roughness" value="64" /><input className="pro-range" type="range" defaultValue="64"/>
    <ControlRow label="Reflectivity" value="18" /><input className="pro-range" type="range" defaultValue="18"/>
    <ControlRow label="Print depth" value="Subtle" /><input className="pro-range" type="range" defaultValue="22"/>
  </div>;

  if (tool === 'opening') return <div className="pro-inspector-content">
    <SectionTitle title="Closure" meta="Tuck top" />
    <div className="pro-opening-cards"><button className="is-selected"><PackageOpen/><span><b>Reverse tuck</b><small>Carton fixture</small></span></button><button><Box/><span><b>Mailer</b><small>Architecture proof</small></span></button><button><Layers3/><span><b>Drawer</b><small>Planned</small></span></button></div>
    <SectionTitle title="Open / close preview" meta={`${props.opening}%`} />
    <div className="pro-play-row"><button><CirclePlay size={18}/></button><input className="pro-range" type="range" value={props.opening} onChange={e=>props.setOpening(Number(e.target.value))}/></div>
    <ControlRow label="Duration" value="1.8 s" /><input className="pro-range" type="range" defaultValue="45"/>
    <div className="pro-callout"><Sparkles size={15}/><span>Scrubbing is interactive now; physically validated hinge geometry lands in the engine slice.</span></div>
  </div>;

  if (tool === 'scene') return <div className="pro-inspector-content">
    <SectionTitle title="Scene" meta="Arrange your mockup" />
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
    <button className="pro-primary pro-export-button" onClick={props.onExport}><Download size={15}/> Export live PNG</button>
    <div className="pro-import-box"><FileUp size={19}/><div><strong>Dieline to 3D</strong><span>Import SVG/DXF · classify cut/crease · assign folds</span></div><button onClick={()=>props.setMessage('Dieline import flow opened · parser not connected yet')}>Import</button></div>
  </div>;
}

function DielinePrototype({
  panel,
  artworkByPanel,
  dimensions,
  onPanelSelect,
}:{
  panel:string;
  artworkByPanel:ArtworkByPanel;
  dimensions:CartonDimensions;
  onPanelSelect:(panel:string)=>void;
}) {
  const cartonPanels = reverseTuckPanels(dimensions);
  const bounds = reverseTuckBounds(dimensions);
  return <div className="pro-dieline-stage">
    <div className="pro-dieline pro-dieline-live" style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}>
      {cartonPanels.map(item => {
        const panelName = item.label[0] + item.label.slice(1).toLowerCase();
        const artwork = artworkByPanel[panelName];
        const selectable = item.id !== 'glue';
        return <button
          key={item.id}
          type="button"
          disabled={!selectable}
          onClick={() => selectable && onPanelSelect(panelName)}
          className={`dl-live ${item.id === panel.toLowerCase() ? 'is-selected' : ''} dl-${item.kind} ${artwork ? 'has-artwork' : ''}`}
          style={{
            left: `${item.x / bounds.width * 100}%`,
            top: `${item.y / bounds.height * 100}%`,
            width: `${item.width / bounds.width * 100}%`,
            height: `${item.height / bounds.height * 100}%`,
            overflow: 'hidden',
          }}
          aria-label={selectable ? `Select ${panelName} panel` : 'Glue flap'}
        >
          {artwork && <span className="artwork-layer" style={artworkCss(artwork)} />}
          <span className="dl-label">{item.label}</span>
          {artwork && <b>ARTWORK</b>}
        </button>;
      })}
    </div>
    <div className="pro-dieline-legend"><span><i className="cut"/>Cut</span><span><i className="crease"/>Crease</span><span><i className="bleed"/>Bleed</span><strong>{panel} panel selected · shared structural source</strong></div>
  </div>;
}

function MediaLibraryModal(props: {
  assets: LocalMediaAsset[];
  artworkByPanel: ArtworkByPanel;
  targetPanel: string;
  tab: 'library' | 'upload';
  setTab: (tab:'library'|'upload')=>void;
  selectedAssetId: string | null;
  setSelectedAssetId: (id:string|null)=>void;
  onUpload: ()=>void;
  onUse: (asset:LocalMediaAsset)=>void;
  onDelete: (assetId:string)=>void;
  onClose: ()=>void;
}) {
  const selected = props.assets.find(asset => asset.id === props.selectedAssetId) ?? null;
  const usageCount = selected ? panels.filter(panel => props.artworkByPanel[panel]?.assetId === selected.id).length : 0;

  return <div className="pro-media-modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) props.onClose();
  }}>
    <section className="pro-media-modal" role="dialog" aria-modal="true" aria-label="Artwork library">
      <header className="pro-media-modal-header">
        <div>
          <span>Artwork</span>
          <h2>Media Library</h2>
        </div>
        <button aria-label="Close media library" onClick={props.onClose}><X size={20}/></button>
      </header>

      <div className="pro-media-tabs">
        <button className={props.tab === 'upload' ? 'is-active' : ''} onClick={() => props.setTab('upload')}>Upload files</button>
        <button className={props.tab === 'library' ? 'is-active' : ''} onClick={() => props.setTab('library')}>Media Library</button>
      </div>

      {props.tab === 'upload' ? <div className="pro-media-upload-pane">
        <div className="pro-media-dropzone">
          <Upload size={30}/>
          <h3>Upload artwork</h3>
          <p>Add PNG, JPG or WebP files to your library. You can reuse them across panels and future designs.</p>
          <button className="pro-primary" onClick={props.onUpload}>Select files</button>
          <span>Files stay in this local Studio session for now.</span>
        </div>
      </div> : <div className="pro-media-library-pane">
        <div className="pro-media-browser">
          <div className="pro-media-browser-toolbar">
            <label className="pro-search"><Search size={16}/><input placeholder="Search library" /></label>
            <button className="pro-secondary-button" onClick={props.onUpload}><Upload size={15}/> Upload new</button>
          </div>
          {props.assets.length === 0 ? <div className="pro-media-empty">
            <ImageIcon size={30}/>
            <h3>No artwork yet</h3>
            <p>Upload an image and it will appear here for reuse.</p>
            <button className="pro-primary" onClick={() => props.setTab('upload')}>Upload artwork</button>
          </div> : <div className="pro-media-grid">
            {props.assets.map(asset => {
              const used = panels.filter(panel => props.artworkByPanel[panel]?.assetId === asset.id).length;
              return <button
                key={asset.id}
                className={`pro-media-tile ${props.selectedAssetId === asset.id ? 'is-selected' : ''}`}
                aria-pressed={props.selectedAssetId === asset.id}
                onClick={() => props.setSelectedAssetId(asset.id)}
              >
                <img src={asset.url} alt={asset.name} />
                {props.selectedAssetId === asset.id && <span className="pro-media-check"><Check size={14}/></span>}
                {used > 0 && <span className="pro-media-usage">{used}</span>}
              </button>;
            })}
          </div>}
        </div>

        <aside className="pro-media-details">
          {selected ? <>
            <img className="pro-media-detail-preview" src={selected.url} alt={selected.name} />
            <h3>{selected.name}</h3>
            <dl>
              <div><dt>Type</dt><dd>{selected.mimeType.replace('image/','').toUpperCase()}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(selected.byteSize)}</dd></div>
              {selected.width && selected.height && <div><dt>Dimensions</dt><dd>{selected.width} × {selected.height}</dd></div>}
              <div><dt>Used</dt><dd>{usageCount === 0 ? 'Not used yet' : `${usageCount} panel${usageCount === 1 ? '' : 's'}`}</dd></div>
            </dl>
            <button
              className="pro-media-delete-link"
              disabled={usageCount > 0}
              title={usageCount > 0 ? 'Remove this artwork from every panel before deleting it' : 'Delete permanently from this local library'}
              onClick={() => {
                props.onDelete(selected.id);
                props.setSelectedAssetId(null);
              }}
            ><Trash2 size={14}/> Delete permanently</button>
          </> : <div className="pro-media-detail-empty">
            <ImageIcon size={28}/>
            <p>Select an image to see its details.</p>
          </div>}
        </aside>
      </div>}

      <footer className="pro-media-modal-footer">
        <span>{props.tab === 'library' ? `Choose artwork for ${props.targetPanel}` : 'Upload files to your library'}</span>
        <div>
          <button className="pro-secondary-button" onClick={props.onClose}>Cancel</button>
          {props.tab === 'library' && <button className="pro-primary" disabled={!selected} onClick={() => selected && props.onUse(selected)}>Use on {props.targetPanel}</button>}
        </div>
      </footer>
    </section>
  </div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PanelIntro({title,text}:{title:string;text:string}) {
  return <div className="pro-panel-intro"><h3>{title}</h3><p>{text}</p></div>;
}

function SectionTitle({title,meta}:{title:string;meta?:string}) { return <div className="pro-section-title"><strong>{title}</strong>{meta&&<span>{meta}</span>}</div>; }
function ControlRow({label,value}:{label:string;value:string}) { return <div className="pro-control-row"><span>{label}</span><strong>{value}</strong></div>; }
function Field({label,value,onChange}:{label:string;value:string;onChange?:(value:number)=>void}) { return <label><span>{label}</span><input type="number" value={value} onChange={e=>onChange?.(Number(e.target.value))}/></label>; }
function ExportCard({icon,title,text,active=false}:{icon:React.ReactNode;title:string;text:string;active?:boolean}) { return <button className={`pro-export-card ${active?'is-selected':''}`}>{icon}<span><b>{title}</b><small>{text}</small></span></button>; }
