'use client';

import Link from 'next/link';
import type { SavedStudioProject, StudioProjectState } from '@/lib/studio-project';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Box, Boxes, Camera, Check, ChevronDown, CirclePlay, Copy, Download,
  Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2, Move,
  PackageOpen, RotateCcw, Search, Share2, Sparkles, ZoomIn, ZoomOut,
  Trash2, Upload, X
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { AccountButton } from '@/components/auth/account-button';
import { CartonEngine, type CartonEngineHandle } from '@/components/studio/carton-engine';
import { DEFAULT_CARTON_DIMENSIONS, reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { artworkCss, defaultArtworkPlacement, type ArtworkByPanel, type ArtworkMode, type LocalMediaAsset } from '@/lib/packaging/artwork';
import { PACKAGING_TEMPLATES, getPackagingTemplateCategories, type PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import { parseDielineFile, type ParsedDieline } from '@/lib/packaging/dieline-import';
import { createInitialDielineMapping, mappingProgress, panelCandidates, primitiveSummary, type DielineMapping, type DielineLineRole, type DielinePanelName } from '@/lib/packaging/dieline-mapping';
import { createFullDielineTransform, rasterizeFullDielineLayers, rasterizePanelArtwork, type FullDielineArtworkLayer, type FullDielineTransform } from '@/lib/packaging/full-dieline-artwork';

type Tool = 'structure' | 'artwork' | 'material' | 'opening' | 'scene' | 'export';
type Mode = '3d' | 'dieline';
type MeasurementUnit = 'mm' | 'in';
type BaseColorMode = 'material' | 'custom';

const MATERIAL_BASE_COLORS: Record<string,{outside:string;inside:string}> = {
  'White board': { outside:'#EBEDF0', inside:'#F5F6F7' },
  'Kraft': { outside:'#A3784A', inside:'#B89668' },
  'Soft touch': { outside:'#C7D4DE', inside:'#D7E0E7' },
  'Matte coated': { outside:'#D1DBE3', inside:'#DCE4EA' },
  'Gloss coated': { outside:'#C4D6E6', inside:'#D6E2EC' },
  'Foil': { outside:'#C7A34D', inside:'#D2BA7A' },
};

function materialBaseColor(material:string, side:'outside'|'inside') {
  return MATERIAL_BASE_COLORS[material]?.[side] ?? (side === 'inside' ? '#D7E0E7' : '#C7D4DE');
}

const tools: { id: Tool; label: string; icon: typeof Box }[] = [
  { id: 'structure', label: 'Box & Size', icon: Box },
  { id: 'artwork', label: 'Artwork', icon: ImageIcon },
  { id: 'material', label: 'Material & Finish', icon: Layers3 },
  { id: 'opening', label: 'Open / Close', icon: PackageOpen },
  { id: 'scene', label: 'Scene', icon: Lightbulb },
  { id: 'export', label: 'Export', icon: Download },
];

const materials = ['White board','Kraft','Soft touch','Matte coated','Gloss coated','Foil'];
const cameras = ['Perspective','Front','Back','Left','Right','Top'];

export function StudioShell({initialProject}:{initialProject?:SavedStudioProject} = {}) {
  const initial = initialProject?.state;
  const [projectId,setProjectId] = useState(initialProject?.id);
  const [projectName,setProjectName] = useState(initialProject?.name ?? 'Untitled design');
  const [projectUpdatedAt,setProjectUpdatedAt] = useState(initialProject?.updatedAt);
  const [saving,setSaving] = useState(false);
  const [tool, setTool] = useState<Tool | null>(null);
  const [mode, setMode] = useState<Mode>('3d');
  const [family, setFamily] = useState('Reverse Tuck End Carton');
  const [selectedTemplateId, setSelectedTemplateId] = useState('reverse-tuck-carton');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [panel, setPanel] = useState('Front');
  const [artworkScope, setArtworkScope] = useState<'outside' | 'inside'>('outside');
  const [material, setMaterial] = useState(initial?.material ?? 'Soft touch');
  const [outsideColorMode, setOutsideColorMode] = useState<BaseColorMode>(initial?.outsideColorMode ?? 'material');
  const [insideColorMode, setInsideColorMode] = useState<BaseColorMode>(initial?.insideColorMode ?? 'material');
  const [outsideCustomColor, setOutsideCustomColor] = useState(initial?.outsideCustomColor ?? '#C7D4DE');
  const [insideCustomColor, setInsideCustomColor] = useState(initial?.insideCustomColor ?? '#D7E0E7');
  const [camera, setCamera] = useState('Perspective');
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const [opening, setOpeningValue] = useState(initial?.opening ?? 100);
  const [zoom, setZoom] = useState(82);
  const [dimensions, setDimensions] = useState<CartonDimensions>(initial?.dimensions ?? DEFAULT_CARTON_DIMENSIONS);
  const [measurementUnit, setMeasurementUnit] = useState<MeasurementUnit>(initial?.measurementUnit ?? 'mm');
  const [artworkByPanel, setArtworkByPanel] = useState<ArtworkByPanel>(initial?.artworkByPanel ?? {});
  const [outsideDielineLayers, setOutsideDielineLayers] = useState<FullDielineArtworkLayer[]>(initial?.outsideArtworkLayers ?? []);
  const [insideDielineLayers, setInsideDielineLayers] = useState<FullDielineArtworkLayer[]>(initial?.insideArtworkLayers ?? []);
  const [selectedOutsideLayerId, setSelectedOutsideLayerId] = useState<string | null>(null);
  const [selectedInsideLayerId, setSelectedInsideLayerId] = useState<string | null>(null);
  const [mappedOutsideArtwork, setMappedOutsideArtwork] = useState<ArtworkByPanel>({});
  const [mappedInsideArtwork, setMappedInsideArtwork] = useState<ArtworkByPanel>({});
  const [mappedPanelArtwork, setMappedPanelArtwork] = useState<ArtworkByPanel>({});
  const [previewOpen, setPreviewOpen] = useState(true);
  const [dielineZoom, setDielineZoom] = useState(112);
  const [panEnabled, setPanEnabled] = useState(false);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const liveMapTokenRef = useRef(0);
  const [mediaAssets, setMediaAssets] = useState<LocalMediaAsset[]>(initial?.mediaAssets ?? []);
  const mediaAssetsRef = useRef<LocalMediaAsset[]>(initial?.mediaAssets ?? []);
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

  const setOpening = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setOpeningValue(next);
    setFaceAction(null);
    setCameraMenuOpen(false);
  }, []);

  const activeLabel = tools.find(item => item.id === tool)?.label ?? 'Tools';
  const boxStyle = useMemo(() => ({ '--studio-zoom': zoom / 100 }) as React.CSSProperties, [zoom]);
  const resolvedArtworkByPanel = useMemo<ArtworkByPanel>(() => {
    return { ...mappedOutsideArtwork, ...mappedInsideArtwork, ...artworkByPanel, ...mappedPanelArtwork };
  }, [artworkByPanel, mappedOutsideArtwork, mappedInsideArtwork, mappedPanelArtwork]);
  const artworkKey = (targetPanel = panel, scope = artworkScope) => scope === 'inside' ? `Interior ${targetPanel}` : targetPanel;
  const parseArtworkTarget = (target: string) => target.startsWith('Interior ')
    ? { scope: 'inside' as const, panel: target.replace('Interior ', '') }
    : { scope: 'outside' as const, panel: target };

  useEffect(() => {
    let cancelled=false;
    void rasterizePanelArtwork(artworkByPanel,dimensions).then(next=>{if(!cancelled)setMappedPanelArtwork(next);}).catch(()=>{if(!cancelled)setMessage('Artwork preview could not update. Try replacing the image.');});
    return ()=>{cancelled=true;};
  },[artworkByPanel,dimensions]);

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => {
    const token = ++liveMapTokenRef.current;
    const timeout = window.setTimeout(() => {
      void Promise.all([
        outsideDielineLayers.length
          ? rasterizeFullDielineLayers(outsideDielineLayers, dimensions)
          : Promise.resolve({} as ArtworkByPanel),
        insideDielineLayers.length
          ? rasterizeFullDielineLayers(insideDielineLayers, dimensions, 'Interior ')
          : Promise.resolve({} as ArtworkByPanel),
      ]).then(([outsideMapped, insideMapped]) => {
        if (liveMapTokenRef.current !== token) return;
        setMappedOutsideArtwork(outsideMapped);
        setMappedInsideArtwork(insideMapped);
        setMessage('3D preview synced');
      }).catch(() => {
        if (liveMapTokenRef.current !== token) return;
        setMessage('Could not sync artwork to 3D');
      });
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [outsideDielineLayers, insideDielineLayers, dimensions]);

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

  const getDielineLayers = (scope: 'outside' | 'inside') => scope === 'inside' ? insideDielineLayers : outsideDielineLayers;
  const getSelectedDielineLayerId = (scope: 'outside' | 'inside') => scope === 'inside' ? selectedInsideLayerId : selectedOutsideLayerId;

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
      const bounds = reverseTuckBounds(dimensions);
      const imageAspect = asset.width && asset.height ? asset.width / asset.height : 1;
      const layer: FullDielineArtworkLayer = {
        id: layerId,
        assetId: asset.id,
        name: asset.name,
        url: asset.url,
        aspectRatio: imageAspect,
        transform: createFullDielineTransform(
          imageAspect,
          bounds.width / bounds.height,
          scale,
          options?.rotation ?? 0,
        ),
      };

      if (artworkScope === 'inside') {
        setInsideDielineLayers(current => [...current, layer]);
        setSelectedInsideLayerId(layerId);
      } else {
        setOutsideDielineLayers(current => [...current, layer]);
        setSelectedOutsideLayerId(layerId);
      }
      setMediaLibraryOpen(false);
      setMode('dieline');
      setMessage(`${asset.name} added to the ${artworkScope} 2D design`);
      return;
    }

    const parsed = parseArtworkTarget(targetPanel);
    const face=reverseTuckPanels(dimensions).find(item=>item.label.toLowerCase()===parsed.panel.toLowerCase());
    if (!face) {
      setMessage('Could not find that box side in the 2D layout');
      return;
    }

    const bounds = reverseTuckBounds(dimensions);
    const imageAspect = asset.width && asset.height ? asset.width / asset.height : 1;
    const faceTransform = createFullDielineTransform(
      imageAspect,
      face.width / face.height,
      options?.scale ?? 125,
      options?.rotation ?? 0,
    );
    const layerId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const layer: FullDielineArtworkLayer = {
      id: layerId,
      assetId: asset.id,
      name: asset.name,
      url: asset.url,
      aspectRatio: imageAspect,
      transform: {
        x: (face.x + face.width * faceTransform.x / 100) / bounds.width * 100,
        y: (face.y + face.height * faceTransform.y / 100) / bounds.height * 100,
        width: face.width * faceTransform.width / 100 / bounds.width * 100,
        height: face.height * faceTransform.height / 100 / bounds.height * 100,
        rotation: faceTransform.rotation,
      },
    };

    if (parsed.scope === 'inside') {
      setInsideDielineLayers(current => [...current, layer]);
      setSelectedInsideLayerId(layerId);
      setSelectedOutsideLayerId(null);
    } else {
      setOutsideDielineLayers(current => [...current, layer]);
      setSelectedOutsideLayerId(layerId);
      setSelectedInsideLayerId(null);
    }
    setArtworkScope(parsed.scope);
    setPanel(parsed.panel);
    setTool('artwork');
    setMode('dieline');
    setInspectorOpen(false);
    setMediaLibraryOpen(false);
    setMessage(`${asset.name} added to ${parsed.panel} — drag it freely across the 2D board`);
  };

  const openMediaLibrary = (targetPanel = artworkKey(), tab?: 'library' | 'upload') => {
    const activeLayers = getDielineLayers(artworkScope);
    const selectedLayer = activeLayers.find(layer => layer.id === getSelectedDielineLayerId(artworkScope));
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

  const openPanelMediaFrom3D = (targetPanel: string) => {
    const parsed = parseArtworkTarget(targetPanel);
    setArtworkScope(parsed.scope);
    setPanel(parsed.panel);
    setTool('artwork');
    setInspectorOpen(false);
    setPanEnabled(false);
    setSelectedOutsideLayerId(null);
    setSelectedInsideLayerId(null);
    setFaceAction(null);
    setMode('dieline');
    setMessage(`Choose artwork for ${parsed.scope === 'inside' ? 'inside ' : ''}${parsed.panel}`);

    // Open after the 2D view has committed so the modal belongs to the
    // editing context the user is about to work in, not the old 3D view.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => openMediaLibrary(targetPanel));
    });
  };

  const handleArtworkFiles = (files: File[]) => {
    const imageFiles = files.filter(file => {
      const lower = file.name.toLowerCase();
      return ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type) || lower.endsWith('.svg');
    });
    if (imageFiles.length === 0) {
      setMessage('Use PNG, JPG, WebP or SVG artwork');
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
      const mimeType = file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png');
      const asset: LocalMediaAsset = {
        id,
        name: file.name,
        url,
        mimeType,
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
          ? { ...item, width: image.naturalWidth || 1000, height: image.naturalHeight || 1000 }
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

  const promotePanelArtworkToDieline = (targetPanel: string) => {
    const artwork = artworkByPanel[targetPanel];
    if (!artwork) return null;

    const parsed = parseArtworkTarget(targetPanel);
    const face = reverseTuckPanels(dimensions).find(item => item.label.toLowerCase() === parsed.panel.toLowerCase());
    if (!face) return null;

    const bounds = reverseTuckBounds(dimensions);
    const asset = mediaAssets.find(item => item.id === artwork.assetId);
    const imageAspect = asset?.width && asset.height ? asset.width / asset.height : 1;

    let localTransform = artwork.transform;
    if (!localTransform) {
      const faceAspect = face.width / face.height;
      let width = 100;
      let height = 100;
      if (artwork.mode === 'fill') {
        if (imageAspect > faceAspect) width = 100 * imageAspect / faceAspect;
        else height = 100 * faceAspect / imageAspect;
      } else if (artwork.mode === 'fit') {
        if (imageAspect > faceAspect) height = 100 * faceAspect / imageAspect;
        else width = 100 * imageAspect / faceAspect;
      }
      width *= artwork.scale / 100;
      height *= artwork.scale / 100;
      localTransform = {
        x: 50 + (100 - width) / 2 * artwork.alignX,
        y: 50 + (100 - height) / 2 * artwork.alignY,
        width,
        height,
        rotation: artwork.rotation,
      };
    }

    const layerId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const layer: FullDielineArtworkLayer = {
      id: layerId,
      assetId: artwork.assetId,
      name: artwork.name,
      url: artwork.url,
      aspectRatio: imageAspect,
      transform: {
        x: (face.x + face.width * localTransform.x / 100) / bounds.width * 100,
        y: (face.y + face.height * localTransform.y / 100) / bounds.height * 100,
        width: face.width * localTransform.width / 100 / bounds.width * 100,
        height: face.height * localTransform.height / 100 / bounds.height * 100,
        rotation: localTransform.rotation,
      },
    };

    if (parsed.scope === 'inside') {
      setInsideDielineLayers(current => [...current, layer]);
      setSelectedInsideLayerId(layerId);
    } else {
      setOutsideDielineLayers(current => [...current, layer]);
      setSelectedOutsideLayerId(layerId);
    }

    setArtworkByPanel(current => {
      const next = { ...current };
      delete next[targetPanel];
      return next;
    });

    return layerId;
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
    const inUse = [...outsideDielineLayers, ...insideDielineLayers].some(layer => layer.assetId === assetId)
      || Object.values(artworkByPanel).some(artwork => artwork.assetId === assetId);
    if (inUse) {
      setMessage('Remove this image from every layer or panel before deleting it from the library');
      return;
    }
    setMediaAssets(current => {
      const asset = current.find(item => item.id === assetId);
      if (asset) URL.revokeObjectURL(asset.url);
      return current.filter(item => item.id !== assetId);
    });
    setMessage('Image removed from your local library');
  };

  const updateFullDielineLayer = (scope: 'outside' | 'inside', layerId: string, transform: FullDielineTransform) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    setter(current => current.map(layer => layer.id === layerId ? { ...layer, transform } : layer));
  };

  const removeFullDielineLayer = (scope: 'outside' | 'inside', layerId: string) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    const selectedId = scope === 'inside' ? selectedInsideLayerId : selectedOutsideLayerId;
    const setSelectedId = scope === 'inside' ? setSelectedInsideLayerId : setSelectedOutsideLayerId;
    setter(current => {
      const index = current.findIndex(layer => layer.id === layerId);
      const next = current.filter(layer => layer.id !== layerId);
      if (selectedId === layerId) {
        const fallback = next[Math.min(index, Math.max(0, next.length - 1))] ?? next[next.length - 1] ?? null;
        setSelectedId(fallback?.id ?? null);
      }
      return next;
    });
    setMessage('Artwork layer removed');
  };

  const duplicateFullDielineLayer = (scope: 'outside' | 'inside', layerId: string) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    const setSelectedId = scope === 'inside' ? setSelectedInsideLayerId : setSelectedOutsideLayerId;
    setter(current => {
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
      setSelectedId(id);
      return next;
    });
    setMessage('Artwork layer duplicated');
  };

  const moveFullDielineLayer = (scope: 'outside' | 'inside', layerId: string, direction: -1 | 1) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    setter(current => {
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

  const saveDesign = async () => {
    setSaving(true);
    try {
      if(importedDieline) throw new Error('Saving imported dielines is not available yet.');
      const preview = engineRef.current?.thumbnail();
      if (!preview) throw new Error('The 3D preview is not ready yet.');
      const state: StudioProjectState = {version:1,templateId:selectedTemplateId,dimensions,material,opening,measurementUnit,artworkByPanel,outsideArtworkLayers:outsideDielineLayers,insideArtworkLayers:insideDielineLayers,mediaAssets,outsideColorMode,insideColorMode,outsideCustomColor,insideCustomColor};
      const urls = new Map<string,string>();
      async function persist(value:unknown):Promise<unknown> {
        if (Array.isArray(value)) return Promise.all(value.map(persist));
        if (value && typeof value === 'object') {
          const result:Record<string,unknown> = {};
          for (const [key,item] of Object.entries(value)) {
            if (key === 'url' && typeof item === 'string' && item.startsWith('blob:')) {
              if (!urls.has(item)) {
                const blob = await (await fetch(item)).blob();
                const data = await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob);});
                urls.set(item,data);
              }
              result[key] = urls.get(item);
            } else result[key] = await persist(item);
          }
          return result;
        }
        return value;
      }
      const body = JSON.stringify({name:projectName,state:await persist(state),preview,updatedAt:projectUpdatedAt});
      if (new Blob([body]).size > 3*1024*1024) throw new Error('This design exceeds the current 3 MB save limit. Use smaller artwork images.');
      const response=await fetch(projectId?`/api/projects/${projectId}`:'/api/projects',{method:projectId?'PUT':'POST',headers:{'Content-Type':'application/json'},body});
      const result=await response.json().catch(()=>({error:'The design service is unavailable. Please try again shortly.'}));
      if(!response.ok) throw new Error(result.error || 'Could not save your design.');
      setProjectId(result.project.id);setProjectUpdatedAt(result.project.updated_at);
      if(!projectId) window.history.replaceState(null,'',`/studio/editor?project=${encodeURIComponent(result.project.id)}`);
      setMessage('Design saved');
    } catch(error) {setMessage(error instanceof Error?error.message:'Could not save your design.');}
    finally {setSaving(false);}
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

  return <><input ref={fileRef} hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{ handleArtworkFiles(Array.from(e.target.files ?? [])); e.currentTarget.value=''; }}/><input ref={dielineFileRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf,text/plain" onChange={e=>{ void handleDielineFile(e.target.files?.[0]); e.currentTarget.value=''; }}/><main className="pro-studio" style={boxStyle}>
    <header className="pro-studio-header">
      <div className="pro-project">
        <Brand />
        <span className="pro-divider" />
        <div className="pro-project-copy"><input aria-label="Design name" value={projectName} maxLength={120} onChange={event=>setProjectName(event.target.value)}/><Link href="/studio">Your designs</Link></div>
      </div>
      <div className="pro-header-actions">
        <button className="pro-secondary pro-save-design" disabled={saving} onClick={()=>void saveDesign()}>{saving?'Saving…':'Save'}</button>
        <AccountButton compact className="pro-secondary" />
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

        <div className={`pro-3d-stage pro-view-pane${mode === '3d' ? ' is-active' : ''}`} inert={mode !== '3d'} aria-hidden={mode !== '3d'}>
          <div className="pro-grid-floor" />
          <div className="pro-stage-badge"><span/> Drag to rotate</div>
          <CartonEngine
            ref={engineRef}
            dimensions={dimensions}
            opening={opening}
            material={material}
            outsideColor={outsideColorMode === 'custom' ? outsideCustomColor : null}
            insideColor={insideColorMode === 'custom' ? insideCustomColor : null}
            artworkByPanel={resolvedArtworkByPanel}
            cameraPreset={camera}
            zoom={zoom}
            onZoomChange={setZoom}
            onPanelSelect={(selectedPanel, point) => {
              const parsed = parseArtworkTarget(selectedPanel);
              setArtworkScope(parsed.scope);
              setPanel(parsed.panel);
              setFaceAction({ panel: selectedPanel, x: point.x, y: point.y });
              setMessage(`${parsed.scope === 'inside' ? 'Inside ' : ''}${parsed.panel} selected`);
            }}
          />
          <div className="pro-stage-meta"><span>{family}</span><span>{material}</span><span>Closed {Math.round(opening)}%</span></div>

          {faceAction && <div
            ref={faceActionRef}
            className="pro-face-action"
            style={{
              left: `clamp(12px, ${faceAction.x + 12}px, calc(100% - 280px))`,
              top: `clamp(54px, ${faceAction.y - 18}px, calc(100% - 58px))`,
            }}
          >
            <span>{faceAction.panel.replace('Interior ', 'Inside ')}</span>
            {artworkByPanel[faceAction.panel] ? <>
              <button onClick={() => {
                const parsed = parseArtworkTarget(faceAction.panel);
                setArtworkScope(parsed.scope);
                setPanel(parsed.panel);
                promotePanelArtworkToDieline(faceAction.panel);
                setTool('artwork');
                setInspectorOpen(false);
                setMode('dieline');
                setPanEnabled(false);
                setFaceAction(null);
                setMessage(`Adjust ${parsed.panel} artwork freely across the 2D board`);
              }}>
                <ImageIcon size={13} />
                Edit / adjust image
              </button>
              <button onClick={() => openPanelMediaFrom3D(faceAction.panel)}>
                <Upload size={13} />
                Replace artwork
              </button>
            </> : <button onClick={() => openPanelMediaFrom3D(faceAction.panel)}>
              <Upload size={13} />
              Add artwork
            </button>}
            {artworkByPanel[faceAction.panel] && <button
              className="pro-face-action-remove"
              onClick={() => removeArtwork(faceAction.panel)}
            >
              <Trash2 size={13} /> Remove artwork
            </button>}
            <button className="pro-face-action-close" aria-label="Dismiss face action" onClick={() => setFaceAction(null)}><X size={12}/></button>
          </div>}
        </div>
        <div className={`pro-view-pane${mode === 'dieline' ? ' is-active' : ''}`} inert={mode !== 'dieline'} aria-hidden={mode !== 'dieline'}>
        <DielinePrototype
          importedDieline={importedDieline}
          mapping={dielineMapping}
          setMapping={setDielineMapping}
          artworkByPanel={artworkByPanel}
          layers={artworkScope === 'inside' ? insideDielineLayers : outsideDielineLayers}
          selectedLayerId={artworkScope === 'inside' ? selectedInsideLayerId : selectedOutsideLayerId}
          onSelectLayer={artworkScope === 'inside' ? setSelectedInsideLayerId : setSelectedOutsideLayerId}
          onUpdateLayer={(layerId, transform) => updateFullDielineLayer(artworkScope, layerId, transform)}
          onDuplicateLayer={(layerId) => duplicateFullDielineLayer(artworkScope, layerId)}
          onRemoveLayer={(layerId) => removeFullDielineLayer(artworkScope, layerId)}
          onMoveLayer={(layerId, direction) => moveFullDielineLayer(artworkScope, layerId, direction)}
          artworkScope={artworkScope}
          selectedPanel={panel}
          mediaAssets={mediaAssets}
          onPanelSelect={(name)=>{setPanEnabled(false);setPanel(name);setTool('artwork');setInspectorOpen(false);setSelectedOutsideLayerId(null);setSelectedInsideLayerId(null);}}
          onUpdatePanelArtwork={(key,transform)=>setArtworkByPanel(current=>current[key]?{...current,[key]:{...current[key],transform}}:current)}
          onArtworkScopeChange={setArtworkScope}
          dimensions={dimensions}
          zoom={dielineZoom}
          onZoomChange={setDielineZoom}
          panEnabled={panEnabled}
          setPanEnabled={setPanEnabled}
          canvasPan={canvasPan}
          setCanvasPan={setCanvasPan}
          onChooseFullLayout={() => openMediaLibrary('__FULL_DIELINE__')}
          onApplyChanges={() => {
            setMode('3d');
            setInspectorOpen(false);
            setFaceAction(null);
            setPanEnabled(false);
            setMessage('Artwork changes applied to 3D preview');
          }}
          livePreview={
          <aside className={`pro-artwork-live-preview${previewOpen?' is-open':''}`} aria-label="Live 3D artwork preview">
            <button type="button" onClick={()=>setPreviewOpen(open=>!open)} aria-expanded={previewOpen}><Boxes size={15}/> 3D preview <ChevronDown size={14}/></button>
            {previewOpen && mode === 'dieline' && <>
              <div className="pro-artwork-preview-canvas"><CartonEngine dimensions={dimensions} opening={opening} material={material} outsideColor={outsideColorMode==='custom'?outsideCustomColor:null} insideColor={insideColorMode==='custom'?insideCustomColor:null} artworkByPanel={resolvedArtworkByPanel} cameraPreset="Perspective" zoom={80} onPanelSelect={(name)=>{const parsed=parseArtworkTarget(name);setArtworkScope(parsed.scope);setPanel(parsed.panel);setSelectedOutsideLayerId(null);setSelectedInsideLayerId(null);}}/></div>
              <div className="pro-artwork-preview-fold">
                <div className="pro-artwork-preview-fold-head">
                  <span>Open / close</span>
                  <strong>{Math.round(opening)}%</strong>
                </div>
                <div className="pro-artwork-preview-fold-row">
                  <span>Open</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(opening)}
                    aria-label="Open or close box in 3D preview"
                    onChange={e=>{
                      if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
                      foldAnimationRef.current=null;
                      setOpening(Number(e.target.value));
                    }}
                  />
                  <span>Closed</span>
                </div>
              </div>
            </>}
          </aside>
          }
          onClearImportedDieline={() => { setImportedDieline(null); setDielineMapping(null); setMessage('Imported dieline cleared'); }}
        />

        </div>
          <div className="pro-canvas-control-bar pro-shared-canvas-control-bar" aria-label="Canvas controls">
            <button className={`pro-canvas-bar-icon${panEnabled && mode === 'dieline' ? ' is-active' : ''}`} title="Drag 2D board" aria-label="Drag 2D board" aria-pressed={panEnabled && mode === 'dieline'} disabled={mode !== 'dieline' || !!importedDieline} onClick={() => setPanEnabled(enabled => !enabled)}><Move size={18}/></button>
            <button className="pro-canvas-bar-icon" title="Zoom out" aria-label="Zoom out" onClick={() => mode === '3d' ? setZoom(Math.max(40, zoom - 10)) : setDielineZoom(Math.max(45, dielineZoom - 10))}>
              <ZoomOut size={20}/>
            </button>
            <button className="pro-canvas-bar-icon" title="Zoom in" aria-label="Zoom in" onClick={() => mode === '3d' ? setZoom(Math.min(140, zoom + 10)) : setDielineZoom(Math.min(200, dielineZoom + 10))}>
              <ZoomIn size={20}/>
            </button>
            {mode === '3d' && <>
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
                onChange={e => {
                  if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
                  foldAnimationRef.current = null;
                  setOpening(Number(e.target.value));
                }}
              />
              <span className="pro-canvas-bar-label">Closed</span>
              <span className="pro-canvas-bar-divider" />
            </>}
            <button
              className="pro-canvas-bar-icon"
              title="Fit view"
              aria-label="Fit view"
              onClick={() => {
                if (mode === '3d') {
                  setZoom(82);
                  engineRef.current?.resetCamera();
                } else {
                  setDielineZoom(100);
                  setCanvasPan({ x: 0, y: 0 });
                }
              }}
            >
              <Maximize2 size={20}/>
            </button>
          </div>


        <button className="pro-mobile-inspector" onClick={() => { if (tool) setInspectorOpen(true); }} disabled={!tool}><Sparkles size={14} /> {tool ? `Edit ${activeLabel}` : 'Choose a tool'}</button>
        <div className="pro-status-bar"><span><span className="pro-status-dot" /> {message}</span><span>{family} · {formatDimension(dimensions.width, measurementUnit)} × {formatDimension(dimensions.height, measurementUnit)} × {formatDimension(dimensions.depth, measurementUnit)} {measurementUnit}</span></div>
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
        {tool && <Inspector tool={tool} family={family} setFamily={setFamily} selectedTemplateId={selectedTemplateId} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} templateCategory={templateCategory} setTemplateCategory={setTemplateCategory} onChooseTemplate={chooseTemplate} onImportDieline={() => dielineFileRef.current?.click()} importedDieline={importedDieline} panel={panel} setPanel={setPanel} artworkScope={artworkScope} setArtworkScope={setArtworkScope} material={material} setMaterial={setMaterial} outsideColorMode={outsideColorMode} setOutsideColorMode={setOutsideColorMode} insideColorMode={insideColorMode} setInsideColorMode={setInsideColorMode} outsideCustomColor={outsideCustomColor} setOutsideCustomColor={setOutsideCustomColor} insideCustomColor={insideCustomColor} setInsideCustomColor={setInsideCustomColor} opening={opening} setOpening={setOpening} dimensions={dimensions} setDimensions={setDimensions} measurementUnit={measurementUnit} setMeasurementUnit={setMeasurementUnit} artworkByPanel={artworkByPanel} setArtworkByPanel={setArtworkByPanel} mediaAssets={mediaAssets} onOpenMediaLibrary={openMediaLibrary} onRemoveArtwork={removeArtwork} onExport={exportPng} onAnimateFold={animateFold} setMessage={setMessage} />}
      </aside>
    </div>

    {mediaLibraryOpen && <MediaLibraryModal
      key={`${artworkScope}:${mediaTargetPanel}:${selectedMediaAssetId ?? 'none'}`}
      assets={mediaAssets}
      targetScope={artworkScope}
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
  material:string; setMaterial:(v:string)=>void;
  outsideColorMode:BaseColorMode; setOutsideColorMode:(v:BaseColorMode)=>void;
  insideColorMode:BaseColorMode; setInsideColorMode:(v:BaseColorMode)=>void;
  outsideCustomColor:string; setOutsideCustomColor:(v:string)=>void;
  insideCustomColor:string; setInsideCustomColor:(v:string)=>void;
  opening:number; setOpening:(v:number)=>void;
  dimensions:CartonDimensions; setDimensions:(v:CartonDimensions)=>void;
  measurementUnit:MeasurementUnit; setMeasurementUnit:(unit:MeasurementUnit)=>void;
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
      <PanelIntro title="Choose your box" text="Pick the packaging style, then set the finished size of the box." />

      <div className="pro-structure-current">
        <span>Current box</span>
        <div>
          <TemplateVisual template={selectedTemplate} compact />
          <div>
            <strong>{selectedTemplate.name}</strong>
            <small>{selectedTemplate.category} · Ready to edit</small>
            <div className="pro-current-box-size">
              <div className="pro-current-box-size-head">
                <span>Finished size</span>
                <div className="pro-unit-switch" role="group" aria-label="Measurement unit">
                  <button type="button" className={props.measurementUnit === 'mm' ? 'is-active' : ''} onClick={()=>props.setMeasurementUnit('mm')}>mm</button>
                  <button type="button" className={props.measurementUnit === 'in' ? 'is-active' : ''} onClick={()=>props.setMeasurementUnit('in')}>in</button>
                </div>
              </div>
              <div className="pro-current-box-size-fields" aria-label="Finished box size">
                <label><small>W</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.width,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,width:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <i>×</i>
                <label><small>H</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.height,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,height:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <i>×</i>
                <label><small>D</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.depth,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,depth:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <em>{props.measurementUnit}</em>
              </div>
              <button type="button" className="pro-reset-box-size" title="Restore this template’s default width, height, and depth" onClick={() => {
                const defaults = selectedTemplate.defaultDimensions ?? DEFAULT_CARTON_DIMENSIONS;
                props.setDimensions({...props.dimensions, width: defaults.width, height: defaults.height, depth: defaults.depth});
                props.setMessage('Box size reset to template defaults');
              }}><RotateCcw size={12} aria-hidden="true" /> Reset size</button>
              <div className="pro-current-box-thickness">
                <span>Board thickness</span>
                <label>
                  <input
                    type="number"
                    min={props.measurementUnit === 'mm' ? 0.1 : 0.004}
                    max={props.measurementUnit === 'mm' ? 2 : 0.079}
                    step={props.measurementUnit === 'mm' ? 0.1 : 0.001}
                    value={formatDimension(props.dimensions.thickness,props.measurementUnit)}
                    onChange={e=>props.setDimensions({...props.dimensions,thickness:parseDimension(Number(e.target.value),props.measurementUnit)})}
                  />
                  <em>{props.measurementUnit}</em>
                </label>
              </div>
            </div>
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

      <div className="pro-card-section pro-box-thickness-card">
        <SectionTitle title="Board thickness" meta="Box & size" />
        <div className="pro-thickness-control-row">
          <div>
            <strong>Thickness</strong>
            <span>Physical board edge</span>
          </div>
          <label>
            <input
              type="number"
              min={props.measurementUnit === 'mm' ? 0.1 : 0.004}
              max={props.measurementUnit === 'mm' ? 2 : 0.079}
              step={props.measurementUnit === 'mm' ? 0.1 : 0.001}
              value={formatDimension(props.dimensions.thickness,props.measurementUnit)}
              onChange={e=>props.setDimensions({...props.dimensions,thickness:parseDimension(Number(e.target.value),props.measurementUnit)})}
            />
            <em>{props.measurementUnit}</em>
          </label>
        </div>
        <input
          className="pro-range"
          type="range"
          min="3"
          max="20"
          step="1"
          value={Math.round(props.dimensions.thickness*10)}
          onChange={e=>props.setDimensions({...props.dimensions,thickness:Number(e.target.value)/10})}
        />
        <p className="pro-help">Controls the visible board edge and the distance between the outside and inside surfaces.</p>
      </div>

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
            <strong>{props.artworkScope === 'inside' ? 'Design on inside' : 'Design on outside'}</strong>
            <span>{selectedArtwork
              ? `Your ${props.artworkScope} artwork is ready. Change it or adjust how it sits on the package.`
              : `Choose an image for the ${props.artworkScope} of the package.`}</span>
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

        <p className="pro-help">Drag the image on the board to move it. Use the handles to resize and rotate; hold Shift to resize freely.</p>
      </div>
    </div>;
  }

  if (tool === 'material') return <div className="pro-inspector-content">
    <PanelIntro title="Material & finish" text="Choose the board or surface treatment, then fine-tune the physical material settings." />
    <div className="pro-material-grid">{materials.map(item=><button key={item} className={props.material===item?'is-selected':''} onClick={()=>props.setMaterial(item)}><span className={`material-${item.toLowerCase().replaceAll(' ','-')}`}/><b>{item}</b></button>)}</div>

    <div className="pro-card-section pro-base-color-card">
      <SectionTitle title="Base color" meta="Inside / outside" />
      <p className="pro-help">Color is independent from finish. Keep the material default, or override either side—for example, a white box can still be matte, glossy, or soft-touch.</p>

      {(['outside','inside'] as const).map(side => {
        const mode = side === 'outside' ? props.outsideColorMode : props.insideColorMode;
        const setMode = side === 'outside' ? props.setOutsideColorMode : props.setInsideColorMode;
        const customColor = side === 'outside' ? props.outsideCustomColor : props.insideCustomColor;
        const setCustomColor = side === 'outside' ? props.setOutsideCustomColor : props.setInsideCustomColor;
        const materialColor = materialBaseColor(props.material,side);
        const shownColor = mode === 'custom' ? customColor : materialColor;
        return <div className="pro-surface-color-row" key={side}>
          <div className="pro-surface-color-head">
            <div>
              <span>{side === 'outside' ? 'Outside color' : 'Inside color'}</span>
              <strong>{mode === 'material' ? 'Material default' : customColor.toUpperCase()}</strong>
            </div>
            <span className="pro-color-swatch" style={{background:shownColor}} aria-hidden="true"/>
          </div>

          <div className="pro-color-mode-switch" role="group" aria-label={`${side} color source`}>
            <button
              type="button"
              className={mode === 'material' ? 'is-active' : ''}
              onClick={()=>setMode('material')}
            >Material default</button>
            <button
              type="button"
              className={mode === 'custom' ? 'is-active' : ''}
              onClick={()=>{
                if (mode !== 'custom') setCustomColor(materialColor);
                setMode('custom');
              }}
            >Custom</button>
          </div>

          {mode === 'custom' && <div className="pro-color-picker-row">
            <label className="pro-color-picker">
              <input
                type="color"
                value={customColor}
                onChange={e=>setCustomColor(e.target.value.toUpperCase())}
                aria-label={`Choose ${side} box color`}
              />
              <span>Select color</span>
            </label>
            <input
              className="pro-color-hex"
              value={customColor.toUpperCase()}
              maxLength={7}
              aria-label={`${side} color hex value`}
              onChange={e=>{
                const value=e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) setCustomColor(value);
              }}
              onBlur={()=>{
                if (!/^#[0-9A-Fa-f]{6}$/.test(customColor)) setCustomColor(materialColor);
              }}
            />
          </div>}
        </div>;
      })}
    </div>

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
  importedDieline,
  mapping,
  setMapping,
  artworkByPanel,
  layers,
  selectedLayerId,
  onSelectLayer,
  onUpdateLayer,
  onDuplicateLayer,
  onRemoveLayer,
  onMoveLayer,
  artworkScope,
  selectedPanel,
  mediaAssets,
  onPanelSelect,
  onUpdatePanelArtwork,
  onArtworkScopeChange,
  dimensions,
  zoom,
  onZoomChange,
  panEnabled,
  setPanEnabled,
  canvasPan,
  setCanvasPan,
  onChooseFullLayout,
  onApplyChanges,
  onClearImportedDieline,
  livePreview,
}:{
  importedDieline:ParsedDieline|null;
  mapping:DielineMapping|null;
  setMapping:React.Dispatch<React.SetStateAction<DielineMapping|null>>;
  artworkByPanel:ArtworkByPanel;
  layers:FullDielineArtworkLayer[];
  selectedLayerId:string|null;
  onSelectLayer:(id:string|null)=>void;
  onUpdateLayer:(id:string,transform:FullDielineTransform)=>void;
  onDuplicateLayer:(id:string)=>void;
  onRemoveLayer:(id:string)=>void;
  onMoveLayer:(id:string,direction:-1|1)=>void;
  artworkScope:'outside'|'inside';
  selectedPanel:string;
  mediaAssets:LocalMediaAsset[];
  onPanelSelect:(panel:string)=>void;
  onUpdatePanelArtwork:(key:string,transform:FullDielineTransform)=>void;
  onArtworkScopeChange:(scope:'outside'|'inside')=>void;
  dimensions:CartonDimensions;
  zoom:number;
  onZoomChange:(zoom:number)=>void;
  panEnabled:boolean;
  setPanEnabled:(enabled:boolean)=>void;
  canvasPan:{x:number;y:number};
  setCanvasPan:React.Dispatch<React.SetStateAction<{x:number;y:number}>>;
  onChooseFullLayout:()=>void;
  onApplyChanges:()=>void;
  onClearImportedDieline:()=>void;
  livePreview:React.ReactNode;
}) {
  const printClipId=useId().replaceAll(':','');
  const cartonPanels = reverseTuckPanels(dimensions);
  const bounds = reverseTuckBounds(dimensions);
  // Size the 2D sheet from its real physical footprint instead of relying on
  // the old fixed .pro-dieline dimensions. This makes width/height/depth
  // edits visibly reshape the dieline immediately.
  const visualMax = 760;
  const visualScale = visualMax / Math.max(bounds.width, bounds.height);
  const visualWidth = bounds.width * visualScale;
  const visualHeight = bounds.height * visualScale;
  const sideArtwork=Object.entries(artworkByPanel).filter(([key])=>artworkScope==='inside'?key.startsWith('Interior '):!key.startsWith('Interior '));
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) ?? null;
  const panGestureRef = useRef<{ pointerId:number; startX:number; startY:number; originX:number; originY:number } | null>(null);
  type ResizeHandle = 'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
  const gestureRef = useRef<{
    layerId:string;
    type:'move'|'resize'|'rotate';
    handle?:ResizeHandle;
    pointerId:number;
    startX:number;
    startY:number;
    start:FullDielineTransform;
    centerX:number;
    centerY:number;
    startWidthPx:number;
    startHeightPx:number;
    startAngle:number;
  } | null>(null);

  const updateArtworkLayer=(id:string,transform:FullDielineTransform)=>{
    if(id.startsWith('panel:')) onUpdatePanelArtwork(id.slice(6),transform);
    else onUpdateLayer(id,transform);
  };
  const selectArtworkLayer=(id:string)=>{
    if(id.startsWith('panel:')) onPanelSelect(id.slice(6).replace('Interior ',''));
    else onSelectLayer(id);
  };

  const beginLayerGesture = (
    event: React.PointerEvent<HTMLDivElement | HTMLButtonElement>,
    layer: FullDielineArtworkLayer,
    type:'move'|'resize'|'rotate',
    handle?:ResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    selectArtworkLayer(layer.id);
    const element = event.currentTarget.closest('.pro-full-artwork-transform') as HTMLDivElement | null;
    const container = element?.parentElement;
    if (!element || !container) return;
    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width * layer.transform.x / 100;
    const centerY = rect.top + rect.height * layer.transform.y / 100;
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    gestureRef.current = {
      layerId:layer.id,
      type,
      handle,
      pointerId:event.pointerId,
      startX:event.clientX,
      startY:event.clientY,
      start:{...layer.transform},
      centerX,
      centerY,
      startWidthPx:Math.max(1,rect.width * layer.transform.width / 100),
      startHeightPx:Math.max(1,rect.height * layer.transform.height / 100),
      startAngle:Math.atan2(dy,dx),
    };
    element.setPointerCapture(event.pointerId);
  };

  const updateLayerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    if (gesture.type === 'move') {
      const dx = (event.clientX - gesture.startX) / Math.max(1,rect.width) * 100;
      const dy = (event.clientY - gesture.startY) / Math.max(1,rect.height) * 100;
      updateArtworkLayer(gesture.layerId,{
        ...gesture.start,
        x:Math.max(-100,Math.min(200,gesture.start.x+dx)),
        y:Math.max(-100,Math.min(200,gesture.start.y+dy)),
      });
      return;
    }

    if (gesture.type === 'resize' && gesture.handle) {
      const rotation = gesture.start.rotation * Math.PI / 180;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const dx = event.clientX - gesture.centerX;
      const dy = event.clientY - gesture.centerY;
      const localX = dx * cos + dy * sin;
      const localY = -dx * sin + dy * cos;
      const startWidth = gesture.startWidthPx;
      const startHeight = gesture.startHeightPx;
      const minWidth = Math.max(18, rect.width * 0.03);
      const minHeight = Math.max(18, rect.height * 0.03);
      const maxWidth = rect.width * 3;
      const maxHeight = rect.height * 3;
      const handle = gesture.handle;
      const isCorner = handle.length === 2;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let centerLocalX = 0;
      let centerLocalY = 0;

      if (isCorner) {
        const dirX = handle.includes('e') ? 1 : -1;
        const dirY = handle.includes('s') ? 1 : -1;
        const anchorX = -dirX * startWidth / 2;
        const anchorY = -dirY * startHeight / 2;
        const currentWidth = Math.max(minWidth, Math.min(maxWidth, dirX * (localX - anchorX)));
        const currentHeight = Math.max(minHeight, Math.min(maxHeight, dirY * (localY - anchorY)));

        if (event.shiftKey) {
          // Shift unlocks the aspect ratio, so width and height can move independently.
          newWidth = currentWidth;
          newHeight = currentHeight;
        } else {
          const scaleX = currentWidth / startWidth;
          const scaleY = currentHeight / startHeight;
          const scale = Math.max(
            Math.max(minWidth / startWidth, minHeight / startHeight),
            Math.min(Math.min(maxWidth / startWidth, maxHeight / startHeight), Math.max(scaleX, scaleY)),
          );
          newWidth = startWidth * scale;
          newHeight = startHeight * scale;
        }

        const movingX = anchorX + dirX * newWidth;
        const movingY = anchorY + dirY * newHeight;
        centerLocalX = (anchorX + movingX) / 2;
        centerLocalY = (anchorY + movingY) / 2;
      } else if (handle === 'e' || handle === 'w') {
        const dirX = handle === 'e' ? 1 : -1;
        const anchorX = -dirX * startWidth / 2;
        newWidth = Math.max(minWidth, Math.min(maxWidth, dirX * (localX - anchorX)));
        const movingX = anchorX + dirX * newWidth;
        centerLocalX = (anchorX + movingX) / 2;

        if (!event.shiftKey) {
          const scale = newWidth / startWidth;
          newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight * scale));
        }
      } else {
        const dirY = handle === 's' ? 1 : -1;
        const anchorY = -dirY * startHeight / 2;
        newHeight = Math.max(minHeight, Math.min(maxHeight, dirY * (localY - anchorY)));
        const movingY = anchorY + dirY * newHeight;
        centerLocalY = (anchorY + movingY) / 2;

        if (!event.shiftKey) {
          const scale = newHeight / startHeight;
          newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth * scale));
        }
      }

      const centerDx = centerLocalX * cos - centerLocalY * sin;
      const centerDy = centerLocalX * sin + centerLocalY * cos;
      const nextCenterX = gesture.centerX + centerDx;
      const nextCenterY = gesture.centerY + centerDy;

      updateArtworkLayer(gesture.layerId,{
        ...gesture.start,
        x:(nextCenterX - rect.left) / Math.max(1,rect.width) * 100,
        y:(nextCenterY - rect.top) / Math.max(1,rect.height) * 100,
        width:newWidth / Math.max(1,rect.width) * 100,
        height:newHeight / Math.max(1,rect.height) * 100,
      });
      return;
    }

    const angle=Math.atan2(event.clientY-gesture.centerY,event.clientX-gesture.centerX);
    const delta=(angle-gesture.startAngle)*180/Math.PI;
    updateArtworkLayer(gesture.layerId,{...gesture.start,rotation:gesture.start.rotation+delta});
  };

  const endLayerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gestureRef.current=null;
  };

  if (importedDieline) {
    return <><ImportedDielineMapper
      dieline={importedDieline}
      mapping={mapping ?? createInitialDielineMapping(importedDieline)}
      setMapping={setMapping}
      onClear={onClearImportedDieline}
    /><div className="pro-2d-side-panels pro-2d-preview-only">{livePreview}</div></>;
  }

  return <div className="pro-dieline-stage pro-2d-design-stage">
    <div className="pro-2d-design-toolbar">
      <div className="pro-dieline-surface-switch" role="group" aria-label="Printed side">
        <button type="button" className={artworkScope==='outside'?'is-active':''} onClick={()=>onArtworkScopeChange('outside')}>Outside</button>
        <button type="button" className={artworkScope==='inside'?'is-active':''} onClick={()=>onArtworkScopeChange('inside')}>Inside</button>
      </div>
      <div className="pro-2d-toolbar-summary">
        <span>{artworkScope === 'inside' ? 'Inside / reverse side' : 'Outside / front side'}</span>
        <strong>{layers.length ? `${layers.length} layer${layers.length===1?'':'s'} · live 3D sync` : 'No artwork layers yet'}</strong>
      </div>
      <button className="pro-secondary-button" onClick={onChooseFullLayout}><ImageIcon size={16}/> Add image</button>
      <button
        type="button"
        className={`pro-secondary-button pro-drag-board-button${panEnabled?' is-active':''}`}
        aria-pressed={panEnabled}
        title={panEnabled ? 'Stop dragging the board' : 'Drag the 2D board'}
        onClick={()=>setPanEnabled(!panEnabled)}
      ><Move size={16}/> {panEnabled ? 'Dragging board' : 'Drag board'}</button>
      {selectedLayer && <button className="pro-secondary-button" onClick={() => onUpdateLayer(
        selectedLayer.id,
        createFullDielineTransform(selectedLayer.aspectRatio, bounds.width / bounds.height),
      )}><Maximize2 size={15}/> Reset selected</button>}
      <button type="button" className="pro-apply-artwork-button" onClick={onApplyChanges}><Check size={16}/> Apply Changes</button>
    </div>

    <div
      className={`pro-dieline-workspace${panEnabled ? ' is-pan-enabled' : ''}`}
      onWheel={(event)=>{
        if ((event.target as HTMLElement).closest('.pro-2d-side-panels')) return;
        event.preventDefault();
        const step = event.deltaY > 0 ? -8 : 8;
        onZoomChange(Math.max(45,Math.min(200,zoom+step)));
      }}
      onPointerDownCapture={(event)=>{
        if (!panEnabled) return;
        if ((event.target as HTMLElement).closest('.pro-2d-side-panels')) return;
        event.preventDefault();
        event.stopPropagation();
        panGestureRef.current = {
          pointerId:event.pointerId,
          startX:event.clientX,
          startY:event.clientY,
          originX:canvasPan.x,
          originY:canvasPan.y,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event)=>{
        const gesture=panGestureRef.current;
        if (!gesture || gesture.pointerId!==event.pointerId) return;
        setCanvasPan({
          x:gesture.originX + event.clientX - gesture.startX,
          y:gesture.originY + event.clientY - gesture.startY,
        });
      }}
      onPointerUp={(event)=>{
        if (panGestureRef.current?.pointerId!==event.pointerId) return;
        panGestureRef.current=null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event)=>{
        if (panGestureRef.current?.pointerId!==event.pointerId) return;
        panGestureRef.current=null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
    >
      <div className="pro-2d-side-panels">
        {livePreview}
      <aside className="pro-dieline-layers-panel" aria-label={`${artworkScope} artwork layers`}>
        <div className="pro-dieline-layers-heading">
          <div><span>Layers</span><strong>{layers.length+sideArtwork.length}</strong></div>
          <button type="button" onClick={onChooseFullLayout}><Upload size={14}/> Add</button>
        </div>
        {layers.length ? <div className="pro-dieline-layer-list">
          {[...layers].reverse().map((layer,reverseIndex) => {
            const realIndex=layers.length-1-reverseIndex;
            const selected=layer.id===selectedLayerId;
            return <button
              type="button"
              key={layer.id}
              className={selected?'is-selected':''}
              onClick={()=>onSelectLayer(layer.id)}
            >
              <img src={layer.url} alt="" />
              <span><strong>{layer.name}</strong><small>{Math.round(layer.transform.width)} × {Math.round(layer.transform.height)}% · {Math.round(layer.transform.rotation)}°</small></span>
              <i>{realIndex===layers.length-1?'Top':realIndex+1}</i>
            </button>;
          })}
        </div> : sideArtwork.length ? null : <div className="pro-dieline-layers-empty"><ImageIcon size={22}/><span>Add artwork to start composing.</span></div>}

        {sideArtwork.length>0 && <div className="pro-dieline-layer-list">{sideArtwork.map(([key,artwork])=><button key={key} type="button" className={selectedPanel===key.replace('Interior ','') && !selectedLayerId?'is-selected':''} onClick={()=>onPanelSelect(key.replace('Interior ',''))}><img src={artwork.url} alt=""/><span><strong>{artwork.name}</strong><small>{key}</small></span></button>)}</div>}

        {selectedLayer && <div className="pro-dieline-layer-actions">
          <button type="button" title="Bring forward" aria-label="Bring selected layer forward" disabled={layers[layers.length-1]?.id===selectedLayer.id} onClick={()=>onMoveLayer(selectedLayer.id,1)}><ArrowUp size={14}/></button>
          <button type="button" title="Send backward" aria-label="Send selected layer backward" disabled={layers[0]?.id===selectedLayer.id} onClick={()=>onMoveLayer(selectedLayer.id,-1)}><ArrowDown size={14}/></button>
          <button type="button" title="Duplicate" aria-label="Duplicate selected layer" onClick={()=>onDuplicateLayer(selectedLayer.id)}><Copy size={14}/></button>
          <button type="button" title="Delete" aria-label="Delete selected layer" onClick={()=>onRemoveLayer(selectedLayer.id)}><Trash2 size={14}/></button>
        </div>}
      </aside>
      </div>

      <div
        className={`pro-dieline pro-dieline-live${layers.length ? ' has-full-layout-editor' : ''}`}
        style={{
          width:`${visualWidth}px`,
          height:`${visualHeight}px`,
          maxWidth:'none',
          maxHeight:'none',
          aspectRatio:'auto',
          transform:`translate(${canvasPan.x}px,${canvasPan.y}px) scale(${zoom/100})`,
          transformOrigin:'center',
        }}
        onPointerDown={(event)=>{if(event.target===event.currentTarget) onSelectLayer(null);}}
      >
        <svg width="0" height="0" aria-hidden="true"><defs><clipPath id={printClipId} clipPathUnits="objectBoundingBox">{cartonPanels.map(item=><rect key={item.id} x={item.x/bounds.width} y={item.y/bounds.height} width={item.width/bounds.width} height={item.height/bounds.height}/>)}</clipPath></defs></svg>
        <div className="pro-full-artwork-print-surface" style={{clipPath:`url(#${printClipId})`}}>{layers.map(layer=><div key={layer.id} className="pro-printed-artwork-layer" style={{left:`${layer.transform.x}%`,top:`${layer.transform.y}%`,width:`${layer.transform.width}%`,height:`${layer.transform.height}%`,transform:`translate(-50%,-50%) rotate(${layer.transform.rotation}deg)`}}><img src={layer.url} alt="" draggable={false}/></div>)}</div>
        {layers.map((layer,index)=>{
          const selected=layer.id===selectedLayerId;
          return <div
            key={layer.id}
            className={`pro-full-artwork-transform${selected?' is-selected':''}`}
            style={{
              left:`${layer.transform.x}%`,
              top:`${layer.transform.y}%`,
              width:`${layer.transform.width}%`,
              height:`${layer.transform.height}%`,
              transform:`translate(-50%,-50%) rotate(${layer.transform.rotation}deg)`,
              zIndex:10+index,
            }}
            onPointerDown={event=>beginLayerGesture(event,layer,'move')}
            onPointerMove={updateLayerGesture}
            onPointerUp={endLayerGesture}
            onPointerCancel={endLayerGesture}
          >
            <span className="pro-artwork-transform-hit-area" aria-label={layer.name}/>
            {selected && <>
              <span className="pro-transform-box" aria-hidden="true"/>
              {(['nw','n','ne','e','se','s','sw','w'] as const).map(handle => <button
                key={handle}
                type="button"
                className={`pro-transform-handle pro-transform-resize pro-transform-${handle}`}
                aria-label={`Resize selected artwork from ${handle}`}
                onPointerDown={event=>beginLayerGesture(event,layer,'resize',handle)}
              />)}
              <button type="button" className="pro-transform-handle pro-transform-rotate" aria-label="Rotate selected artwork" onPointerDown={event=>beginLayerGesture(event,layer,'rotate')}><span/></button>
            </>}
          </div>;
        })}

        {cartonPanels.map(item => {
          const panelName=item.label[0]+item.label.slice(1).toLowerCase();
          const explicitArtwork=artworkByPanel[artworkScope==='inside'? `Interior ${panelName}`:panelName];
          const hasArtwork=!!explicitArtwork || layers.length>0;
          return <div
            key={item.id}
            className={`dl-live dl-${item.kind} ${hasArtwork?'has-artwork':''} ${explicitArtwork?'has-explicit-artwork':''} pro-dieline-panel-guide`}
            style={{left:`${item.x/bounds.width*100}%`,top:`${item.y/bounds.height*100}%`,width:`${item.width/bounds.width*100}%`,height:`${item.height/bounds.height*100}%`,overflow:'hidden'}}
            aria-label={`${artworkScope} ${panelName} panel guide`}
          >
            {explicitArtwork ? <span className="artwork-layer" style={artworkCss(explicitArtwork)}/> : null}
            <span className="dl-label">{item.label}</span>
          </div>;
        })}

        {cartonPanels.filter(item=>!selectedLayerId && item.label.toLowerCase()===selectedPanel.toLowerCase()).map(item=>{
          const key=artworkScope==='inside'?`Interior ${selectedPanel}`:selectedPanel;
          const artwork=artworkByPanel[key];
          if(!artwork) return null;
          const asset=mediaAssets.find(asset=>asset.id===artwork.assetId);
          const imageAspect=asset?.width && asset.height ? asset.width/asset.height : 1;
          const faceAspect=item.width/item.height;
          let width=100,height=100;
          if(artwork.mode==='fill') {if(imageAspect>faceAspect)width=100*imageAspect/faceAspect;else height=100*faceAspect/imageAspect;}
          else {if(imageAspect>faceAspect)height=100*faceAspect/imageAspect;else width=100*imageAspect/faceAspect;}
          width*=artwork.scale/100;height*=artwork.scale/100;
          const transform=artwork.transform ?? {x:50+(100-width)/2*artwork.alignX,y:50+(100-height)/2*artwork.alignY,width,height,rotation:artwork.rotation};
          const layer:FullDielineArtworkLayer={id:`panel:${key}`,name:artwork.name,url:artwork.url,aspectRatio:imageAspect,transform};
          return <div key={item.id} className="pro-side-artwork-transform-surface" style={{left:`${item.x/bounds.width*100}%`,top:`${item.y/bounds.height*100}%`,width:`${item.width/bounds.width*100}%`,height:`${item.height/bounds.height*100}%`}}>
            <div className="pro-full-artwork-transform pro-side-artwork-transform is-selected" style={{left:`${transform.x}%`,top:`${transform.y}%`,width:`${transform.width}%`,height:`${transform.height}%`,transform:`translate(-50%,-50%) rotate(${transform.rotation}deg)`}}
              aria-label={`Move ${selectedPanel} artwork`}
              onPointerDown={event=>beginLayerGesture(event,layer,'move')} onPointerMove={updateLayerGesture} onPointerUp={endLayerGesture} onPointerCancel={endLayerGesture}>
              <span className="pro-transform-box" aria-hidden="true"/>
              {(['nw','n','ne','e','se','s','sw','w'] as const).map(handle=><button key={handle} type="button" className={`pro-transform-handle pro-transform-resize pro-transform-${handle}`} aria-label={`Resize ${selectedPanel} artwork from ${handle}`} onPointerDown={event=>beginLayerGesture(event,layer,'resize',handle)}/>)}
              <button type="button" className="pro-transform-handle pro-transform-rotate" aria-label={`Rotate ${selectedPanel} artwork`} onPointerDown={event=>beginLayerGesture(event,layer,'rotate')}><span/></button>
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className="pro-dieline-legend">
      <span><i className="cut"/>Cut</span>
      <span><i className="crease"/>Crease</span>
      <span><i className="bleed"/>Bleed</span>
      <strong>{layers.length ? 'Resize keeps proportions · hold Shift to change proportions freely · 3D updates automatically' : `Add artwork to the ${artworkScope} side of the sheet`}</strong>
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
  targetScope: 'outside' | 'inside';
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
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const fitMode:ArtworkMode='fit',scale=100,rotation=0;
  const usageCount = selected ? Object.values(props.artworkByPanel).filter(artwork => artwork.assetId === selected.id).length : 0;
  const targetLabel = props.targetPanel === '__FULL_DIELINE__'
    ? `${props.targetScope === 'inside' ? 'Inside' : 'Outside'} dieline`
    : props.targetPanel.replace('Interior ', 'Inside ');
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
          <p>Choose or upload an image, then position it directly on the 2D board.</p>
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
            <div><strong>{dragging ? 'Drop it here' : 'Drop artwork here'}</strong><span>PNG, JPG, WebP or SVG · any image dimensions</span></div>
            <button type="button" onClick={props.onUpload}>Browse</button>
          </div>

          {filteredAssets.length === 0 ? <div className="pro-media-empty">
            <ImageIcon size={30}/>
            <h3>{props.assets.length ? 'No matching artwork' : 'Upload your first image'}</h3>
            <p>{props.assets.length ? 'Try another search.' : 'Your image will appear here immediately and can be positioned on the dieline.'}</p>
            {!props.assets.length && <button className="pro-primary pro-media-empty-action" onClick={props.onUpload}><Upload size={15}/> Choose image</button>}
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

            <div className="pro-media-canvas-handoff"><Move size={16}/><p><strong>Place it on the board</strong><span>Drag, resize and rotate directly in 2D Design after adding.</span></p></div>

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
            <p>Everything happens here. Select an existing image or upload a new one, then place it on the board.</p>
            <button className="pro-primary pro-media-empty-action" onClick={props.onUpload}><Upload size={15}/> Upload image</button>
          </div>}
        </aside>
      </div>

      <footer className="pro-media-modal-footer">
        <span>{props.targetPanel === '__FULL_DIELINE__'
          ? `You can continue moving and resizing this artwork on the ${props.targetScope} 2D dieline.`
          : `Adding artwork to ${targetLabel}.`}</span>
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

function clampThickness(valueMm: number) {
  if (!Number.isFinite(valueMm)) return 0.5;
  return Math.min(2,Math.max(0.3,Math.round(valueMm*100)/100));
}

function formatThickness(valueMm: number, unit: MeasurementUnit) {
  const value=clampThickness(valueMm);
  return unit === 'mm' ? Number(value.toFixed(2)) : Number((value/25.4).toFixed(3));
}

function formatDimension(valueMm: number, unit: MeasurementUnit) {
  if (unit === 'mm') return Math.round(valueMm * 10) / 10;
  return Math.round((valueMm / 25.4) * 100) / 100;
}

function parseDimension(value: number, unit: MeasurementUnit) {
  if (!Number.isFinite(value)) return 0;
  return unit === 'mm' ? value : value * 25.4;
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
