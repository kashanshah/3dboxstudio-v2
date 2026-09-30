'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Box, Boxes, Camera, Check, ChevronDown, CirclePlay, Copy, Download,
  Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2, Move,
  PackageOpen, Search, Share2, Sparkles, ZoomIn, ZoomOut,
  Trash2, Upload, X
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { CartonEngine, type CartonEngineHandle } from '@/components/studio/carton-engine';
import { DEFAULT_CARTON_DIMENSIONS, reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { artworkCss, defaultArtworkPlacement, type ArtworkByPanel, type ArtworkMode, type ArtworkPlacement, type LocalMediaAsset } from '@/lib/packaging/artwork';
import { PACKAGING_TEMPLATES, getPackagingTemplateCategories, type PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import { parseDielineFile, type ParsedDieline } from '@/lib/packaging/dieline-import';
import { createInitialDielineMapping, mappingProgress, panelCandidates, primitiveSummary, type DielineMapping, type DielineLineRole, type DielinePanelName } from '@/lib/packaging/dieline-mapping';
import { DEFAULT_FULL_DIELINE_TRANSFORM, rasterizeFullDielineLayers, type FullDielineArtworkLayer, type FullDielineTransform } from '@/lib/packaging/full-dieline-artwork';

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
  const [fullDielineLayers, setFullDielineLayers] = useState<FullDielineArtworkLayer[]>([]);
  const [selectedFullDielineLayerId, setSelectedFullDielineLayerId] = useState<string | null>(null);
  const [mappedFullDielineArtwork, setMappedFullDielineArtwork] = useState<ArtworkByPanel>({});
  const liveMapTokenRef = useRef(0);
  const [mediaAssets, setMediaAssets] = useState<LocalMediaAsset[]>([]);
  const mediaAssetsRef = useRef<LocalMediaAsset[]>([]);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<'library' | 'upload'>('library');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(null);
  const [mediaTargetPanel, setMediaTargetPanel] = useState('Front');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [faceAction, setFaceAction] = useState<{ panel: string; x: number; y: number } | null>(null);
  const [message, setMessage] = useState('Ready');
  const [importedDieline, setImportedDieline] = useState<ParsedDieline | null>(null);
  const [dielineMapping, setDielineMapping] = useState<DielineMapping | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dielineFileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<CartonEngineHandle>(null);
  const faceActionRef = useRef<HTMLDivElement>(null);
  const cameraMenuRef = useRef<HTMLDivElement>(null);
  const foldAnimationRef = useRef<number | null>(null);

  const activeLabel = tools.find(item => item.id === tool)?.label ?? 'Tools';
  const boxStyle = useMemo(() => ({ '--studio-zoom': zoom / 100 }) as React.CSSProperties, [zoom]);
  const resolvedArtworkByPanel = useMemo<ArtworkByPanel>(() => {
    return { ...mappedFullDielineArtwork, ...artworkByPanel };
  }, [artworkByPanel, mappedFullDielineArtwork]);
  const artworkKey = (targetPanel = panel, scope = artworkScope) => scope === 'inside' ? `Interior ${targetPanel}` : targetPanel;
  const parseArtworkTarget = (target: string) => target.startsWith('Interior ')
    ? { scope: 'inside' as const, panel: target.replace('Interior ', '') }
    : { scope: 'outside' as const, panel: target };

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => {
    const token = ++liveMapTokenRef.current;
    if (!fullDielineLayers.length) {
      setMappedFullDielineArtwork({});
      return;
    }

    const timeout = window.setTimeout(() => {
      void rasterizeFullDielineLayers(fullDielineLayers, dimensions)
        .then(mapped => {
          if (liveMapTokenRef.current !== token) return;
          setMappedFullDielineArtwork(mapped);
          setMessage('3D preview synced');
        })
        .catch(() => {
          if (liveMapTokenRef.current !== token) return;
          setMessage('Could not sync artwork to 3D');
        });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [fullDielineLayers, dimensions]);

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

  const applyAssetToPanel = (
    asset: LocalMediaAsset,
    targetPanel = artworkKey(),
    options?: { mode?: ArtworkMode; scale?: number; rotation?: number },
  ) => {
    if (targetPanel === '__FULL_DIELINE__') {
      const scale = options?.scale ?? 100;
      const layerId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const layer: FullDielineArtworkLayer = {
        id: layerId,
        assetId: asset.id,
        name: asset.name,
        url: asset.url,
        transform: {
          ...DEFAULT_FULL_DIELINE_TRANSFORM,
          width: DEFAULT_FULL_DIELINE_TRANSFORM.width * scale / 100,
          rotation: options?.rotation ?? 0,
        },
      };
      setFullDielineLayers(current => [...current, layer]);
      setSelectedFullDielineLayerId(layerId);
      setMediaLibraryOpen(false);
      setMode('dieline');
      setMessage(`${asset.name} added as a new 2D layer`);
      return;
    }

    const placement = {
      ...defaultArtworkPlacement(asset.name, asset.url, asset.id),
      ...(options?.mode ? { mode: options.mode } : {}),
      ...(typeof options?.scale === 'number' ? { scale: options.scale } : {}),
      ...(typeof options?.rotation === 'number' ? { rotation: options.rotation } : {}),
    };
    setArtworkByPanel(current => ({
      ...current,
      [targetPanel]: placement,
    }));
    const parsed = parseArtworkTarget(targetPanel);
    setArtworkScope(parsed.scope);
    setPanel(parsed.panel);
    setTool('artwork');
    setInspectorOpen(true);
    setMediaLibraryOpen(false);
    setMessage(`${asset.name} applied to ${parsed.scope === 'inside' ? 'inside ' : ''}${parsed.panel}`);
  };

  const openMediaLibrary = (targetPanel = artworkKey(), tab?: 'library' | 'upload') => {
    const selectedLayer = fullDielineLayers.find(layer => layer.id === selectedFullDielineLayerId);
    const currentAssetId = targetPanel === '__FULL_DIELINE__'
      ? selectedLayer?.assetId ?? mediaAssets[0]?.id ?? null
      : artworkByPanel[targetPanel]?.assetId ?? mediaAssets[0]?.id ?? null;
    const initialTab = tab ?? (mediaAssets.length > 0 ? 'library' : 'upload');

    setMediaTargetPanel(targetPanel);
    if (targetPanel !== '__FULL_DIELINE__') {
      const parsed = parseArtworkTarget(targetPanel);
      setArtworkScope(parsed.scope);
      setPanel(parsed.panel);
    }
    setSelectedMediaAssetId(currentAssetId);
    setMediaLibraryTab(initialTab);
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


  const handleDielineFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseDielineFile(file);
      if (!parsed.primitives.length) {
        setMessage(`${file.name}: no supported vector geometry found`);
        return;
      }
      setImportedDieline(parsed);
      setDielineMapping(createInitialDielineMapping(parsed));
      setMode('dieline');
      setTool('structure');
      setInspectorOpen(true);
      const known = parsed.primitives.filter(item => item.role !== 'unknown').length;
      setMessage(`${file.name} imported · ${parsed.primitives.length} vector element${parsed.primitives.length === 1 ? '' : 's'}${known ? ` · ${known} classified cut/crease` : ''}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import dieline');
    }
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
    const inUse = fullDielineLayers.some(layer => layer.assetId === assetId) || Object.values(artworkByPanel).some(artwork => artwork.assetId === assetId);
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

  const updateFullDielineLayer = (layerId: string, transform: FullDielineTransform) => {
    setFullDielineLayers(current => current.map(layer => layer.id === layerId ? { ...layer, transform } : layer));
  };

  const removeFullDielineLayer = (layerId: string) => {
    setFullDielineLayers(current => {
      const index = current.findIndex(layer => layer.id === layerId);
      const next = current.filter(layer => layer.id !== layerId);
      if (selectedFullDielineLayerId === layerId) {
        const fallback = next[Math.min(index, Math.max(0, next.length - 1))] ?? next[next.length - 1] ?? null;
        setSelectedFullDielineLayerId(fallback?.id ?? null);
      }
      return next;
    });
    setMessage('Artwork layer removed');
  };

  const duplicateFullDielineLayer = (layerId: string) => {
    setFullDielineLayers(current => {
      const index = current.findIndex(layer => layer.id === layerId);
      if (index < 0) return current;
      const source = current[index];
      const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duplicate: FullDielineArtworkLayer = {
        ...source,
        id,
        name: `${source.name} copy`,
        transform: {
          ...source.transform,
          x: source.transform.x + 3,
          y: source.transform.y + 3,
        },
      };
      const next = [...current];
      next.splice(index + 1, 0, duplicate);
      setSelectedFullDielineLayerId(id);
      return next;
    });
    setMessage('Artwork layer duplicated');
  };

  const moveFullDielineLayer = (layerId: string, direction: -1 | 1) => {
    setFullDielineLayers(current => {
      const index = current.findIndex(layer => layer.id === layerId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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

  return <><input ref={fileRef} hidden multiple type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{ handleArtworkFiles(Array.from(e.target.files ?? [])); e.currentTarget.value=''; }}/><input ref={dielineFileRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf,text/plain" onChange={e=>{ void handleDielineFile(e.target.files?.[0]); e.currentTarget.value=''; }}/><main className="pro-studio" style={boxStyle}>
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
            <button className={mode === 'dieline' ? 'is-active' : ''} onClick={() => { setMode('dieline'); setFaceAction(null); setCameraMenuOpen(false); }}><Grid3X3 size={14} /> 2D Design</button>
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
            artworkByPanel={resolvedArtworkByPanel}
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
              {opening >= 50 ? <PackageOpen size={19}/> : <Box size={19}/>} 
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
              openMediaLibrary(faceAction.panel);
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
          importedDieline={importedDieline}
          mapping={dielineMapping}
          setMapping={setDielineMapping}
          artworkByPanel={artworkByPanel}
          layers={fullDielineLayers}
          selectedLayerId={selectedFullDielineLayerId}
          onSelectLayer={setSelectedFullDielineLayerId}
          onUpdateLayer={updateFullDielineLayer}
          onDuplicateLayer={duplicateFullDielineLayer}
          onRemoveLayer={removeFullDielineLayer}
          onMoveLayer={moveFullDielineLayer}
          artworkScope={artworkScope}
          dimensions={dimensions}
          onChooseFullLayout={() => openMediaLibrary('__FULL_DIELINE__')}
          onClearImportedDieline={() => { setImportedDieline(null); setDielineMapping(null); setMessage('Imported dieline cleared'); }}
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
        {tool && <Inspector tool={tool} family={family} setFamily={setFamily} selectedTemplateId={selectedTemplateId} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} templateCategory={templateCategory} setTemplateCategory={setTemplateCategory} onChooseTemplate={chooseTemplate} onImportDieline={() => dielineFileRef.current?.click()} importedDieline={importedDieline} panel={panel} setPanel={setPanel} artworkScope={artworkScope} setArtworkScope={setArtworkScope} material={material} setMaterial={setMaterial} opening={opening} setOpening={setOpening} dimensions={dimensions} setDimensions={setDimensions} artworkByPanel={artworkByPanel} setArtworkByPanel={setArtworkByPanel} mediaAssets={mediaAssets} onOpenMediaLibrary={openMediaLibrary} onRemoveArtwork={removeArtwork} onExport={exportPng} onAnimateFold={animateFold} setMessage={setMessage} />}
      </aside>
    </div>

    {mediaLibraryOpen && <MediaLibraryModal
      key={`${mediaTargetPanel}:${selectedMediaAssetId ?? 'none'}`}
      assets={mediaAssets}
      artworkByPanel={artworkByPanel}
      targetPanel={mediaTargetPanel}
      tab={mediaLibraryTab}
      setTab={setMediaLibraryTab}
      selectedAssetId={selectedMediaAssetId}
      setSelectedAssetId={setSelectedMediaAssetId}
      onUpload={() => fileRef.current?.click()}
      onDropFiles={handleArtworkFiles}
      onUse={(asset, options) => applyAssetToPanel(asset, mediaTargetPanel, options)}
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
  selectedTemplateId:string; templateSearch:string; setTemplateSearch:(v:string)=>void; templateCategory:string; setTemplateCategory:(v:string)=>void; onChooseTemplate:(template:PackagingTemplateDefinition)=>void; onImportDieline:()=>void; importedDieline:ParsedDieline|null;
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

      <div className="pro-card-section pro-dieline-import-card">
        <SectionTitle title="Import dieline" meta="SVG / DXF" />
        <p className="pro-help">Use SVG or ASCII DXF for vector dielines. AI, EPS and PDF are not directly supported yet.</p>
        <button className="pro-wide-button" type="button" onClick={props.onImportDieline}><Upload size={16}/> Import SVG or DXF</button>
        {props.importedDieline ? <div className="pro-dieline-import-status">
          <strong>{props.importedDieline.name}</strong>
          <span>{props.importedDieline.format.toUpperCase()} · {props.importedDieline.primitives.length} vector elements · {Math.round(props.importedDieline.width)} × {Math.round(props.importedDieline.height)}</span>
          {props.importedDieline.warnings.map(warning => <small key={warning}>{warning}</small>)}
        </div> : null}
      </div>

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

        <div className="pro-artwork-choice-row pro-artwork-choice-single">
          <button className="pro-artwork-source-primary" onClick={() => props.onOpenMediaLibrary(selectedKey)}>
            <span className="pro-artwork-source-icon"><ImageIcon size={17}/></span>
            <span>
              <b>{selectedArtwork ? 'Change image' : 'Choose image'}</b>
              <small>{props.mediaAssets.length > 0 ? 'Browse your media library' : 'Upload your first image'}</small>
            </span>
            <ChevronDown size={16}/>
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

function ImportedDielineMapper({
  dieline,
  mapping,
  setMapping,
  onClear,
}:{
  dieline:ParsedDieline;
  mapping:DielineMapping;
  setMapping:React.Dispatch<React.SetStateAction<DielineMapping|null>>;
  onClear:()=>void;
}) {
  const [selectedPrimitiveIndex, setSelectedPrimitiveIndex] = useState<number | null>(null);
  const candidates = panelCandidates(dieline);
  const progress = mappingProgress(dieline, mapping);
  const selectedPrimitive = selectedPrimitiveIndex == null ? null : dieline.primitives[selectedPrimitiveIndex];
  const selectedPanelCandidate = selectedPrimitiveIndex == null ? null : candidates.find(candidate => candidate.primitiveIndex === selectedPrimitiveIndex) ?? null;

  const setLineRole = (index:number, role:DielineLineRole) => {
    setMapping(current => current ? { ...current, lineRoles: { ...current.lineRoles, [index]: role } } : current);
  };
  const setPanelName = (index:number, name:DielinePanelName | '') => {
    setMapping(current => {
      if (!current) return current;
      const next = { ...current.panelNames };
      if (name) next[index] = name;
      else delete next[index];
      return { ...current, panelNames: next };
    });
  };

  return <div className="pro-dieline-stage pro-2d-design-stage pro-dieline-mapping-mode">
    <div className="pro-2d-design-toolbar pro-mapping-toolbar">
      <div>
        <span>Dieline mapping</span>
        <strong>{dieline.name}</strong>
        <small>{progress.assignedPanels}/{progress.panelCandidates} panel regions assigned · {progress.unresolvedLines} unresolved vector element{progress.unresolvedLines===1?'':'s'}</small>
      </div>
      <div className="pro-mapping-toolbar-actions">
        <span className={progress.readyFor3D ? 'pro-mapping-ready is-ready' : 'pro-mapping-ready'}>{progress.readyFor3D ? 'Ready for 3D mapping' : 'Mapping incomplete'}</span>
        <button className="pro-2d-remove-layout" type="button" onClick={onClear}><Trash2 size={15}/> Clear dieline</button>
      </div>
    </div>

    <div className="pro-dieline-mapper-layout">
      <div className="pro-imported-dieline-wrap">
        <svg className="pro-imported-dieline pro-imported-dieline-interactive" viewBox={dieline.viewBox} role="img" aria-label={`Imported dieline ${dieline.name}`}>
          {dieline.primitives.map((item,index) => {
            const role = mapping.lineRoles[index] ?? 'unknown';
            const selected = selectedPrimitiveIndex === index;
            const panelName = mapping.panelNames[index];
            const common = {
              className: `imported-dieline-line role-${role}${selected ? ' is-selected' : ''}`,
              vectorEffect: 'non-scaling-stroke' as const,
              onClick: () => setSelectedPrimitiveIndex(index),
            };
            if (item.kind === 'line') return <line key={index} x1={item.x1} y1={item.y1} x2={item.x2} y2={item.y2} {...common} />;
            if (item.kind === 'path') return <path key={index} d={item.d} fill="none" {...common} />;
            const points = item.closed ? [...item.points,item.points[0]] : item.points;
            return <g key={index}>
              {item.closed ? <polygon
                points={item.points.map(point => `${point.x},${point.y}`).join(' ')}
                className={`imported-dieline-panel-hit${selected ? ' is-selected' : ''}${panelName ? ' is-assigned' : ''}`}
                onClick={() => setSelectedPrimitiveIndex(index)}
              /> : null}
              <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" {...common} />
              {item.closed && panelName ? <text
                x={item.points.reduce((sum,p)=>sum+p.x,0)/item.points.length}
                y={item.points.reduce((sum,p)=>sum+p.y,0)/item.points.length}
                className="imported-dieline-panel-label"
                textAnchor="middle"
                dominantBaseline="middle"
              >{panelName}</text> : null}
            </g>;
          })}
        </svg>
      </div>

      <aside className="pro-dieline-mapping-panel">
        <div className="pro-mapping-summary">
          <h3>Map this dieline</h3>
          <p>Click a vector element or closed panel region, then classify it. Auto-detected roles are already prefilled where the file contained useful layer names.</p>
          <div className="pro-mapping-progress"><span style={{width:`${progress.panelCandidates ? Math.round(progress.assignedPanels/progress.panelCandidates*100) : 0}%`}}/></div>
        </div>

        {selectedPrimitiveIndex == null || !selectedPrimitive ? <div className="pro-mapping-empty">
          <Grid3X3 size={24}/>
          <strong>Select geometry</strong>
          <span>Choose a line or closed region in the preview to classify it.</span>
        </div> : <div className="pro-mapping-editor">
          <div><span>Selected</span><strong>{primitiveSummary(selectedPrimitive)} #{selectedPrimitiveIndex+1}</strong></div>

          <fieldset>
            <legend>Line role</legend>
            <div className="pro-mapping-role-grid">
              {(['cut','crease','ignore','unknown'] as DielineLineRole[]).map(role => <button
                type="button"
                key={role}
                className={(mapping.lineRoles[selectedPrimitiveIndex]??'unknown')===role?'is-active':''}
                onClick={()=>setLineRole(selectedPrimitiveIndex,role)}
              >{role==='cut'?'Cut':role==='crease'?'Crease / fold':role==='ignore'?'Ignore':'Unclassified'}</button>)}
            </div>
          </fieldset>

          {selectedPanelCandidate ? <label className="pro-mapping-panel-select">
            <span>Panel assignment</span>
            <select value={mapping.panelNames[selectedPrimitiveIndex]??''} onChange={e=>setPanelName(selectedPrimitiveIndex,e.target.value as DielinePanelName|'')}>
              <option value="">Unassigned</option>
              {(['Front','Back','Left','Right','Top','Bottom','Glue','Other'] as DielinePanelName[]).map(name=><option key={name} value={name}>{name}</option>)}
            </select>
            <small>Closed vector regions are treated as panel candidates in this first mapper.</small>
          </label> : <p className="pro-mapping-note">This geometry is not a closed panel candidate. Classify it as Cut, Crease, Ignore, or leave it unresolved.</p>}
        </div>}

        <div className="pro-mapping-checklist">
          <strong>Mapping checklist</strong>
          <span className={progress.assignedPanels>=4?'is-done':''}><Check size={14}/> Assign at least 4 panel regions</span>
          <span className={progress.unresolvedLines===0?'is-done':''}><Check size={14}/> Resolve all vector elements</span>
          <span className={progress.readyFor3D?'is-done':''}><Check size={14}/> Structure ready for 3D conversion</span>
        </div>

        <button className="pro-primary pro-map-to-3d" type="button" disabled={!progress.readyFor3D} onClick={()=>{}}>
          <Boxes size={16}/> Generate 3D structure
        </button>
        <p className="pro-mapping-note">3D generation is intentionally disabled until the mapping is complete. The actual arbitrary-geometry folding engine is the next implementation step.</p>
      </aside>
    </div>
  </div>;
}

function DielinePrototype({
  panel,
  importedDieline,
  mapping,
  setMapping,
  artworkByPanel,
  fullDielineArtwork,
  fullDielineTransform,
  onFullDielineTransformChange,
  artworkScope,
  dimensions,
  onChooseFullLayout,
  onRemoveFullLayout,
  onApplyFullLayoutTo3D,
  onClearImportedDieline,
}:{
  panel:string;
  importedDieline:ParsedDieline|null;
  mapping:DielineMapping|null;
  setMapping:React.Dispatch<React.SetStateAction<DielineMapping|null>>;
  artworkByPanel:ArtworkByPanel;
  fullDielineArtwork:ArtworkPlacement | null;
  fullDielineTransform:FullDielineTransform;
  onFullDielineTransformChange:(value:FullDielineTransform)=>void;
  artworkScope:'outside'|'inside';
  dimensions:CartonDimensions;
  onChooseFullLayout:()=>void;
  onRemoveFullLayout:()=>void;
  onApplyFullLayoutTo3D:()=>void | Promise<void>;
  onClearImportedDieline:()=>void;
}) {
  const cartonPanels = reverseTuckPanels(dimensions);
  const bounds = reverseTuckBounds(dimensions);
  const transformRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<{
    type:'move'|'resize'|'rotate';
    pointerId:number;
    startX:number;
    startY:number;
    start:FullDielineTransform;
    centerX:number;
    centerY:number;
    startDistance:number;
    startAngle:number;
  } | null>(null);

  const beginFullArtworkGesture = (event: React.PointerEvent, type:'move'|'resize'|'rotate') => {
    if (!fullDielineArtwork) return;
    event.preventDefault();
    event.stopPropagation();
    const container = transformRef.current?.parentElement;
    if (!container || !transformRef.current) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width * fullDielineTransform.x / 100;
    const centerY = rect.top + rect.height * fullDielineTransform.y / 100;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    gestureRef.current = {
      type,
      pointerId:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      start:{...fullDielineTransform},
      centerX,
      centerY,
      startDistance:Math.max(1, Math.hypot(dx,dy)),
      startAngle:Math.atan2(dy,dx),
    };
    transformRef.current.setPointerCapture(event.pointerId);
  };

  const updateFullArtworkGesture = (event: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const container = transformRef.current?.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (gesture.type === 'move') {
      const dx = (event.clientX - gesture.startX) / Math.max(1, rect.width) * 100;
      const dy = (event.clientY - gesture.startY) / Math.max(1, rect.height) * 100;
      onFullDielineTransformChange({
        ...gesture.start,
        x:Math.max(-100,Math.min(200,gesture.start.x+dx)),
        y:Math.max(-100,Math.min(200,gesture.start.y+dy)),
      });
      return;
    }
    if (gesture.type === 'resize') {
      const distance = Math.hypot(event.clientX-gesture.centerX,event.clientY-gesture.centerY);
      const ratio = distance / Math.max(1,gesture.startDistance);
      onFullDielineTransformChange({...gesture.start,width:Math.max(8,Math.min(300,gesture.start.width*ratio))});
      return;
    }
    const angle = Math.atan2(event.clientY-gesture.centerY,event.clientX-gesture.centerX);
    const delta = (angle-gesture.startAngle)*180/Math.PI;
    onFullDielineTransformChange({...gesture.start,rotation:gesture.start.rotation+delta});
  };

  const endFullArtworkGesture = (event: React.PointerEvent) => {
    if (gestureRef.current?.pointerId !== event.pointerId) return;
    if (transformRef.current?.hasPointerCapture(event.pointerId)) transformRef.current.releasePointerCapture(event.pointerId);
    gestureRef.current = null;
  };

  if (importedDieline) {
    return <ImportedDielineMapper
      dieline={importedDieline}
      mapping={mapping ?? createInitialDielineMapping(importedDieline)}
      setMapping={setMapping}
      onClear={onClearImportedDieline}
    />;
  }

  return <div className="pro-dieline-stage pro-2d-design-stage">
    {artworkScope === 'outside' ? <div className="pro-2d-design-toolbar">
      <div>
        <span>Full layout artwork</span>
        <strong>{fullDielineArtwork ? fullDielineArtwork.name : 'No full-layout artwork yet'}</strong>
      </div>
      <button className="pro-secondary-button" onClick={onChooseFullLayout}><ImageIcon size={16}/>{fullDielineArtwork ? 'Change image' : 'Add artwork'}</button>
      {fullDielineArtwork && <button className="pro-secondary-button" onClick={() => onFullDielineTransformChange(DEFAULT_FULL_DIELINE_TRANSFORM)}><Maximize2 size={15}/> Reset</button>}
      {fullDielineArtwork && <button className="pro-primary pro-apply-layout-3d" onClick={() => void onApplyFullLayoutTo3D()}><Boxes size={15}/> Apply to 3D</button>}
      {fullDielineArtwork && <button className="pro-2d-remove-layout" onClick={onRemoveFullLayout}><Trash2 size={15}/> Remove</button>}
    </div> : <div className="pro-2d-design-toolbar pro-2d-inside-note">
      <div><span>Inside design</span><strong>Choose individual inside panels to place artwork.</strong></div>
    </div>}

    <div className={`pro-dieline pro-dieline-live${fullDielineArtwork && artworkScope === 'outside' ? ' has-full-layout-editor' : ''}`} style={{ aspectRatio: `${bounds.width} / ${bounds.height}` }}>
      {fullDielineArtwork && artworkScope === 'outside' ? <div
        ref={transformRef}
        className="pro-full-artwork-transform"
        style={{
          left:`${fullDielineTransform.x}%`,
          top:`${fullDielineTransform.y}%`,
          width:`${fullDielineTransform.width}%`,
          transform:`translate(-50%,-50%) rotate(${fullDielineTransform.rotation}deg)`,
        }}
        onPointerDown={event => beginFullArtworkGesture(event,'move')}
        onPointerMove={updateFullArtworkGesture}
        onPointerUp={endFullArtworkGesture}
        onPointerCancel={endFullArtworkGesture}
      >
        <img src={fullDielineArtwork.url} alt={fullDielineArtwork.name} draggable={false}/>
        <span className="pro-transform-box" aria-hidden="true"/>
        <button type="button" className="pro-transform-handle pro-transform-resize" aria-label="Resize artwork" onPointerDown={event=>beginFullArtworkGesture(event,'resize')}/>
        <button type="button" className="pro-transform-handle pro-transform-rotate" aria-label="Rotate artwork" onPointerDown={event=>beginFullArtworkGesture(event,'rotate')}><span/></button>
      </div> : null}
      {cartonPanels.map(item => {
        const panelName = item.label[0] + item.label.slice(1).toLowerCase();
        const explicitArtwork = artworkByPanel[artworkScope === 'inside' ? `Interior ${panelName}` : panelName];
        const hasArtwork = !!explicitArtwork || (!!fullDielineArtwork && artworkScope === 'outside');

        return <div
          key={item.id}
          className={`dl-live dl-${item.kind} ${hasArtwork ? 'has-artwork' : ''} ${explicitArtwork ? 'has-explicit-artwork' : ''}`}
          style={{
            left: `${item.x / bounds.width * 100}%`,
            top: `${item.y / bounds.height * 100}%`,
            width: `${item.width / bounds.width * 100}%`,
            height: `${item.height / bounds.height * 100}%`,
            overflow: 'hidden',
          }}
          aria-hidden="true"
        >
          {explicitArtwork ? <span className="artwork-layer" style={artworkCss(explicitArtwork)} /> : null}
          <span className="dl-label">{item.label}</span>
          {explicitArtwork && <b>OVERRIDE</b>}
        </div>;
      })}
    </div>
    <div className="pro-dieline-legend">
      <span><i className="cut"/>Cut</span>
      <span><i className="crease"/>Crease</span>
      <span><i className="bleed"/>Bleed</span>
      <strong>{fullDielineArtwork ? 'Drag artwork to move · use corner handle to resize · rotation handle to rotate · Apply to 3D when ready' : 'Add artwork, then drag, resize and rotate it directly on the dieline'}</strong>
    </div>
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
  onUse: (asset:LocalMediaAsset, options:{ mode:ArtworkMode; scale:number; rotation:number })=>void;
  onDelete: (assetId:string)=>void;
  onClose: ()=>void;
}) {
  const selected = props.assets.find(asset => asset.id === props.selectedAssetId) ?? null;
  const existing = props.targetPanel === '__FULL_DIELINE__'
    ? null
    : props.artworkByPanel[props.targetPanel];
  const selectedMatchesExisting = !!selected && existing?.assetId === selected.id;

  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [fitMode, setFitMode] = useState<ArtworkMode>(selectedMatchesExisting ? existing!.mode : 'fit');
  const [scale, setScale] = useState(selectedMatchesExisting ? existing!.scale : 100);
  const [rotation, setRotation] = useState(selectedMatchesExisting ? existing!.rotation : 0);
  const usageCount = selected ? Object.values(props.artworkByPanel).filter(artwork => artwork.assetId === selected.id).length : 0;
  const targetLabel = props.targetPanel === '__FULL_DIELINE__' ? 'Full dieline' : props.targetPanel.replace('Interior ', 'Inside ');
  const filteredAssets = props.assets.filter(asset => asset.name.toLowerCase().includes(search.trim().toLowerCase()));

  const previewStyle = selected ? artworkCss({
    ...defaultArtworkPlacement(selected.name, selected.url, selected.id),
    mode: fitMode,
    scale,
    rotation,
  }) : undefined;

  return <div className="pro-media-modal-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget) props.onClose();
  }}>
    <section className="pro-media-modal pro-media-modal-unified" role="dialog" aria-modal="true" aria-label="Add artwork">
      <header className="pro-media-modal-header">
        <div>
          <span>Artwork</span>
          <h2>Add artwork</h2>
          <p>Upload or choose an image, set its starting size, then refine placement directly on the 2D dieline.</p>
        </div>
        <button aria-label="Close add artwork dialog" onClick={props.onClose}><X size={20}/></button>
      </header>

      <div className="pro-media-unified-workspace">
        <div className="pro-media-unified-library">
          <div className="pro-media-browser-toolbar">
            <label className="pro-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search artwork" /></label>
            <button className="pro-secondary-button" onClick={props.onUpload}><Upload size={15}/> Upload image</button>
          </div>

          <div
            className={`pro-media-inline-dropzone ${dragging ? 'is-dragging' : ''}`}
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
            <Upload size={20}/>
            <div><strong>{dragging ? 'Drop it here' : 'Drop artwork here'}</strong><span>PNG, JPG or WebP · any image dimensions</span></div>
            <button type="button" onClick={props.onUpload}>Browse</button>
          </div>

          {filteredAssets.length === 0 ? <div className="pro-media-empty">
            <ImageIcon size={30}/>
            <h3>{props.assets.length ? 'No matching artwork' : 'Upload your first image'}</h3>
            <p>{props.assets.length ? 'Try another search.' : 'Your image will appear here immediately and can be positioned on the dieline.'}</p>
            {!props.assets.length && <button className="pro-primary" onClick={props.onUpload}>Choose image</button>}
          </div> : <div className="pro-media-grid pro-media-unified-grid">
            {filteredAssets.map(asset => {
              const used = Object.values(props.artworkByPanel).filter(artwork => artwork.assetId === asset.id).length;
              return <button
                key={asset.id}
                className={`pro-media-tile ${props.selectedAssetId === asset.id ? 'is-selected' : ''}`}
                aria-pressed={props.selectedAssetId === asset.id}
                onClick={() => props.setSelectedAssetId(asset.id)}
              >
                <img src={asset.url} alt={asset.name} />
                <span className="pro-media-tile-name">{asset.name}</span>
                {props.selectedAssetId === asset.id && <span className="pro-media-check"><Check size={14}/></span>}
                {used > 0 && <span className="pro-media-usage">{used}</span>}
              </button>;
            })}
          </div>}
        </div>

        <aside className="pro-media-unified-editor">
          {selected ? <>
            <div className="pro-media-editor-heading">
              <div><span>Place on</span><strong>{targetLabel}</strong></div>
              <button type="button" className="pro-media-replace" onClick={props.onUpload}><Upload size={14}/> Replace</button>
            </div>

            <div className="pro-media-placement-preview">
              <div className="pro-media-placement-canvas">
                <span className="pro-media-placement-artwork" style={previewStyle}/>
                <span className="pro-media-placement-label">{targetLabel}</span>
              </div>
            </div>

            <div className="pro-media-editor-file">
              <img src={selected.url} alt="" />
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.width && selected.height ? `${selected.width} × ${selected.height}px · ` : ''}{formatBytes(selected.byteSize)}</span>
              </div>
            </div>

            {props.targetPanel !== '__FULL_DIELINE__' && <div className="pro-media-editor-section">
              <div className="pro-media-editor-row"><strong>Fit mode</strong><span>Panel placement</span></div>
              <div className="pro-media-fit-switch">
                {(['fit','fill','tile'] as ArtworkMode[]).map(mode => <button key={mode} type="button" className={fitMode===mode?'is-active':''} onClick={()=>setFitMode(mode)}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}
              </div>
            </div>}

            <div className="pro-media-editor-section">
              <div className="pro-media-editor-row"><strong>Starting size</strong><span>{scale}%</span></div>
              <input className="pro-range" type="range" min="40" max="180" step="5" value={scale} onChange={e=>setScale(Number(e.target.value))}/>
              <div className="pro-media-size-presets">
                {[75,100,125].map(value=><button key={value} type="button" className={scale===value?'is-active':''} onClick={()=>setScale(value)}>{value}%</button>)}
              </div>
            </div>

            <div className="pro-media-editor-section">
              <div className="pro-media-editor-row"><strong>Starting rotation</strong><span>{rotation}°</span></div>
              <input className="pro-range" type="range" min="-180" max="180" step="5" value={rotation} onChange={e=>setRotation(Number(e.target.value))}/>
              <button type="button" className="pro-media-reset-placement" onClick={()=>{setFitMode('fit');setScale(100);setRotation(0);}}>Reset</button>
            </div>

            {props.targetPanel === '__FULL_DIELINE__' && <div className="pro-media-canvas-handoff">
              <Move size={16}/>
              <p><strong>Fine-tune on the dieline</strong><span>After adding, drag the artwork freely and use the transform handles for precise resize and rotation.</span></p>
            </div>}

            <div className="pro-media-editor-meta">
              <span>{selected.mimeType.replace('image/','').toUpperCase()}</span>
              <span>{usageCount ? `Used on ${usageCount} panel${usageCount===1?'':'s'}` : 'Not used yet'}</span>
              <button
                className="pro-media-delete-link"
                disabled={usageCount > 0}
                title={usageCount > 0 ? 'Remove this artwork from every panel before deleting it' : 'Delete from this local library'}
                onClick={() => {
                  props.onDelete(selected.id);
                  props.setSelectedAssetId(null);
                }}
              ><Trash2 size={14}/> Delete</button>
            </div>
          </> : <div className="pro-media-editor-empty">
            <ImageIcon size={32}/>
            <h3>Choose or upload artwork</h3>
            <p>Everything happens here. Select an existing image or upload a new one, then set its initial size before placing it on the dieline.</p>
            <button className="pro-primary" onClick={props.onUpload}><Upload size={15}/> Upload image</button>
          </div>}
        </aside>
      </div>

      <footer className="pro-media-modal-footer">
        <span>{props.targetPanel === '__FULL_DIELINE__' ? 'You can continue moving and resizing the image directly on the 2D dieline.' : `Adding artwork to ${targetLabel}.`}</span>
        <div>
          <button className="pro-secondary-button" onClick={props.onClose}>Cancel</button>
          <button className="pro-primary" disabled={!selected} onClick={() => selected && props.onUse(selected,{mode:fitMode,scale,rotation})}>
            {props.targetPanel === '__FULL_DIELINE__' ? 'Add to dieline' : `Add to ${targetLabel}`}
          </button>
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