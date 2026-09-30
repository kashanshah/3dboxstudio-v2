'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Boxes, Camera, Check, ChevronDown, CirclePlay, Download,
  Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2,
  PackageOpen, Search, Share2, Sparkles, ZoomIn, ZoomOut,
  Trash2, Upload, X
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { CartonEngine, type CartonEngineHandle } from '@/components/studio/carton-engine';
import { DEFAULT_CARTON_DIMENSIONS, reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { artworkCss, defaultArtworkPlacement, type ArtworkByPanel, type ArtworkMode, type LocalMediaAsset } from '@/lib/packaging/artwork';
import { PACKAGING_TEMPLATES, getPackagingTemplateCategories, type PackagingTemplateDefinition } from '@/lib/packaging/template-registry';

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

const materials = ['White board','Kraft','Soft touch','Matte coated','Gloss coated','Foil'];
const cameras = ['Perspective','Front','Back','Left','Right','Top'];

export function StudioShell() {
  const [tool, setTool] = useState<Tool | null>(null);
  const [mode, setMode] = useState<Mode>('3d');
  const [family, setFamily] = useState('Reverse Tuck End Carton');
  const [selectedTemplateId, setSelectedTemplateId] = useState('reverse-tuck-carton');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [panel, setPanel] = useState('Front');
  const [artworkScope, setArtworkScope] = useState<'outside' | 'inside'>('outside');
  const [material, setMaterial] = useState('Soft touch');
  const [camera, setCamera] = useState('Perspective');
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [opening, setOpening] = useState(100);
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
  const [message, setMessage] = useState('Ready');
  const fileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<CartonEngineHandle>(null);
  const faceActionRef = useRef<HTMLDivElement>(null);
  const cameraMenuRef = useRef<HTMLDivElement>(null);
  const foldAnimationRef = useRef<number | null>(null);

  const activeLabel = tools.find(item => item.id === tool)?.label ?? 'Tools';
  const boxStyle = useMemo(() => ({ '--studio-zoom': zoom / 100 }) as React.CSSProperties, [zoom]);
  const artworkKey = (targetPanel = panel, scope = artworkScope) => scope === 'inside' ? `Interior ${targetPanel}` : targetPanel;
  const parseArtworkTarget = (target: string) => target.startsWith('Interior ')
    ? { scope: 'inside' as const, panel: target.replace('Interior ', '') }
    : { scope: 'outside' as const, panel: target };

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => () => {
    for (const asset of mediaAssetsRef.current) URL.revokeObjectURL(asset.url);
    if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
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

  const chooseTemplate = (template: PackagingTemplateDefinition) => {
    if (template.status !== 'ready') {
      setMessage(`${template.name} is in the catalog, but its real geometry is not ready yet`);
      return;
    }
    setSelectedTemplateId(template.id);
    setFamily(template.name);
    if (template.defaultDimensions) setDimensions(template.defaultDimensions);
    setMessage(`${template.name} selected`);
  };

  const chooseTool = (id: Tool) => {
    if (tool === id && inspectorOpen) {
      setInspectorOpen(false);
      setTool(null);
      return;
    }
    setTool(id);
    setInspectorOpen(true);
  };

  const applyAssetToPanel = (asset: LocalMediaAsset, targetPanel = artworkKey()) => {
    setArtworkByPanel(current => ({
      ...current,
      [targetPanel]: defaultArtworkPlacement(asset.name, asset.url, asset.id),
    }));
    const parsed = parseArtworkTarget(targetPanel);
    setArtworkScope(parsed.scope);
    setPanel(parsed.panel);
    setTool('artwork');
    setInspectorOpen(true);
    setMediaLibraryOpen(false);
    setMessage(`${asset.name} applied to ${parsed.scope === 'inside' ? 'inside ' : ''}${parsed.panel}`);
  };

  const openMediaLibrary = (targetPanel = artworkKey(), tab: 'library' | 'upload' = 'library') => {
    const currentAssetId = artworkByPanel[targetPanel]?.assetId ?? mediaAssets[0]?.id ?? null;
    const parsed = parseArtworkTarget(targetPanel);
    setMediaTargetPanel(targetPanel);
    setArtworkScope(parsed.scope);
    setPanel(parsed.panel);
    setSelectedMediaAssetId(currentAssetId);
    setMediaLibraryTab(tab);
    setMediaLibraryOpen(true);
  };

  const handleArtworkFiles = (files: File[]) => {
    const imageFiles = files.filter(file => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type));
    if (imageFiles.length === 0) {
      setMessage('Use PNG, JPG or WebP artwork');
      return;
    }

    const existingByFingerprint = new Map(mediaAssetsRef.current.map(asset => [asset.fingerprint, asset]));
    const newAssets: LocalMediaAsset[] = [];
    let selectedId: string | null = null;

    for (const file of imageFiles) {
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      const existing = existingByFingerprint.get(fingerprint);
      if (existing) {
        selectedId ??= existing.id;
        continue;
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
      existingByFingerprint.set(fingerprint, asset);
      newAssets.push(asset);
      selectedId ??= id;

      const image = new Image();
      image.onload = () => {
        setMediaAssets(current => current.map(item => item.id === id
          ? { ...item, width: image.naturalWidth, height: image.naturalHeight }
          : item));
      };
      image.src = url;
    }

    if (newAssets.length > 0) {
      setMediaAssets(current => [...newAssets, ...current]);
      setMessage(`${newAssets.length} image${newAssets.length === 1 ? '' : 's'} added to your library`);
    } else {
      setMessage('Those images are already in your library');
    }

    if (selectedId) setSelectedMediaAssetId(selectedId);
    setMediaLibraryTab('library');
    setMediaLibraryOpen(true);
  };


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

  const animateFold = (target: 0 | 100) => {
    if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
    const start = opening;
    const startedAt = performance.now();
    const duration = 1500;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setOpening(start + (target - start) * eased);
      if (progress < 1) foldAnimationRef.current = requestAnimationFrame(frame);
      else foldAnimationRef.current = null;
    };

    foldAnimationRef.current = requestAnimationFrame(frame);
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

  return <><input ref={fileRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{ handleArtworkFiles(Array.from(e.target.files ?? [])); e.currentTarget.value=''; }}/><main className="pro-studio" style={boxStyle}>
    <header className="pro-studio-header">
      <div className="pro-project">
        <Brand />
        <span className="pro-divider" />
        <div className="pro-project-copy"><strong>Noma Tea — Spring</strong><span>Local design</span></div>
      </div>
      <div className="pro-header-actions">
        <button className="pro-primary" onClick={() => chooseTool('export')}><Download size={16} /> <span>Export</span></button>
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
            <button className={mode === 'dieline' ? 'is-active' : ''} onClick={() => { setMode('dieline'); setFaceAction(null); setCameraMenuOpen(false); }}><Grid3X3 size={14} /> Dieline</button>
            <button className={mode === '3d' ? 'is-active' : ''} onClick={() => { setMode('3d'); setFaceAction(null); }}><Boxes size={14} /> 3D Preview</button>
          </div>
          {mode === '3d' && <div className="pro-camera-menu" ref={cameraMenuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={cameraMenuOpen}
              onClick={() => setCameraMenuOpen(open => !open)}
            >
              <Camera size={16} />
              <span>Camera Angle</span>
              <small>{camera}</small>
              <ChevronDown size={14} className={cameraMenuOpen ? 'is-open' : ''} />
            </button>
            {cameraMenuOpen && <div className="pro-camera-popover pro-camera-angle-grid" role="menu" aria-label="Camera angles">
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
              >
                <span className={`pro-camera-view-icon is-${item.toLowerCase()}`} aria-hidden="true"><i/><i/><i/></span>
                <b>{item}</b>
              </button>)}
            </div>}
          </div>}
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
            onZoomChange={setZoom}
            onPanelSelect={(selectedPanel, point) => {
              const parsed = parseArtworkTarget(selectedPanel);
              setArtworkScope(parsed.scope);
              setPanel(parsed.panel);
              setFaceAction({ panel: selectedPanel, x: point.x, y: point.y });
              setMessage(`${parsed.scope === 'inside' ? 'Inside ' : ''}${parsed.panel} selected from the 3D carton`);
            }}
          />
          <div className="pro-stage-meta"><span>{family}</span><span>{material}</span><span>Closed {Math.round(opening)}%</span></div>

          <div className="pro-canvas-control-bar" aria-label="Canvas controls">
            <button className="pro-canvas-bar-icon" title="Zoom out" aria-label="Zoom out" onClick={() => setZoom(Math.max(40, zoom - 10))}>
              <ZoomOut size={20}/>
            </button>
            <button className="pro-canvas-bar-icon" title="Zoom in" aria-label="Zoom in" onClick={() => setZoom(Math.min(140, zoom + 10))}>
              <ZoomIn size={20}/>
            </button>
            <span className="pro-canvas-bar-divider" />
            <button
              className="pro-canvas-bar-play"
              aria-label={opening >= 50 ? 'Open box' : 'Close box'}
              title={opening >= 50 ? 'Open box' : 'Close box'}
              onClick={() => animateFold(opening >= 50 ? 0 : 100)}
            >
              <CirclePlay size={19}/>
            </button>
            <span className="pro-canvas-bar-label">Open</span>
            <input
              className="pro-canvas-bar-range"
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(opening)}
              aria-label="Open or close box"
              onChange={e => setOpening(Number(e.target.value))}
            />
            <span className="pro-canvas-bar-label">Closed</span>
            <span className="pro-canvas-bar-divider" />
            <button
              className="pro-canvas-bar-icon"
              title="Fit view"
              aria-label="Fit view"
              onClick={() => {
                setZoom(82);
                engineRef.current?.resetCamera();
              }}
            >
              <Maximize2 size={20}/>
            </button>
          </div>

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
          artworkScope={artworkScope}
          dimensions={dimensions}
          onPanelSelect={(selectedPanel) => {
            setPanel(selectedPanel);
            setMessage(`${selectedPanel} panel selected from the dieline`);
          }}
        />}

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
        {tool && <Inspector tool={tool} family={family} setFamily={setFamily} selectedTemplateId={selectedTemplateId} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} templateCategory={templateCategory} setTemplateCategory={setTemplateCategory} onChooseTemplate={chooseTemplate} panel={panel} setPanel={setPanel} artworkScope={artworkScope} setArtworkScope={setArtworkScope} material={material} setMaterial={setMaterial} opening={opening} setOpening={setOpening} dimensions={dimensions} setDimensions={setDimensions} artworkByPanel={artworkByPanel} setArtworkByPanel={setArtworkByPanel} mediaAssets={mediaAssets} onOpenMediaLibrary={openMediaLibrary} onRemoveArtwork={removeArtwork} onExport={exportPng} onAnimateFold={animateFold} setMessage={setMessage} />}
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
      onDropFiles={handleArtworkFiles}
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
  tool: Tool; family: string; setFamily: (v:string)=>void;
  selectedTemplateId:string; templateSearch:string; setTemplateSearch:(v:string)=>void; templateCategory:string; setTemplateCategory:(v:string)=>void; onChooseTemplate:(template:PackagingTemplateDefinition)=>void;
  panel:string; setPanel:(v:string)=>void;
  artworkScope:'outside'|'inside'; setArtworkScope:(v:'outside'|'inside')=>void;
  material:string; setMaterial:(v:string)=>void; opening:number; setOpening:(v:number)=>void;
  dimensions:CartonDimensions; setDimensions:(v:CartonDimensions)=>void;
  artworkByPanel:ArtworkByPanel; setArtworkByPanel:React.Dispatch<React.SetStateAction<ArtworkByPanel>>;
  mediaAssets: LocalMediaAsset[];
  onOpenMediaLibrary:(panel?:string,tab?:'library'|'upload')=>void; onRemoveArtwork:(panel:string)=>void;
  onExport:()=>void; onAnimateFold:(target:0|100)=>void; setMessage:(v:string)=>void;
}) {
  const { tool } = props;
  if (tool === 'structure') {
    const categories = getPackagingTemplateCategories();
    const query = props.templateSearch.trim().toLowerCase();
    const templates = PACKAGING_TEMPLATES.filter(template => {
      const categoryMatch = props.templateCategory === 'All' || template.category === props.templateCategory;
      const searchMatch = !query || [template.name, template.shortName, template.category, ...template.tags]
        .some(value => value.toLowerCase().includes(query));
      return categoryMatch && searchMatch;
    });
    const selectedTemplate = PACKAGING_TEMPLATES.find(template => template.id === props.selectedTemplateId) ?? PACKAGING_TEMPLATES[0];

    return <div className="pro-inspector-content pro-structure-content">
      <PanelIntro title="Choose your packaging" text="Browse a growing library of real packaging structures. Pick a template first, then set its size." />

      <div className="pro-structure-current">
        <span>Current template</span>
        <div>
          <TemplateVisual template={selectedTemplate} compact />
          <div>
            <strong>{selectedTemplate.name}</strong>
            <small>{selectedTemplate.category} · Ready to edit</small>
          </div>
        </div>
      </div>

      <label className="pro-search pro-structure-search">
        <Search size={18}/>
        <input value={props.templateSearch} onChange={e=>props.setTemplateSearch(e.target.value)} placeholder="Search packaging templates" />
      </label>

      <div className="pro-structure-categories" aria-label="Template categories">
        {categories.map(category => <button
          key={category}
          className={props.templateCategory === category ? 'is-active' : ''}
          onClick={()=>props.setTemplateCategory(category)}
        >{category}</button>)}
      </div>

      <div className="pro-template-grid">
        {templates.map(template => {
          const active = template.id === props.selectedTemplateId;
          return <button
            key={template.id}
            className={`pro-template-card ${active ? 'is-selected' : ''} ${template.status === 'planned' ? 'is-planned' : ''}`}
            onClick={()=>props.onChooseTemplate(template)}
          >
            <TemplateVisual template={template} />
            <div className="pro-template-card-copy">
              <strong>{template.shortName}</strong>
              <span>{template.category}</span>
            </div>
            <small className={template.status === 'ready' ? 'is-ready' : ''}>{template.status === 'ready' ? 'Ready' : 'Coming soon'}</small>
          </button>;
        })}
      </div>

      {templates.length === 0 && <div className="pro-template-empty">
        <Search size={24}/>
        <strong>No templates found</strong>
        <span>Try another search or category.</span>
      </div>}

      <div className="pro-card-section pro-structure-size-card">
        <SectionTitle title="Finished size" meta="Outside measurements" />
        <div className="pro-fields">
          <Field label="Width" value={String(props.dimensions.width)} onChange={value=>props.setDimensions({...props.dimensions,width:value})}/>
          <Field label="Height" value={String(props.dimensions.height)} onChange={value=>props.setDimensions({...props.dimensions,height:value})}/>
          <Field label="Depth" value={String(props.dimensions.depth)} onChange={value=>props.setDimensions({...props.dimensions,depth:value})}/>
        </div>
        <p className="pro-help">Measure the finished package after it is folded and closed.</p>
        <details className="pro-advanced">
          <summary>Material thickness <ChevronDown size={17}/></summary>
          <div className="pro-advanced-body">
            <ControlRow label="Board thickness" value={`${props.dimensions.thickness.toFixed(1)} mm`} />
            <input className="pro-range" type="range" min="3" max="20" value={Math.round(props.dimensions.thickness*10)} onChange={e=>props.setDimensions({...props.dimensions,thickness:Number(e.target.value)/10})} />
          </div>
        </details>
      </div>
    </div>;
  }

  if (tool === 'artwork') {
    const selectedKey = props.artworkScope === 'inside' ? `Interior ${props.panel}` : props.panel;
    const selectedArtwork = props.artworkByPanel[selectedKey];
    return <div className="pro-inspector-content">
      <PanelIntro title="Place your design" text="Click any side of the box or dieline, then choose or upload artwork for that surface." />

      <div className="pro-artwork-context">
        <div>
          <span>Selected surface</span>
          <strong>{props.artworkScope === 'inside' ? 'Inside ' : ''}{props.panel}</strong>
        </div>
        <div className="pro-scope-switch" role="group" aria-label="Artwork side">
          <button className={props.artworkScope === 'outside' ? 'is-active' : ''} onClick={() => props.setArtworkScope('outside')}>Outside</button>
          <button className={props.artworkScope === 'inside' ? 'is-active' : ''} onClick={() => props.setArtworkScope('inside')}>Inside</button>
        </div>
      </div>

      <div className="pro-card-section pro-artwork-design-card">
        <div className="pro-artwork-source-head">
          <div>
            <strong>Design on this side</strong>
            <span>{selectedArtwork ? 'Your image is ready. Change it or adjust how it sits on the box.' : 'Choose an image to place on this side.'}</span>
          </div>
          {props.mediaAssets.length > 0 && <small>{props.mediaAssets.length} saved</small>}
        </div>

        {selectedArtwork && <div className="pro-current-artwork">
          <div className="pro-current-artwork-preview"><span className="artwork-layer" style={artworkCss(selectedArtwork)} /></div>
          <div className="pro-current-artwork-copy">
            <b>{selectedArtwork.name}</b>
            <small>{props.artworkScope === 'inside' ? 'Inside ' : ''}{props.panel}</small>
          </div>
          <button className="pro-current-artwork-remove" aria-label="Remove artwork" onClick={() => props.onRemoveArtwork(selectedKey)}><Trash2 size={15}/></button>
        </div>}

        <div className="pro-artwork-choice-row">
          <button className="pro-artwork-source-primary" onClick={() => props.onOpenMediaLibrary(selectedKey, 'library')}>
            <span className="pro-artwork-source-icon"><ImageIcon size={17}/></span>
            <span><b>{selectedArtwork ? 'Change image' : 'Choose image'}</b><small>From your library</small></span>
            <ChevronDown size={16}/>
          </button>
          <button className="pro-artwork-source-upload" onClick={() => props.onOpenMediaLibrary(selectedKey, 'upload')}>
            <Upload size={15}/> Upload new
          </button>
        </div>

        <div className="pro-artwork-fit-section">
          <div className="pro-artwork-fit-head">
            <strong>Image fit</strong>
            <span>{selectedArtwork?.mode === 'fill' ? 'Covers the whole side' : selectedArtwork?.mode === 'tile' ? 'Repeats as a pattern' : 'Shows the whole image'}</span>
          </div>
          <div className="pro-fit-options">{(['fill','fit','tile'] as ArtworkMode[]).map(mode => {
            const copy = mode === 'fill'
              ? { label: 'Cover', hint: 'Edge to edge' }
              : mode === 'fit'
                ? { label: 'Fit', hint: 'Show it all' }
                : { label: 'Repeat', hint: 'Make a pattern' };
            return <button
              key={mode}
              className={selectedArtwork?.mode === mode ? 'is-active' : ''}
              disabled={!selectedArtwork}
              onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, mode } } : current)}
            ><b>{copy.label}</b><small>{copy.hint}</small></button>;
          })}</div>
        </div>

        <details className="pro-advanced pro-placement-details" open={false}>
          <summary>Adjust placement <ChevronDown size={16}/></summary>
          <div className="pro-advanced-body">
            <ControlRow label="Rotate" value={selectedArtwork ? `${selectedArtwork.rotation}°` : '—'} />
            <input className="pro-range" type="range" min="-180" max="180" value={selectedArtwork?.rotation ?? 0} disabled={!selectedArtwork} onChange={e => {
              const rotation = Number(e.target.value);
              props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, rotation } } : current);
            }}/>
            <div className="pro-alignment">
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === -1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignX: -1 } } : current)}>↤</button>
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === 0 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignX: 0 } } : current)}>↔</button>
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignX === 1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignX: 1 } } : current)}>↦</button>
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === -1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignY: -1 } } : current)}>↥</button>
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === 0 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignY: 0 } } : current)}>↕</button>
              <button disabled={!selectedArtwork} className={selectedArtwork?.alignY === 1 ? 'is-active' : ''} onClick={() => props.setArtworkByPanel(current => selectedArtwork ? { ...current, [selectedKey]: { ...selectedArtwork, alignY: 1 } } : current)}>↧</button>
            </div>
          </div>
        </details>
      </div>
    </div>;
  }

  if (tool === 'material') return <div className="pro-inspector-content">
    <PanelIntro title="Choose a finish" text="Pick the surface that best matches how you want the package to feel." />
    <div className="pro-material-grid">{materials.map(item=><button key={item} className={props.material===item?'is-selected':''} onClick={()=>props.setMaterial(item)}><span className={`material-${item.toLowerCase().replaceAll(' ','-')}`}/><b>{item}</b></button>)}</div>
    <div className="pro-callout"><Sparkles size={16}/><span>More detailed finish controls like gloss, roughness, foil, and print effects will appear here as they become functional.</span></div>
  </div>;

  if (tool === 'opening') {
    const stage = props.opening <= 4
      ? 'Flat dieline'
      : props.opening < 52
        ? 'Raising the walls'
        : props.opening < 68
          ? 'Wrapping the back'
          : props.opening < 84
            ? 'Closing the bottom'
            : props.opening < 99
              ? 'Closing the top'
              : 'Assembled box';

    return <div className="pro-inspector-content">
      <PanelIntro title="Open or close your box" text="Drag the slider to move smoothly between the fully open structure and the finished closed package." />
      <div className="pro-card-section pro-fold-card">
        <div className="pro-fold-heading">
          <div><span>Open / close</span><strong>{stage}</strong></div>
          <b>{Math.round(props.opening)}%</b>
        </div>
        <input
          className="pro-range pro-fold-range"
          aria-label="Open or close box"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(props.opening)}
          onChange={e=>props.setOpening(Number(e.target.value))}
        />
        <div className="pro-fold-endpoints"><span>Open</span><span>Closed</span></div>
        <button className="pro-fold-play" onClick={() => props.onAnimateFold(props.opening >= 50 ? 0 : 100)}>
          <CirclePlay size={20}/>
          {props.opening >= 50 ? 'Open box' : 'Close box'}
        </button>
      </div>
      <div className="pro-callout"><Sparkles size={16}/><span>Artwork stays attached to each surface throughout the fold.</span></div>
    </div>;
  }

  if (tool === 'scene') return <div className="pro-inspector-content">
    <PanelIntro title="Build a scene" text="Arrange multiple packages, backgrounds, and lighting for presentation-ready mockups." />
    <div className="pro-feature-empty">
      <Lightbulb size={28}/>
      <strong>Scene builder is coming next</strong>
      <p>For now, keep working with the package itself. Multi-object layouts, lighting, backgrounds, and floor controls will be added here when they are functional.</p>
    </div>
  </div>;

  return <div className="pro-inspector-content">
    <PanelIntro title="Export your design" text="Download the current 3D view now. More export formats will appear here as they become available." />
    <div className="pro-export-ready">
      <ImageIcon size={22}/>
      <div><strong>PNG image</strong><span>Exports the current 3D camera view.</span></div>
    </div>
    <button className="pro-primary pro-export-button" onClick={props.onExport}><Download size={16}/> Download PNG</button>

    <div className="pro-export-coming">
      <span>Coming soon</span>
      <div><CirclePlay size={18}/><p><strong>Animation</strong><small>Turntable and open / close video</small></p></div>
      <div><Share2 size={18}/><p><strong>Share link</strong><small>Send an interactive review link</small></p></div>
      <div><Grid3X3 size={18}/><p><strong>Production dieline</strong><small>PDF, SVG, and DXF export</small></p></div>
    </div>
  </div>;
}

function DielinePrototype({
  panel,
  artworkByPanel,
  artworkScope,
  dimensions,
  onPanelSelect,
}:{
  panel:string;
  artworkByPanel:ArtworkByPanel;
  artworkScope:'outside'|'inside';
  dimensions:CartonDimensions;
  onPanelSelect:(panel:string)=>void;
}) {
  const cartonPanels = reverseTuckPanels(dimensions);
  const bounds = reverseTuckBounds(dimensions);
  return <div className="pro-dieline-stage">
    <div className="pro-dieline pro-dieline-live" style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}>
      {cartonPanels.map(item => {
        const panelName = item.label[0] + item.label.slice(1).toLowerCase();
        const artwork = artworkByPanel[artworkScope === 'inside' ? `Interior ${panelName}` : panelName];
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
    <div className="pro-dieline-legend"><span><i className="cut"/>Cut</span><span><i className="crease"/>Crease</span><span><i className="bleed"/>Bleed</span><strong>{artworkScope === 'inside' ? 'Inside ' : ''}{panel} selected · shared structural source</strong></div>
  </div>;
}

function TemplateVisual({template,compact=false}:{template:PackagingTemplateDefinition;compact?:boolean}) {
  const visualClass = template.family === 'bottle'
    ? 'is-bottle'
    : template.family === 'jar'
      ? 'is-jar'
      : template.family === 'pouch'
        ? 'is-pouch'
        : template.family === 'cup'
          ? 'is-cup'
          : template.family === 'can'
            ? 'is-can'
            : template.family === 'rigid-box'
              ? 'is-rigid'
              : template.family === 'corrugated'
                ? 'is-corrugated'
                : template.id.includes('sleeve')
                  ? 'is-sleeve'
                  : 'is-carton';

  return <span className={`pro-template-visual ${visualClass} ${compact ? 'is-compact' : ''}`} aria-hidden="true">
    <i className="shape-main"/>
    <i className="shape-side"/>
    <i className="shape-top"/>
  </span>;
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
  onDropFiles: (files:File[])=>void;
  onUse: (asset:LocalMediaAsset)=>void;
  onDelete: (assetId:string)=>void;
  onClose: ()=>void;
}) {
  const [dragging, setDragging] = useState(false);
  const selected = props.assets.find(asset => asset.id === props.selectedAssetId) ?? null;
  const usageCount = selected ? Object.values(props.artworkByPanel).filter(artwork => artwork.assetId === selected.id).length : 0;

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
        <div
          className={`pro-media-dropzone ${dragging ? 'is-dragging' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDragging(true); }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            props.onDropFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <Upload size={30}/>
          <h3>{dragging ? 'Drop files here' : 'Drag artwork here'}</h3>
          <p>Drop PNG, JPG or WebP files here, or choose files from your device. Uploaded images are reusable across panels and designs.</p>
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
              const used = Object.values(props.artworkByPanel).filter(artwork => artwork.assetId === asset.id).length;
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
        <span>{props.tab === 'library' ? `Choose artwork for ${props.targetPanel.replace('Interior ', 'Inside ')}` : 'Upload files to your library'}</span>
        <div>
          <button className="pro-secondary-button" onClick={props.onClose}>Cancel</button>
          {props.tab === 'library' && <button className="pro-primary" disabled={!selected} onClick={() => selected && props.onUse(selected)}>Use on {props.targetPanel.replace('Interior ', 'Inside ')}</button>}
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