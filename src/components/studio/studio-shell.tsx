'use client';

import type { MessageKey } from '@/lib/i18n';
import { getPackagingTemplateCopy } from '@/lib/i18n/template-copy';
import { useTranslations } from '@/components/i18n/locale-provider';
import Link from 'next/link';
import { BoardArtworkImage } from './board-artwork-image';
import { TemplateVisual } from './template-visual';
import { panForAnchoredZoom, scaleStudioZoom, wheelStudioZoom } from '@/lib/studio-zoom';
import type { LegacyOpeningMode, SavedStudioProject, StudioProjectState } from '@/lib/studio-project';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Box, Boxes, Camera, Check, ChevronDown, CirclePlay, Copy, Download,
  Grid3X3, Image as ImageIcon, Layers3, Lightbulb, Maximize2, Move,
  FilePlus2, MoreHorizontal, PackageOpen, Pencil, Redo2, RotateCcw, RotateCw, Search, Share2, Sparkles, Star, Undo2, ZoomIn, ZoomOut,
  Trash2, Upload, X
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { AccountButton } from '@/components/auth/account-button';
import { CartonEngine, type CartonEngineHandle } from '@/components/studio/carton-engine';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { getTemplateAssemblyState, getTemplateGeometry, getTemplateRuntime, templateAssemblyValuesForProgress } from '@/lib/packaging/template-runtime';
import { artworkCss, defaultArtworkPlacement, type ArtworkByPanel, type ArtworkMode, type LocalMediaAsset } from '@/lib/packaging/artwork';
import { PACKAGING_TEMPLATES, getDefaultPackagingTemplate, getPackagingTemplateCategories, type PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import { parseDielineFile, type ParsedDieline } from '@/lib/packaging/dieline-import';
import { createInitialDielineMapping, mappingProgress, panelCandidates, primitiveSummary, type DielineMapping, type DielineLineRole, type DielinePanelName } from '@/lib/packaging/dieline-mapping';
import { printDielineLayout } from '@/lib/packaging/dieline-print';
import { createFullDielineTransform, rasterizeFullDielineLayers, rasterizePanelArtwork, type FullDielineArtworkLayer, type FullDielineTransform } from '@/lib/packaging/full-dieline-artwork';

type Tool = 'structure' | 'artwork' | 'material' | 'opening' | 'scene' | 'export';
type StudioArea = 'box' | 'design' | 'preview';
type Mode = '3d' | 'dieline';
type MeasurementUnit = 'mm' | 'in';
type BaseColorMode = 'material' | 'custom';
type MediaUploadProgress = {
  active:boolean;
  fileName:string;
  fileIndex:number;
  totalFiles:number;
  percent:number;
  phase:'uploading'|'processing'|'complete';
};

type StudioHistorySnapshot = {
  family:string;
  selectedTemplateId:string;
  material:string;
  outsideColorMode:BaseColorMode;
  insideColorMode:BaseColorMode;
  outsideCustomColor:string;
  insideCustomColor:string;
  opening:number;
  formation:number;
  openingMode:LegacyOpeningMode;
  splitTopHingeSide:'side_a'|'side_b';
  dimensions:CartonDimensions;
  measurementUnit:MeasurementUnit;
  artworkByPanel:ArtworkByPanel;
  outsideDielineLayers:FullDielineArtworkLayer[];
  insideDielineLayers:FullDielineArtworkLayer[];
};

const STUDIO_HISTORY_LIMIT = 80;
const STUDIO_HISTORY_DEBOUNCE_MS = 220;

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

async function readUploadDimensions(file:File):Promise<{width:number|null;height:number|null}>{
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();
    const result=await new Promise<{width:number|null;height:number|null}>((resolve)=>{
      image.onload=()=>resolve({
        width:image.naturalWidth||null,
        height:image.naturalHeight||null,
      });
      image.onerror=()=>resolve({width:null,height:null});
      image.src=url;
    });
    return result;
  }finally{
    URL.revokeObjectURL(url);
  }
}


function uploadMediaFile(
  file:File,
  dimensions:{width:number|null;height:number|null},
  onProgress:(percent:number,phase:'uploading'|'processing')=>void,
):Promise<LocalMediaAsset>{
  return new Promise((resolve,reject)=>{
    const form=new FormData();
    form.set('file',file);
    if(dimensions.width)form.set('width',String(dimensions.width));
    if(dimensions.height)form.set('height',String(dimensions.height));

    const xhr=new XMLHttpRequest();
    xhr.open('POST','/api/media');
    xhr.responseType='json';
    xhr.upload.onprogress=(event)=>{
      if(event.lengthComputable){
        onProgress(Math.max(0,Math.min(99,Math.round(event.loaded/event.total*100))),'uploading');
      }
    };
    xhr.upload.onload=()=>onProgress(100,'processing');
    xhr.onerror=()=>reject(new Error('Network error while uploading artwork.'));
    xhr.onabort=()=>reject(new Error('Artwork upload was cancelled.'));
    xhr.onload=()=>{
      const result=(xhr.response ?? {}) as {asset?:LocalMediaAsset;error?:string};
      if(xhr.status>=200&&xhr.status<300&&result.asset)resolve(result.asset);
      else reject(new Error(result.error||'Could not upload artwork.'));
    };
    xhr.send(form);
  });
}
const tools: { id: Tool; label: MessageKey; icon: typeof Box }[] = [
  { id: 'structure', label: "studio.box_size", icon: Box },
  { id: 'artwork', label: "studio.artwork", icon: ImageIcon },
  { id: 'material', label: "studio.material_finish", icon: Layers3 },
  { id: 'opening', label: "studio.open_close", icon: PackageOpen },
  { id: 'scene', label: "studio.scene", icon: Lightbulb },
  { id: 'export', label: "studio.download", icon: Download },
];

const studioAreas: { id: StudioArea; label: MessageKey; helper: MessageKey; icon: typeof Box; defaultTool: Tool; tools: Tool[] }[] = [
  { id: 'box', label: "studio.box", helper: "studio.structure_size_finish", icon: Box, defaultTool: 'structure', tools: ['structure','material'] },
  { id: 'design', label: "studio.design_2", helper: "studio.artwork_print_layout", icon: ImageIcon, defaultTool: 'artwork', tools: ['artwork'] },
  { id: 'preview', label: "studio.preview_download", helper: "studio.3d_review_output", icon: Boxes, defaultTool: 'opening', tools: ['opening','scene','export'] },
];

const materials = ['White board','Kraft','Soft touch','Matte coated','Gloss coated','Foil'];
const cameras = ['Perspective','Front','Back','Left','Right','Top'];

export function StudioShell({initialProject,initialWorkspaceProjectId,initialTemplateId}:{initialProject?:SavedStudioProject;initialWorkspaceProjectId?:string;initialTemplateId?:string} = {}) {
  const t = useTranslations();

  const initial = initialProject?.state;
  const [projectId,setProjectId] = useState(initialProject?.legacyImport ? undefined : initialProject?.id);
  const [projectName,setProjectName] = useState(initialProject?.name ?? 'Untitled design');
  const [projectRevision,setProjectRevision] = useState(initialProject?.revision);
  const [workspaceProjectId,setWorkspaceProjectId] = useState(initialWorkspaceProjectId ?? initialProject?.workspaceProjectId ?? null);
  const [saving,setSaving] = useState(false);
  const [saveFailed,setSaveFailed] = useState(false);
  const [hasUnsavedChanges,setHasUnsavedChanges] = useState(false);
  const [favorite,setFavorite] = useState(initialProject?.favorite ?? false);
  const [fileMenuOpen,setFileMenuOpen] = useState(false);
  const [deleteModalOpen,setDeleteModalOpen] = useState(false);
  const [deleting,setDeleting] = useState(false);
  const [saveConflictOpen,setSaveConflictOpen] = useState(false);
  const [shareOpen,setShareOpen] = useState(false);
  const [shareBusy,setShareBusy] = useState(false);
  const [shareUrl,setShareUrl] = useState('');
  const [shareId,setShareId] = useState('');
  const [shareError,setShareError] = useState('');
  const [projectTransferMode,setProjectTransferMode] = useState<'move'|'copy'|null>(null);
  const [projectOptions,setProjectOptions] = useState<Array<{id:string;name:string;isDefault:boolean;designCount:number;sceneCount:number}>>([]);
  const [transferProjectId,setTransferProjectId] = useState('');
  const [transferBusy,setTransferBusy] = useState(false);
  const [transferError,setTransferError] = useState('');
  const [transferLoading,setTransferLoading] = useState(false);
  const saveInFlightRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const autosaveBlockedFingerprintRef = useRef<string | null>(null);
  const projectNameRef = useRef<HTMLInputElement>(null);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool | null>(initialProject ? 'opening' : 'structure');
  const [mode, setMode] = useState<Mode>('3d');
  const [workflowStep,setWorkflowStep] = useState<StudioArea>(initialProject ? 'preview' : 'box');
  const requestedTemplate = !initialProject && initialTemplateId
    ? PACKAGING_TEMPLATES.find(template => template.id === initialTemplateId && template.status === 'ready')
    : null;
  const initialTemplate = PACKAGING_TEMPLATES.find(template => template.id === initial?.templateId && template.status === 'ready')
    ?? requestedTemplate
    ?? getDefaultPackagingTemplate();
  if(!initialTemplate) throw new Error('No ready packaging template is configured.');
  const initialRuntime = getTemplateRuntime(initialTemplate.id);
  if(!initialRuntime) throw new Error(`No runtime is registered for template: ${initialTemplate.id}`);
  const [family, setFamily] = useState(initialTemplate.name);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplate.id);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState('All');
  const [templatePreview,setTemplatePreview] = useState<PackagingTemplateDefinition|null>(null);
  const [panel, setPanel] = useState('Front');
  const [artworkScope, setArtworkScope] = useState<'outside' | 'inside'>('outside');
  const [material, setMaterial] = useState(initial?.material ?? 'Soft touch');
  const [outsideColorMode, setOutsideColorMode] = useState<BaseColorMode>(initial?.outsideColorMode ?? 'material');
  const [insideColorMode, setInsideColorMode] = useState<BaseColorMode>(initial?.insideColorMode ?? 'material');
  const [outsideCustomColor, setOutsideCustomColor] = useState(initial?.outsideCustomColor ?? '#C7D4DE');
  const [insideCustomColor, setInsideCustomColor] = useState(initial?.insideCustomColor ?? '#D7E0E7');
  const [camera, setCamera] = useState(initial?.legacySourceId ? 'LegacyPerspective' : 'Perspective');
  const [cameraMenuOpen, setCameraMenuOpen] = useState(false);
  const legacyFormation = initial?.formation ?? (initialRuntime.assembly.legacyOpeningAsFormation ? initial?.opening : undefined);
  const [formation,setFormationValue] = useState(legacyFormation ?? 100);
  const [opening, setOpeningValue] = useState(initialRuntime.assembly.legacyOpeningAsFormation && initial?.formation===undefined ? 0 : (initial?.opening ?? 0));
  const [openingMode,setOpeningMode] = useState<LegacyOpeningMode>(initial?.openingMode ?? initialRuntime.assembly.defaultOpeningMode);
  const [splitTopHingeSide,setSplitTopHingeSide] = useState<'side_a'|'side_b'>(initial?.splitTopHingeSide ?? 'side_a');
  const [zoom, setZoom] = useState(initial?.legacySourceId ? 57.34 : 82);
  const [viewPan3d,setViewPan3d] = useState({x:0,y:0});
  const initialDimensions=initial?.dimensions ?? initialTemplate.defaultDimensions;
  if(!initialDimensions)throw new Error(`Ready template ${initialTemplate.id} is missing default dimensions.`);
  const [dimensions, setDimensions] = useState<CartonDimensions>(initialRuntime.sanitizeParameters(initialDimensions));
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
  const [spacePanActive, setSpacePanActive] = useState(false);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const zoomRef=useRef(zoom);
  const dielineZoomRef=useRef(dielineZoom);
  const viewPan3dRef=useRef(viewPan3d);
  const canvasPanRef=useRef(canvasPan);
  const [pdfExportRequest,setPdfExportRequest] = useState(0);
  const liveMapTokenRef = useRef(0);
  const panelMapTokenRef = useRef(0);
  const [mediaAssets, setMediaAssets] = useState<LocalMediaAsset[]>(initial?.mediaAssets ?? []);
  const mediaAssetsRef = useRef<LocalMediaAsset[]>(initial?.mediaAssets ?? []);
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);
  const [mediaUploadProgress,setMediaUploadProgress] = useState<MediaUploadProgress|null>(null);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<'library' | 'upload'>('library');
  const [selectedMediaAssetId, setSelectedMediaAssetId] = useState<string | null>(null);
  const [mediaTargetPanel, setMediaTargetPanel] = useState('Front');
  const [inspectorOpen, setInspectorOpen] = useState(!initialProject);
  const [designToolsOpen, setDesignToolsOpen] = useState(true);
  const [faceAction, setFaceAction] = useState<{ panel: string; x: number; y: number } | null>(null);
  const [message, setMessage] = useState('Ready');
  const [importedDieline, setImportedDieline] = useState<ParsedDieline | null>(null);
  const [dielineMapping, setDielineMapping] = useState<DielineMapping | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dielineFileRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<CartonEngineHandle>(null);
  const studioCanvasRef = useRef<HTMLElement>(null);
  const faceActionRef = useRef<HTMLDivElement>(null);
  const cameraMenuRef = useRef<HTMLDivElement>(null);
  const foldAnimationRef = useRef<number | null>(null);

  const historySnapshot = useMemo<StudioHistorySnapshot>(() => ({
    family,
    selectedTemplateId,
    material,
    outsideColorMode,
    insideColorMode,
    outsideCustomColor,
    insideCustomColor,
    opening,
    formation,
    openingMode,
    splitTopHingeSide,
    dimensions,
    measurementUnit,
    artworkByPanel,
    outsideDielineLayers,
    insideDielineLayers,
  }), [
    family,
    selectedTemplateId,
    material,
    outsideColorMode,
    insideColorMode,
    outsideCustomColor,
    insideCustomColor,
    opening,
    formation,
    openingMode,
    splitTopHingeSide,
    dimensions,
    measurementUnit,
    artworkByPanel,
    outsideDielineLayers,
    insideDielineLayers,
  ]);
  const historySerialized = useMemo(() => JSON.stringify(historySnapshot), [historySnapshot]);
  const saveFingerprint = useMemo(() => JSON.stringify({name:projectName,state:historySerialized}), [projectName,historySerialized]);
  const lastSavedFingerprintRef = useRef(saveFingerprint);
  const historySnapshotRef = useRef(historySnapshot);
  const historySerializedRef = useRef(historySerialized);
  const historyPastRef = useRef<StudioHistorySnapshot[]>([]);
  const historyFutureRef = useRef<StudioHistorySnapshot[]>([]);
  const historyCommittedRef = useRef(historySnapshot);
  const historyCommittedSerializedRef = useRef(historySerialized);
  const historyApplyingSerializedRef = useRef<string | null>(null);
  const historyTimerRef = useRef<number | null>(null);
  const [historyStatus,setHistoryStatus] = useState({canUndo:false,canRedo:false});

  useEffect(() => {
    historySnapshotRef.current = historySnapshot;
    historySerializedRef.current = historySerialized;
  }, [historySnapshot, historySerialized]);

  const applyHistorySnapshot = (snapshot:StudioHistorySnapshot, messageText:string) => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    historyApplyingSerializedRef.current = JSON.stringify(snapshot);
    setFamily(snapshot.family);
    setSelectedTemplateId(snapshot.selectedTemplateId);
    setMaterial(snapshot.material);
    setOutsideColorMode(snapshot.outsideColorMode);
    setInsideColorMode(snapshot.insideColorMode);
    setOutsideCustomColor(snapshot.outsideCustomColor);
    setInsideCustomColor(snapshot.insideCustomColor);
    setOpeningValue(snapshot.opening);
    setFormationValue(snapshot.formation);
    setOpeningMode(snapshot.openingMode);
    setSplitTopHingeSide(snapshot.splitTopHingeSide);
    setDimensions(snapshot.dimensions);
    setMeasurementUnit(snapshot.measurementUnit);
    setArtworkByPanel(snapshot.artworkByPanel);
    setOutsideDielineLayers(snapshot.outsideDielineLayers);
    setInsideDielineLayers(snapshot.insideDielineLayers);
    setSelectedOutsideLayerId(current => snapshot.outsideDielineLayers.some(layer => layer.id === current) ? current : null);
    setSelectedInsideLayerId(current => snapshot.insideDielineLayers.some(layer => layer.id === current) ? current : null);
    setFaceAction(null);
    setCameraMenuOpen(false);
    setMessage(messageText);
  };

  const commitCurrentHistory = useCallback(() => {
    if (historyTimerRef.current !== null) {
      window.clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const current = historySnapshotRef.current;
    const serialized = historySerializedRef.current;
    if (serialized === historyCommittedSerializedRef.current) return false;
    historyPastRef.current = [...historyPastRef.current, historyCommittedRef.current].slice(-STUDIO_HISTORY_LIMIT);
    historyFutureRef.current = [];
    historyCommittedRef.current = current;
    historyCommittedSerializedRef.current = serialized;
    setHistoryStatus({canUndo:historyPastRef.current.length > 0,canRedo:false});
    return true;
  }, []);

  const undoStudioAction = useCallback(() => {
    if (historyApplyingSerializedRef.current !== null) return;
    if (historySerializedRef.current !== historyCommittedSerializedRef.current) commitCurrentHistory();
    const previous = historyPastRef.current.pop();
    if (!previous) return;
    historyFutureRef.current = [...historyFutureRef.current, historyCommittedRef.current].slice(-STUDIO_HISTORY_LIMIT);
    applyHistorySnapshot(previous, 'Undid last change');
  }, [applyHistorySnapshot, commitCurrentHistory]);

  const redoStudioAction = useCallback(() => {
    if (historyApplyingSerializedRef.current !== null) return;
    if (historySerializedRef.current !== historyCommittedSerializedRef.current) return;
    const next = historyFutureRef.current.pop();
    if (!next) return;
    historyPastRef.current = [...historyPastRef.current, historyCommittedRef.current].slice(-STUDIO_HISTORY_LIMIT);
    applyHistorySnapshot(next, 'Redid last change');
  }, [applyHistorySnapshot]);

  useEffect(() => {
    const applying = historyApplyingSerializedRef.current;
    if (applying !== null) {
      if (historySerialized === applying) {
        historyCommittedRef.current = historySnapshot;
        historyCommittedSerializedRef.current = historySerialized;
        historyApplyingSerializedRef.current = null;
        setHistoryStatus({
          canUndo: historyPastRef.current.length > 0,
          canRedo: historyFutureRef.current.length > 0,
        });
      }
      return;
    }

    if (historySerialized === historyCommittedSerializedRef.current) {
      setHistoryStatus({
        canUndo: historyPastRef.current.length > 0,
        canRedo: historyFutureRef.current.length > 0,
      });
      return;
    }

    historyFutureRef.current = [];
    setHistoryStatus({canUndo:true,canRedo:false});
    if (historyTimerRef.current !== null) window.clearTimeout(historyTimerRef.current);
    historyTimerRef.current = window.setTimeout(() => {
      historyTimerRef.current = null;
      commitCurrentHistory();
    }, STUDIO_HISTORY_DEBOUNCE_MS);

    return () => {
      if (historyTimerRef.current !== null) {
        window.clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, [historySerialized, historySnapshot, commitCurrentHistory]);

  useEffect(() => {
    const onHistoryKeyDown = (event:KeyboardEvent) => {
      if (event.altKey || (!event.ctrlKey && !event.metaKey)) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')) return;

      const key = event.key.toLowerCase();
      const wantsUndo = key === 'z' && !event.shiftKey;
      const wantsRedo = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey);
      if (!wantsUndo && !wantsRedo) return;

      event.preventDefault();
      if (wantsRedo) redoStudioAction();
      else undoStudioAction();
    };
    window.addEventListener('keydown', onHistoryKeyDown);
    return () => window.removeEventListener('keydown', onHistoryKeyDown);
  }, [redoStudioAction, undoStudioAction]);

  const setOpening = (value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setOpeningValue(next);
    setFaceAction(null);
    setCameraMenuOpen(false);
  };
  const setFormation = (value:number)=>{
    const next=Math.max(0,Math.min(100,value));
    setFormationValue(next);
    setFaceAction(null);
    setCameraMenuOpen(false);
  };

  const assemblyState = getTemplateAssemblyState(selectedTemplateId,{formation,opening,openingMode});
  const hasOpeningStage = assemblyState.hasOpeningStage;
  const assemblyProgress = assemblyState.progress;
  const assemblyStage = assemblyState.stage;
  const setAssemblyProgress = useCallback((value:number)=>{
    const next=templateAssemblyValuesForProgress(selectedTemplateId,value,openingMode);
    setFormation(next.formation);
    setOpening(next.opening);
  },[selectedTemplateId,openingMode,setFormation,setOpening]);

  useEffect(()=>{zoomRef.current=zoom;},[zoom]);
  useEffect(()=>{dielineZoomRef.current=dielineZoom;},[dielineZoom]);
  useEffect(()=>{viewPan3dRef.current=viewPan3d;},[viewPan3d]);
  useEffect(()=>{canvasPanRef.current=canvasPan;},[canvasPan]);

  useEffect(() => {
    const onSpaceKeyDown = (event:KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat || mediaLibraryOpen || (mode==='dieline'&&importedDieline)) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,button,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')) return;
      event.preventDefault();
      setSpacePanActive(true);
    };
    const onSpaceKeyUp = (event:KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setSpacePanActive(false);
    };
    const clearSpacePan = () => setSpacePanActive(false);

    window.addEventListener('keydown', onSpaceKeyDown);
    window.addEventListener('keyup', onSpaceKeyUp);
    window.addEventListener('blur', clearSpacePan);
    return () => {
      window.removeEventListener('keydown', onSpaceKeyDown);
      window.removeEventListener('keyup', onSpaceKeyUp);
      window.removeEventListener('blur', clearSpacePan);
    };
  }, [mode, importedDieline, mediaLibraryOpen]);

  const temporarySpacePanActive = spacePanActive && !mediaLibraryOpen && (mode==='3d' || !importedDieline);

  useEffect(() => {
    const canvas=studioCanvasRef.current;
    if(!canvas)return;

    const isBoardTarget=(target:EventTarget|null)=>{
      if(!(target instanceof Element))return false;

      // UI chrome keeps its normal gestures. Everywhere else in the
      // central workspace belongs to the active design canvas.
      return !target.closest(
        '.pro-canvas-top,.pro-canvas-control-bar,.pro-2d-side-panels,.pro-status-bar,.pro-face-action,button,input,select,textarea'
      );
    };

    const viewportRect=()=>{
      const selector=mode==='3d'?'.pro-3d-stage .carton-engine-canvas':'.pro-dieline-workspace';
      return canvas.querySelector(selector)?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
    };

    const applyAnchoredZoom=(nextZoom:number,clientX:number,clientY:number)=>{
      const rect=viewportRect();
      const point={
        x:clientX-(rect.left+rect.width/2),
        y:clientY-(rect.top+rect.height/2),
      };

      if(mode==='3d'){
        const oldZoom=zoomRef.current;
        const nextPan=panForAnchoredZoom(viewPan3dRef.current,oldZoom,nextZoom,point);
        zoomRef.current=nextZoom;
        viewPan3dRef.current=nextPan;
        setViewPan3d(nextPan);
        setZoom(nextZoom);
      }else{
        const oldZoom=dielineZoomRef.current;
        const nextPan=panForAnchoredZoom(canvasPanRef.current,oldZoom,nextZoom,point);
        dielineZoomRef.current=nextZoom;
        canvasPanRef.current=nextPan;
        setCanvasPan(nextPan);
        setDielineZoom(nextZoom);
      }
    };

    const handleWheel=(event:WheelEvent)=>{
      if(!isBoardTarget(event.target))return;

      event.preventDefault();
      event.stopPropagation();

      const current=mode==='3d'?zoomRef.current:dielineZoomRef.current;
      const next=wheelStudioZoom(current,event.deltaY,event.deltaMode,event.ctrlKey);
      applyAnchoredZoom(next,event.clientX,event.clientY);
    };

    // Safari sends trackpad pinch as GestureEvents instead of Ctrl+wheel.
    // Its scale is measured from gesturestart, so use the ratio between events.
    let lastGestureScale:number|null=null;
    const handleGestureStart=(event:Event)=>{
      if(!isBoardTarget(event.target))return;
      event.preventDefault();
      lastGestureScale=1;
    };
    const handleGestureChange=(event:Event)=>{
      if(lastGestureScale===null)return;
      event.preventDefault();
      const gesture=event as Event & {scale?:number;clientX?:number;clientY?:number};
      const scale=gesture.scale;
      if(typeof scale!=='number' || !Number.isFinite(scale) || scale<=0)return;
      const factor=scale/lastGestureScale;
      lastGestureScale=scale;
      const current=mode==='3d'?zoomRef.current:dielineZoomRef.current;
      const next=scaleStudioZoom(current,factor);
      const rect=viewportRect();
      applyAnchoredZoom(
        next,
        gesture.clientX ?? rect.left+rect.width/2,
        gesture.clientY ?? rect.top+rect.height/2,
      );
    };
    const handleGestureEnd=(event:Event)=>{
      if(lastGestureScale===null)return;
      event.preventDefault();
      lastGestureScale=null;
    };

    canvas.addEventListener('wheel',handleWheel,{passive:false,capture:true});
    canvas.addEventListener('gesturestart',handleGestureStart,{passive:false,capture:true});
    canvas.addEventListener('gesturechange',handleGestureChange,{passive:false,capture:true});
    canvas.addEventListener('gestureend',handleGestureEnd,{passive:false,capture:true});
    return ()=>{
      canvas.removeEventListener('wheel',handleWheel,{capture:true});
      canvas.removeEventListener('gesturestart',handleGestureStart,{capture:true});
      canvas.removeEventListener('gesturechange',handleGestureChange,{capture:true});
      canvas.removeEventListener('gestureend',handleGestureEnd,{capture:true});
    };
  },[mode]);

  const activeToolKey = tools.find(item => item.id === tool)?.label;
  const activeLabel = t(activeToolKey ?? 'studio.tools');
  const hasArtwork = outsideDielineLayers.length > 0 || insideDielineLayers.length > 0 || Object.keys(artworkByPanel).length > 0;
  const boxReady = Boolean(selectedTemplateId) && dimensions.width > 0 && dimensions.height > 0 && dimensions.depth > 0;
  const designReady = hasArtwork;
  const activeArea = workflowStep;
  const activeAreaConfig = studioAreas.find(area => area.id === workflowStep) ?? null;
  const boxStyle = useMemo(() => ({ '--studio-zoom': zoom / 100 }) as React.CSSProperties, [zoom]);
  const resolvedArtworkByPanel = useMemo<ArtworkByPanel>(() => {
    return { ...mappedOutsideArtwork, ...mappedInsideArtwork, ...artworkByPanel, ...mappedPanelArtwork };
  }, [artworkByPanel, mappedOutsideArtwork, mappedInsideArtwork, mappedPanelArtwork]);
  const artworkKey = (targetPanel = panel, scope = artworkScope) => scope === 'inside' ? `Interior ${targetPanel}` : targetPanel;
  const parseArtworkTarget = (target: string) => target.startsWith('Interior ')
    ? { scope: 'inside' as const, panel: target.replace('Interior ', '') }
    : { scope: 'outside' as const, panel: target };

  useEffect(() => {
    const token=++panelMapTokenRef.current;
    void rasterizePanelArtwork(
      artworkByPanel,
      dimensions,
      selectedTemplateId,
      {openingMode,splitTopHingeSide},
    ).then(next=>{
      if(panelMapTokenRef.current!==token)return;
      setMappedPanelArtwork(next);
    }).catch(()=>{
      if(panelMapTokenRef.current!==token)return;
      setMessage('Artwork preview could not update. Try replacing the image.');
    });
    return ()=>{
      if(panelMapTokenRef.current===token)panelMapTokenRef.current++;
    };
  },[artworkByPanel,dimensions,selectedTemplateId,openingMode,splitTopHingeSide]);

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => {
    if (!message || message === 'Ready') return;
    const timeout = window.setTimeout(() => {
      setMessage(current => current === message ? 'Ready' : current);
    }, 2800);
    return () => window.clearTimeout(timeout);
  }, [message]);


  useEffect(() => {
    let cancelled=false;
    void fetch('/api/media',{cache:'no-store'})
      .then(async response=>{
        if(!response.ok){
          if(response.status===401)return {assets:[] as LocalMediaAsset[]};
          throw new Error('Could not load your image library.');
        }
        return response.json() as Promise<{assets:LocalMediaAsset[]}>;
      })
      .then(({assets})=>{
        if(cancelled||!assets.length)return;
        setMediaAssets(current=>{
          const merged=new Map<string,LocalMediaAsset>();
          for(const asset of assets)merged.set(asset.id,asset);
          for(const asset of current)if(!merged.has(asset.id))merged.set(asset.id,asset);
          return [...merged.values()].sort((a,b)=>b.createdAt-a.createdAt);
        });
      })
      .catch(()=>{if(!cancelled)setMessage('Your saved image library could not be loaded.');});
    return ()=>{cancelled=true;};
  }, []);

  useEffect(() => {
    const token = ++liveMapTokenRef.current;
    const timeout = window.setTimeout(() => {
      void Promise.all([
        outsideDielineLayers.length
          ? rasterizeFullDielineLayers(
              outsideDielineLayers,
              dimensions,
              selectedTemplateId,
              '',
              {openingMode,splitTopHingeSide},
            )
          : Promise.resolve({} as ArtworkByPanel),
        insideDielineLayers.length
          ? rasterizeFullDielineLayers(
              insideDielineLayers,
              dimensions,
              selectedTemplateId,
              'Interior ',
              {openingMode,splitTopHingeSide},
            )
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
  }, [outsideDielineLayers, insideDielineLayers, dimensions, selectedTemplateId, openingMode, splitTopHingeSide]);

  useEffect(() => () => {
    for (const asset of mediaAssetsRef.current) if(asset.url.startsWith('blob:')) URL.revokeObjectURL(asset.url);
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
      setMessage(`${getPackagingTemplateCopy(template, t).name} is in the catalog, but its real geometry is not ready yet`);
      return;
    }
    const runtime=getTemplateRuntime(template.id);
    if(!runtime){
      setMessage(`${getPackagingTemplateCopy(template, t).name} does not have a registered Studio runtime yet`);
      return;
    }
    setSelectedTemplateId(template.id);
    setFamily(template.name);
    setFormation(100);
    setOpeningMode(runtime.assembly.defaultOpeningMode);
    setSplitTopHingeSide('side_a');
    setOpeningValue(0);
    if (template.defaultDimensions) setDimensions(runtime.sanitizeParameters(template.defaultDimensions));
    setMessage(`${getPackagingTemplateCopy(template, t).name} selected`);
  };

  const selectTool = (id: Tool) => {
    setTool(id);
    setInspectorOpen(true);
  };

  const goToWorkflowStep = (id:StudioArea, preferredTool?:Tool) => {
    const area=studioAreas.find(item=>item.id===id);
    if(!area)return;
    setWorkflowStep(id);
    setFaceAction(null);
    setCameraMenuOpen(false);
    setPanEnabled(false);

    if(id==='design'){
      setMode('dieline');
      setTool('artwork');
      setInspectorOpen(false);
      setDesignToolsOpen(true);
      return;
    }

    setMode('3d');
    const currentTool=tool && area.tools.includes(tool) ? tool : null;
    setTool(preferredTool ?? currentTool ?? area.defaultTool);
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
      const bounds = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
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
      setWorkflowStep('design');
      setMode('dieline');
      setMessage(`${asset.name} added to the ${artworkScope} 2D design`);
      return;
    }

    const parsed = parseArtworkTarget(targetPanel);
    const face=getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).panels.find(item=>item.label.toLowerCase()===parsed.panel.toLowerCase());
    if (!face) {
      setMessage('Could not find that box side in the 2D layout');
      return;
    }

    const bounds = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
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
    setWorkflowStep('design');
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
    setWorkflowStep('design');
    setMode('dieline');
    setMessage(`Choose artwork for ${parsed.scope === 'inside' ? 'inside ' : ''}${parsed.panel}`);

    // Open after the 2D view has committed so the modal belongs to the
    // editing context the user is about to work in, not the old 3D view.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => openMediaLibrary(targetPanel));
    });
  };

  const handleArtworkFiles = async (files: File[]) => {
    const imageFiles = files.filter(file => {
      const lower = file.name.toLowerCase();
      return ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type) || lower.endsWith('.svg');
    });
    if (imageFiles.length === 0) {
      setMessage('Use PNG, JPG, WebP or SVG artwork');
      return;
    }
    if(mediaUploadProgress?.active)return;

    setMediaLibraryOpen(true);
    setMessage(`Uploading ${imageFiles.length} image${imageFiles.length===1?'':'s'}…`);
    const uploaded: LocalMediaAsset[]=[];
    try{
      for(let index=0;index<imageFiles.length;index++){
        const file=imageFiles[index];
        setMediaUploadProgress({
          active:true,fileName:file.name,fileIndex:index+1,totalFiles:imageFiles.length,percent:0,phase:'uploading',
        });
        const dimensions=await readUploadDimensions(file);
        const asset=await uploadMediaFile(file,dimensions,(percent,phase)=>{
          setMediaUploadProgress({
            active:true,fileName:file.name,fileIndex:index+1,totalFiles:imageFiles.length,percent,phase,
          });
        });
        uploaded.push(asset);
      }

      setMediaAssets(current=>{
        const merged=new Map(current.map(asset=>[asset.id,asset]));
        for(const asset of uploaded)merged.set(asset.id,asset);
        return [...merged.values()].sort((a,b)=>b.createdAt-a.createdAt);
      });
      if(uploaded[0])setSelectedMediaAssetId(uploaded[0].id);
      setMediaLibraryTab('library');
      setMediaUploadProgress({
        active:false,
        fileName:uploaded[uploaded.length-1]?.name??'Artwork',
        fileIndex:imageFiles.length,
        totalFiles:imageFiles.length,
        percent:100,
        phase:'complete',
      });
      window.setTimeout(()=>setMediaUploadProgress(null),900);
      setMessage(`${uploaded.length} image${uploaded.length===1?'':'s'} saved to My Images`);
    }catch(error){
      setMediaUploadProgress(null);
      setMessage(error instanceof Error?error.message:'Could not upload artwork.');
    }
  };

  const handleBoardArtworkDrop = async (files: File[], point: {x:number;y:number}) => {
    const imageFiles = files.filter(file => {
      const lower = file.name.toLowerCase();
      return ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type) || lower.endsWith('.svg');
    });
    if (!imageFiles.length) {
      setMessage('Drop PNG, JPG, WebP or SVG images onto the board');
      return;
    }
    if (mediaUploadProgress?.active) return;

    const dropScope = artworkScope;
    const uploaded: LocalMediaAsset[] = [];
    setMessage(`Adding ${imageFiles.length} image${imageFiles.length===1?'':'s'} to the board…`);
    try {
      for (let index=0; index<imageFiles.length; index++) {
        const file=imageFiles[index];
        setMediaUploadProgress({active:true,fileName:file.name,fileIndex:index+1,totalFiles:imageFiles.length,percent:0,phase:'uploading'});
        const imageDimensions=await readUploadDimensions(file);
        const asset=await uploadMediaFile(file,imageDimensions,(percent,phase)=>{
          setMediaUploadProgress({active:true,fileName:file.name,fileIndex:index+1,totalFiles:imageFiles.length,percent,phase});
        });
        uploaded.push(asset);
      }

      setMediaAssets(current=>{
        const merged=new Map(current.map(asset=>[asset.id,asset]));
        for(const asset of uploaded) merged.set(asset.id,asset);
        return [...merged.values()].sort((a,b)=>b.createdAt-a.createdAt);
      });

      const bounds=getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
      const created=uploaded.map((asset,index)=>{
        const imageAspect=asset.width&&asset.height?asset.width/asset.height:1;
        const base=createFullDielineTransform(imageAspect,bounds.width/bounds.height,35,0);
        const offset=index*2;
        const layerId=typeof crypto!=='undefined'&&'randomUUID' in crypto
          ? crypto.randomUUID()
          : `layer-${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
        return {
          id:layerId,assetId:asset.id,name:asset.name,url:asset.url,aspectRatio:imageAspect,
          transform:{...base,x:Math.max(-100,Math.min(200,point.x+offset)),y:Math.max(-100,Math.min(200,point.y+offset))},
        } satisfies FullDielineArtworkLayer;
      });

      if (dropScope==='inside') {
        setInsideDielineLayers(current=>[...current,...created]);
        setSelectedInsideLayerId(created[created.length-1]?.id??null);
        setSelectedOutsideLayerId(null);
      } else {
        setOutsideDielineLayers(current=>[...current,...created]);
        setSelectedOutsideLayerId(created[created.length-1]?.id??null);
        setSelectedInsideLayerId(null);
      }
      setMediaUploadProgress({active:false,fileName:uploaded[uploaded.length-1]?.name??'Artwork',fileIndex:imageFiles.length,totalFiles:imageFiles.length,percent:100,phase:'complete'});
      window.setTimeout(()=>setMediaUploadProgress(null),900);
      setTool('artwork');
      setInspectorOpen(false);
      setMessage(`${uploaded.length} image${uploaded.length===1?'':'s'} added where you dropped ${uploaded.length===1?'it':'them'}`);
    } catch(error) {
      setMediaUploadProgress(null);
      setMessage(error instanceof Error?error.message:'Could not add dropped artwork.');
    }
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
      setWorkflowStep('design');
      setMode('dieline');
      setTool('artwork');
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
    const face = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).panels.find(item => item.label.toLowerCase() === parsed.panel.toLowerCase());
    if (!face) return null;

    const bounds = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
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

  const removeMediaAsset = async (assetId: string):Promise<{deleted:boolean;usages?:Array<{id:string;name:string}>;error?:string}> => {
    const inCurrentDesign = [...outsideDielineLayers, ...insideDielineLayers].some(layer => layer.assetId === assetId)
      || Object.values(artworkByPanel).some(artwork => artwork.assetId === assetId);
    if (inCurrentDesign) {
      return {
        deleted:false,
        usages:[{id:projectId ?? 'current-design',name:projectName || 'Current design'}],
        error:'This image is still used in the current design. Remove or replace it there before deleting it from My Images.',
      };
    }

    const asset=mediaAssetsRef.current.find(item=>item.id===assetId);
    if(!asset)return {deleted:false,error:'Image not found.'};

    if(asset.url.startsWith('/api/media/')){
      try{
        const response=await fetch(`/api/media/${encodeURIComponent(assetId)}`,{method:'DELETE'});
        const result=await response.json().catch(()=>({error:'Could not delete artwork.'})) as {error?:string;usages?:Array<{id:string;name:string}>};
        if(!response.ok){
          return {deleted:false,error:result.error||'Could not delete artwork.',usages:result.usages};
        }
      }catch(error){
        return {deleted:false,error:error instanceof Error?error.message:'Could not delete artwork.'};
      }
    }else if(asset.url.startsWith('blob:')){
      URL.revokeObjectURL(asset.url);
    }

    setMediaAssets(current => current.filter(item => item.id !== assetId));
    if(selectedMediaAssetId===assetId)setSelectedMediaAssetId(null);
    setMessage('Image deleted from My Images');
    return {deleted:true};
  };

  const updateFullDielineLayer = (scope: 'outside' | 'inside', layerId: string, transform: FullDielineTransform) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    setter(current => current.map(layer => layer.id === layerId ? { ...layer, transform } : layer));
  };

  const removeFullDielineLayer = useCallback((scope: 'outside' | 'inside', layerId: string) => {
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
  }, [selectedOutsideLayerId, selectedInsideLayerId]);

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

  const reorderFullDielineLayer = (scope: 'outside' | 'inside', layerId: string, targetId: string) => {
    const setter = scope === 'inside' ? setInsideDielineLayers : setOutsideDielineLayers;
    setter(current => {
      const from = current.findIndex(layer => layer.id === layerId);
      const to = current.findIndex(layer => layer.id === targetId);
      if (from < 0 || to < 0 || from === to) return current;
      const next = [...current];
      const [layer] = next.splice(from, 1);
      next.splice(to, 0, layer);
      return next;
    });
    setMessage('Artwork layer order updated');
  };

  useEffect(() => {
    const selectedId = artworkScope === 'inside' ? selectedInsideLayerId : selectedOutsideLayerId;
    if (mode !== 'dieline' || importedDieline || mediaLibraryOpen || !selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="dialog"]')) return;
      event.preventDefault();
      removeFullDielineLayer(artworkScope, selectedId);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [artworkScope, selectedOutsideLayerId, selectedInsideLayerId, mode, importedDieline, mediaLibraryOpen, removeFullDielineLayer]);

  const animateFold = (target: 0 | 100) => {
    if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
    const start = assemblyProgress;
    const startedAt = performance.now();
    const duration = 1500;

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setAssemblyProgress(start + (target - start) * eased);
      if (progress < 1) foldAnimationRef.current = requestAnimationFrame(frame);
      else foldAnimationRef.current = null;
    };

    foldAnimationRef.current = requestAnimationFrame(frame);
  };

  const saveDesign = useCallback(async (saveAsCopy=false, forceOverwrite=false, destinationWorkspaceProjectId?:string|null, keepOriginalOpen=false, quiet=false) => {
    // React state updates are asynchronous, so `saving` alone cannot prevent
    // two save events in the same tick from racing with the same updatedAt.
    if (saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      if(importedDieline) throw new Error('Saving imported dielines is not available yet.');
      const preview = engineRef.current?.thumbnail();
      if (!preview) throw new Error('The 3D preview is not ready yet.');
      const usedAssetIds=new Set<string>();
      for(const artwork of Object.values(artworkByPanel))if(artwork.assetId)usedAssetIds.add(artwork.assetId);
      for(const layer of [...outsideDielineLayers,...insideDielineLayers])if(layer.assetId)usedAssetIds.add(layer.assetId);
      const projectMediaAssets=mediaAssets.filter(asset=>usedAssetIds.has(asset.id));
      const state: StudioProjectState = {version:1,templateId:selectedTemplateId,dimensions,material,opening,formation,openingMode,splitTopHingeSide,legacySourceId:initial?.legacySourceId,measurementUnit,artworkByPanel,outsideArtworkLayers:outsideDielineLayers,insideArtworkLayers:insideDielineLayers,mediaAssets:projectMediaAssets,outsideColorMode,insideColorMode,outsideCustomColor,insideCustomColor};
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
      const targetName=saveAsCopy?`${projectName} copy`:projectName;
      const targetWorkspaceProjectId=destinationWorkspaceProjectId??workspaceProjectId;
      const body = JSON.stringify({name:targetName,state:await persist(state),preview,revision:saveAsCopy?undefined:projectRevision,force:forceOverwrite,workspaceProjectId:targetWorkspaceProjectId});
      if (new Blob([body]).size > 3*1024*1024) throw new Error('This design exceeds the current 3 MB save limit. Use smaller artwork images.');
      const targetProjectId=saveAsCopy?undefined:projectId;
      const response=await fetch(targetProjectId?`/api/projects/${targetProjectId}`:'/api/projects',{method:targetProjectId?'PUT':'POST',headers:{'Content-Type':'application/json'},body});
      const result=await response.json().catch(()=>({error:'The design service is unavailable. Please try again shortly.'}));
      if(!response.ok) {
        if(response.status===409) throw new Error('SAVE_CONFLICT');
        throw new Error(result.error || 'Could not save your design.');
      }
      if(saveAsCopy&&keepOriginalOpen){
        setMessage(`Copy created in another project`);
      }else{
        setProjectId(result.project.id);setProjectRevision(result.project.revision);setWorkspaceProjectId(result.project.workspace_project_id ?? targetWorkspaceProjectId);
        if(saveAsCopy){setProjectName(targetName);setFavorite(false);}
        if(saveAsCopy||!projectId) window.history.replaceState(null,'',`/studio/editor?project=${encodeURIComponent(result.project.id)}`);
      }
      setSaveFailed(false);
      setSaveConflictOpen(false);
      if(!saveAsCopy||!keepOriginalOpen){
        lastSavedFingerprintRef.current=JSON.stringify({name:targetName,state:historySerialized});
        autosaveBlockedFingerprintRef.current=null;
        setHasUnsavedChanges(false);
      }
      if(!quiet)setMessage(forceOverwrite?'Newer saved version overwritten':saveAsCopy?(keepOriginalOpen?'Copy created':'Copy saved — you are now editing the copy'):'Design saved');
      return true;
    } catch(error) {
      setSaveFailed(true);
      if(quiet)autosaveBlockedFingerprintRef.current=saveFingerprint;
      const conflict=error instanceof Error&&error.message==='SAVE_CONFLICT';
      if(conflict){
        setSaveConflictOpen(true);
        setMessage('Save conflict — a newer saved version exists');
      }else{
        setMessage(`Save failed — NOT SAVED. ${error instanceof Error?error.message:'Could not save your design.'}`);
      }
      return false;
    }
    finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [
    importedDieline, artworkByPanel, outsideDielineLayers, insideDielineLayers,
    mediaAssets, selectedTemplateId, dimensions, material, opening, openingMode, splitTopHingeSide, measurementUnit,
    outsideColorMode, insideColorMode, outsideCustomColor, insideCustomColor,
    projectName, projectRevision, projectId, workspaceProjectId, formation, initial?.legacySourceId, historySerialized, saveFingerprint,
  ]);

  useEffect(() => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const dirty = saveFingerprint !== lastSavedFingerprintRef.current;
    setHasUnsavedChanges(dirty);

    if (!projectId || !dirty || importedDieline || saving || saveConflictOpen) return;
    if (autosaveBlockedFingerprintRef.current === saveFingerprint) return;
    if (autosaveBlockedFingerprintRef.current && autosaveBlockedFingerprintRef.current !== saveFingerprint) {
      autosaveBlockedFingerprintRef.current = null;
      setSaveFailed(false);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      if (saveInFlightRef.current) return;
      void saveDesign(false,false,undefined,false,true);
    }, 2500);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [saveFingerprint, projectId, importedDieline, saving, saveConflictOpen, saveDesign]);

  useEffect(() => {
    if (!hasUnsavedChanges && !saveFailed) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    return () => window.removeEventListener('beforeunload', warnBeforeLeave);
  }, [hasUnsavedChanges, saveFailed]);

  useEffect(() => {
    if(!fileMenuOpen)return;
    const close=(event:PointerEvent)=>{if(!fileMenuRef.current?.contains(event.target as Node))setFileMenuOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setFileMenuOpen(false);};
    document.addEventListener('pointerdown',close);
    document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[fileMenuOpen]);

  const openProjectTransfer = async (mode:'move'|'copy') => {
    if(!projectId){setMessage('Save the design before organizing it into another project');return;}
    setFileMenuOpen(false);
    setProjectTransferMode(mode);
    setTransferProjectId('');
    setTransferError('');
    setTransferLoading(true);
    try{
      const response=await fetch('/api/workspace-projects',{cache:'no-store'});
      const result=await response.json().catch(()=>({projects:[]}));
      if(!response.ok)throw new Error(result.error||'Could not load your projects.');
      const options=(result.projects as Array<{id:string;name:string;isDefault:boolean;designCount:number;sceneCount:number}>).filter(project=>project.id!==workspaceProjectId);
      setProjectOptions(options);
    }catch(error){
      setProjectOptions([]);
      setTransferError(error instanceof Error?error.message:'Could not load your projects.');
    }finally{
      setTransferLoading(false);
    }
  };

  const submitProjectTransfer = async () => {
    if(!projectTransferMode||!projectId||!transferProjectId||transferBusy)return;
    setTransferBusy(true);setTransferError('');
    try{
      if(projectTransferMode==='move'){
        const saved=await saveDesign(false);
        if(!saved)throw new Error('Save the latest changes before moving this design.');
        const response=await fetch(`/api/projects/${projectId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceProjectId:transferProjectId})});
        const result=await response.json().catch(()=>({error:'Could not move this design.'}));
        if(!response.ok)throw new Error(result.error||'Could not move this design.');
        setWorkspaceProjectId(result.project.workspaceProjectId);
        setProjectTransferMode(null);
        setMessage(`Moved to ${projectOptions.find(project=>project.id===transferProjectId)?.name??'project'}`);
      }else{
        const copied=await saveDesign(true,false,transferProjectId,true);
        if(!copied)throw new Error('Could not create the copy.');
        setProjectTransferMode(null);
        setMessage(`Copy created in ${projectOptions.find(project=>project.id===transferProjectId)?.name??'project'}`);
      }
    }catch(error){
      setTransferError(error instanceof Error?error.message:'Could not complete this action.');
    }finally{
      setTransferBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if(!projectId){setMessage('Save the design before adding it to favourites');return;}
    const next=!favorite;
    try{
      const response=await fetch(`/api/projects/${projectId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorite:next})});
      const result=await response.json().catch(()=>({error:'Could not update favourite.'}));
      if(!response.ok)throw new Error(result.error||'Could not update favourite.');
      setFavorite(next);
      setMessage(next?'Added to favourites':'Removed from favourites');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not update favourite.');}
    finally{setFileMenuOpen(false);}
  };

  const shareDesign = async () => {
    if(!projectId){setMessage('Save the design before sharing it');return;}
    if(shareBusy)return;
    setShareBusy(true);setShareError('');
    try{
      const saved=await saveDesign(false);
      if(!saved)throw new Error('Save the latest changes before sharing.');
      const response=await fetch('/api/shares',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId})});
      const result=await response.json().catch(()=>({error:'Could not create share link.'}));
      if(!response.ok)throw new Error(result.error||'Could not create share link.');
      const url=new URL(result.share.path,window.location.origin).toString();
      setShareId(result.share.id);setShareUrl(url);setShareOpen(true);
      try{await navigator.clipboard.writeText(url);setMessage('Share link copied');}
      catch{setMessage('Share link ready');}
    }catch(error){
      setShareError(error instanceof Error?error.message:'Could not create share link.');
      setShareOpen(true);
    }finally{setShareBusy(false);setFileMenuOpen(false);}
  };

  const revokeShare = async () => {
    if(!shareId||shareBusy)return;
    setShareBusy(true);setShareError('');
    try{
      const response=await fetch(`/api/shares/${encodeURIComponent(shareId)}`,{method:'DELETE'});
      const result=await response.json().catch(()=>({error:'Could not disable share link.'}));
      if(!response.ok)throw new Error(result.error||'Could not disable share link.');
      setShareId('');setShareUrl('');setShareOpen(false);setMessage('Share link disabled');
    }catch(error){setShareError(error instanceof Error?error.message:'Could not disable share link.');}
    finally{setShareBusy(false);}
  };

  const deleteDesign = async () => {
    if(!projectId||deleting)return;
    setDeleting(true);
    try{
      const response=await fetch(`/api/projects/${projectId}`,{method:'DELETE'});
      const result=await response.json().catch(()=>({error:'Could not delete this design.'}));
      if(!response.ok)throw new Error(result.error||'Could not delete this design.');
      window.location.assign('/studio');
    }catch(error){
      setMessage(error instanceof Error?error.message:'Could not delete this design.');
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  useEffect(() => {
    const onSaveShortcut = (event:KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || (!event.metaKey && !event.ctrlKey)) return;
      event.preventDefault();
      if (event.repeat || saving) return;
      void saveDesign();
    };
    window.addEventListener('keydown', onSaveShortcut);
    return () => window.removeEventListener('keydown', onSaveShortcut);
  }, [saveDesign, saving]);

  const exportPng = () => {
    if (workflowStep !== 'preview' || mode !== '3d') {
      goToWorkflowStep('preview','export');
      setMessage('Preview is ready — download from the output panel');
      return;
    }
    const exported = engineRef.current?.exportPng(`3d-box-studio-${selectedTemplateId}.png`);
    setMessage(exported ? 'PNG exported from the live WebGL canvas' : 'Renderer is not ready yet');
  };

  return <><input ref={fileRef} hidden multiple type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>{ void handleArtworkFiles(Array.from(e.target.files ?? [])); e.currentTarget.value=''; }}/><input ref={dielineFileRef} hidden type="file" accept=".svg,.dxf,image/svg+xml,application/dxf,text/plain" onChange={e=>{ void handleDielineFile(e.target.files?.[0]); e.currentTarget.value=''; }}/><main className="pro-studio" style={boxStyle}>
    <header className="pro-studio-header">
      <div className="pro-project">
        <Brand />
        <span className="pro-divider" />
        <div className="pro-project-copy"><input ref={projectNameRef} aria-label={t("studio.design_name")} value={projectName} maxLength={120} onChange={event=>setProjectName(event.target.value)}/><Link href="/studio">{t("studio.your_designs")}</Link></div>
        <div className="pro-file-menu" ref={fileMenuRef}>
          <button type="button" className="pro-file-menu-trigger" aria-label={t("studio.file_actions")} title={t("studio.file_actions")} aria-expanded={fileMenuOpen} onClick={()=>setFileMenuOpen(open=>!open)}><MoreHorizontal size={18}/></button>
          {fileMenuOpen&&<div className="pro-file-menu-popover" role="menu">
            <button type="button" role="menuitem" disabled={saving} onClick={()=>{setFileMenuOpen(false);void saveDesign();}}><Download size={15}/><span><strong>{t("studio.save")}</strong><small>{t("studio.ctrl_s")}</small></span></button>
            <button type="button" role="menuitem" disabled={saving} onClick={()=>{setFileMenuOpen(false);void saveDesign(true);}}><FilePlus2 size={15}/><span><strong>{t("studio.save_a_copy")}</strong><small>{t("studio.create_an_independent_design")}</small></span></button>
            <button type="button" role="menuitem" disabled={!projectId||saving} onClick={()=>void openProjectTransfer('move')}><Move size={15}/><span><strong>{t("studio.move_to_project")}</strong><small>{t("studio.keep_this_design_change_its_project")}</small></span></button>
            <button type="button" role="menuitem" disabled={!projectId||saving} onClick={()=>void openProjectTransfer('copy')}><Copy size={15}/><span><strong>{t("studio.copy_to_project")}</strong><small>{t("studio.create_an_independent_copy_elsewhere")}</small></span></button>
            <button type="button" role="menuitem" disabled={!projectId||saving||shareBusy} onClick={()=>void shareDesign()}><Share2 size={15}/><span><strong>{t("studio.share_link")}</strong><small>{projectId?t("studio.create_a_view_only_review_link"):t("studio.save_this_design_first")}</small></span></button>
            <button type="button" role="menuitem" disabled={!projectId} onClick={()=>void toggleFavorite()}><Star size={15} fill={favorite?'currentColor':'none'}/><span><strong>{favorite?t("studio.remove_from_favourites"):t("studio.add_to_favourites")}</strong><small>{projectId?t("studio.keep_important_files_handy"):t("studio.save_this_design_first")}</small></span></button>
            <button type="button" role="menuitem" onClick={()=>{setFileMenuOpen(false);window.requestAnimationFrame(()=>{projectNameRef.current?.focus();projectNameRef.current?.select();});}}><Pencil size={15}/><span><strong>{t("studio.rename")}</strong><small>{t("studio.edit_the_file_name")}</small></span></button>
            <span className="pro-file-menu-separator" aria-hidden="true"/>
            <button type="button" role="menuitem" className="is-danger" disabled={!projectId} onClick={()=>{setFileMenuOpen(false);setDeleteModalOpen(true);}}><Trash2 size={18}/><span><strong>{t("studio.delete")}</strong><small>{projectId?t("studio.permanently_delete_this_design"):t("studio.nothing_saved_yet")}</small></span></button>
          </div>}
        </div>
      </div>
      <div className="pro-header-actions">
        <div className="pro-header-history" role="group" aria-label={t("studio.edit_history")}>
          <button type="button" className="pro-header-icon-action" disabled={!historyStatus.canUndo} onClick={undoStudioAction} aria-label={t("studio.undo")} title={t("studio.undo_ctrl_z")}><Undo2 size={17}/></button>
          <button type="button" className="pro-header-icon-action" disabled={!historyStatus.canRedo} onClick={redoStudioAction} aria-label={t("studio.redo")} title={t("studio.redo_ctrl_shift_z")}><Redo2 size={17}/></button>
        </div>
        <button className={`pro-secondary pro-save-design${saveFailed?' is-save-failed':hasUnsavedChanges?' is-unsaved':' is-saved'}`} disabled={saving} title={projectId?t("studio.autosave_is_on_click_to_save_now"):t("studio.save_this_design")} onClick={()=>void saveDesign()}>{saving?t("studio.saving"):saveFailed?t("studio.not_saved_retry"):!projectId?t("studio.save"):hasUnsavedChanges?t("studio.unsaved_changes"):t("studio.saved_2")}</button>
        <button className="pro-secondary pro-header-share" disabled={shareBusy} title={t("studio.share_this_design")} onClick={()=>void shareDesign()}><Share2 size={16}/><span>{t("studio.share")}</span></button>
        <AccountButton compact className="pro-secondary" />
      </div>
    </header>

    <div className={`pro-workflow-row is-${workflowStep}`}>
      <nav className="pro-workflow-nav" aria-label={t("studio.box_design_workflow")}>
        {studioAreas.map((area,index)=>{
          const Icon=area.icon;
          const ready=area.id==='box'?boxReady:area.id==='design'?designReady:false;
          return <button
            key={area.id}
            type="button"
            className={`pro-workflow-step${workflowStep===area.id?' is-active':''}`}
            aria-current={workflowStep===area.id?'step':undefined}
            onClick={()=>goToWorkflowStep(area.id)}
            title={t(area.helper)}
          >
            <span className="pro-workflow-step-number">{index+1}</span>
            <span className="pro-workflow-step-icon"><Icon size={20}/>{ready&&<i><Check size={10}/></i>}</span>
            <span className="pro-workflow-step-copy"><b>{t(area.label)}</b><small>{t(area.helper)}</small></span>
          </button>;
        })}
      </nav>
      {mode === '3d' && <div className="pro-camera-menu pro-workflow-camera" ref={cameraMenuRef}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-label={t("studio.camera_angle")}
          title={t("studio.choose_camera_angle")}
          aria-expanded={cameraMenuOpen}
          onClick={() => setCameraMenuOpen(open => !open)}
        >
          <Camera size={16} />
          <span>{t("studio.camera_angle_2")}</span>
          <small>{camera==='LegacyPerspective'?t("studio.perspective"):camera}</small>
          <ChevronDown size={14} className={cameraMenuOpen ? 'is-open' : ''} />
        </button>
        {cameraMenuOpen && <div className="pro-camera-popover pro-camera-angle-grid" role="menu" aria-label={t("studio.camera_angles")}>
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

    <div className="pro-studio-body">
      <nav className={`pro-studio-tool-rail is-${workflowStep}`} aria-label={t('studio.area_tools', { area: t(activeAreaConfig?.label ?? 'studio.studio') })}>
        {workflowStep==='box' && <>
          <button type="button" className={tool==='structure'&&inspectorOpen?'is-active':''} onClick={()=>selectTool('structure')}><Box size={22}/><span>{t("studio.box_size")}</span></button>
          <button type="button" className={tool==='material'&&inspectorOpen?'is-active':''} onClick={()=>selectTool('material')}><Layers3 size={22}/><span>{t("studio.material_finish")}</span></button>
        </>}
        {workflowStep==='design' && <>
          <button type="button" className={artworkScope==='outside'&&designToolsOpen?'is-active':''} onClick={()=>{setArtworkScope('outside');setTool('artwork');setDesignToolsOpen(true);}}><ImageIcon size={22}/><span>{t("studio.outside")}</span></button>
          <button type="button" className={artworkScope==='inside'&&designToolsOpen?'is-active':''} onClick={()=>{setArtworkScope('inside');setTool('artwork');setDesignToolsOpen(true);}}><ImageIcon size={22}/><span>{t("studio.inside")}</span></button>
          <button type="button" className={designToolsOpen?'is-active':''} onClick={()=>{setTool('artwork');setDesignToolsOpen(true);}}><Upload size={22}/><span>{t("studio.images")}</span></button>
        </>}
        {workflowStep==='preview' && <>
          <button type="button" className={tool==='opening'&&inspectorOpen?'is-active':''} onClick={()=>selectTool('opening')}><PackageOpen size={22}/><span>{t("studio.open_close")}</span></button>
          <button type="button" className={tool==='scene'&&inspectorOpen?'is-active':''} onClick={()=>selectTool('scene')}><Lightbulb size={22}/><span>{t("studio.scene")}</span></button>
          <button type="button" className={tool==='export'&&inspectorOpen?'is-active':''} onClick={()=>selectTool('export')}><Download size={22}/><span>{t("studio.download")}</span></button>
        </>}
      </nav>
      <section ref={studioCanvasRef} className={`pro-canvas${mode === 'dieline' ? ' is-2d-mode' : ''} is-workflow-${workflowStep}`} aria-label={workflowStep==='design'?t("studio.packaging_design_workspace"):workflowStep==='box'?t("studio.box_setup_workspace"):t("studio.3d_preview_and_download_workspace")}>

        <div className={`pro-3d-stage pro-view-pane${mode === '3d' ? ' is-active' : ''}`} inert={mode !== '3d'} aria-hidden={mode !== '3d'}>
          <div className="pro-grid-floor" />
          <div className="pro-stage-badge"><span/>{" " + t("studio.drag_to_rotate")}</div>
          <CartonEngine
            ref={engineRef}
            dimensions={dimensions}
            templateId={selectedTemplateId}
            opening={opening}
            formation={formation}
            openingMode={openingMode}
            splitTopHingeSide={splitTopHingeSide}
            material={material}
            outsideColor={outsideColorMode === 'custom' ? outsideCustomColor : null}
            insideColor={insideColorMode === 'custom' ? insideCustomColor : null}
            artworkByPanel={resolvedArtworkByPanel}
            cameraPreset={camera}
            zoom={zoom}
            viewPan={viewPan3d}
            panEnabled={mode==='3d' && (panEnabled || temporarySpacePanActive)}
            onViewPanChange={pan=>{viewPan3dRef.current=pan;setViewPan3d(pan);}}
            onPanelSelect={(selectedPanel, point) => {
              const parsed = parseArtworkTarget(selectedPanel);
              setArtworkScope(parsed.scope);
              setPanel(parsed.panel);
              setFaceAction({ panel: selectedPanel, x: point.x, y: point.y });
              setMessage(`${parsed.scope === 'inside' ? 'Inside ' : ''}${parsed.panel} selected`);
            }}
          />
          <div className="pro-stage-meta"><span>{family}</span><span>{material}</span><span>{assemblyStage} · {Math.round(assemblyProgress)}%</span></div>

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
                setWorkflowStep('design');
                setMode('dieline');
                setPanEnabled(false);
                setFaceAction(null);
                setMessage(`Adjust ${parsed.panel} artwork freely across the 2D board`);
              }}>
                <ImageIcon size={13} />{t("studio.edit_adjust_image")}</button>
              <button onClick={() => openPanelMediaFrom3D(faceAction.panel)}>
                <Upload size={13} />{t("studio.replace_artwork")}</button>
            </> : <button onClick={() => openPanelMediaFrom3D(faceAction.panel)}>
              <Upload size={13} />{t("studio.add_artwork")}</button>}
            {artworkByPanel[faceAction.panel] && <button
              className="pro-face-action-remove"
              onClick={() => removeArtwork(faceAction.panel)}
            >
              <Trash2 size={13} />{" " + t("studio.remove_artwork")}</button>}
            <button className="pro-face-action-close" aria-label={t("studio.dismiss_face_action")} onClick={() => setFaceAction(null)}><X size={12}/></button>
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
          onReorderLayer={(layerId, targetId) => reorderFullDielineLayer(artworkScope, layerId, targetId)}
          artworkScope={artworkScope}
          selectedPanel={panel}
          mediaAssets={mediaAssets}
          onPanelSelect={(name)=>{setPanEnabled(false);setPanel(name);setTool('artwork');setInspectorOpen(false);setSelectedOutsideLayerId(null);setSelectedInsideLayerId(null);}}
          onUpdatePanelArtwork={(key,transform)=>setArtworkByPanel(current=>current[key]?{...current,[key]:{...current[key],transform}}:current)}
          onArtworkScopeChange={setArtworkScope}
          dimensions={dimensions}
          measurementUnit={measurementUnit}
          selectedTemplateId={selectedTemplateId}
          openingMode={openingMode}
          splitTopHingeSide={splitTopHingeSide}
          zoom={dielineZoom}
          onZoomChange={setDielineZoom}
          panEnabled={panEnabled || temporarySpacePanActive}
          canvasPan={canvasPan}
          setCanvasPan={setCanvasPan}
          onChooseFullLayout={() => openMediaLibrary('__FULL_DIELINE__')}
          onDropArtworkFiles={handleBoardArtworkDrop}
          toolsOpen={designToolsOpen}
          onCloseTools={()=>setDesignToolsOpen(false)}
          onApplyChanges={() => {
            goToWorkflowStep('preview','opening');
            setFaceAction(null);
            setPanEnabled(false);
            setMessage('Artwork changes applied — reviewing in 3D');
          }}
          livePreview={
          <aside className={`pro-artwork-live-preview${previewOpen?' is-open':''}`} aria-label={t("studio.live_3d_artwork_preview")}>
            <button type="button" onClick={()=>setPreviewOpen(open=>!open)} aria-expanded={previewOpen}><Boxes size={15}/>{" " + t("studio.live_3d") + " "}<ChevronDown size={14}/></button>
            {previewOpen && mode === 'dieline' && <>
              <div className="pro-artwork-preview-canvas"><CartonEngine dimensions={dimensions} templateId={selectedTemplateId} opening={opening} formation={formation} openingMode={openingMode} splitTopHingeSide={splitTopHingeSide} material={material} outsideColor={outsideColorMode==='custom'?outsideCustomColor:null} insideColor={insideColorMode==='custom'?insideCustomColor:null} artworkByPanel={resolvedArtworkByPanel} cameraPreset="Perspective" zoom={80} onPanelSelect={(name)=>{const parsed=parseArtworkTarget(name);setArtworkScope(parsed.scope);setPanel(parsed.panel);setSelectedOutsideLayerId(null);setSelectedInsideLayerId(null);}}/></div>
              <div className="pro-artwork-preview-fold">
                <div className="pro-artwork-preview-fold-head"><span>{t("studio.assembly")}</span><strong>{Math.round(assemblyProgress)}%</strong></div>
                <div className="pro-artwork-preview-fold-row">
                  <span>{t("studio.flat")}</span>
                  <input type="range" min="0" max="100" step="1" value={Math.round(assemblyProgress)} aria-label={t("studio.assemble_or_flatten_box_in_3d_preview")} onChange={e=>{if(foldAnimationRef.current!==null)cancelAnimationFrame(foldAnimationRef.current);foldAnimationRef.current=null;setAssemblyProgress(Number(e.target.value));}}/>
                  <span>{t("studio.closed")}</span>
                </div>
              </div>
            </>}
          </aside>
          }
          viewSwitch={null}
          pdfExportRequest={pdfExportRequest}
          onClearImportedDieline={() => { setImportedDieline(null); setDielineMapping(null); setMessage('Imported dieline cleared'); }}
        />

        </div>
          <div className={`pro-canvas-control-bar pro-shared-canvas-control-bar${mode==='dieline'?' is-2d':''}`} aria-label={t("studio.canvas_controls")}>
            <button className="pro-canvas-bar-icon" title={t("studio.undo_ctrl_z_2")} aria-label={t("studio.undo_last_change")} disabled={!historyStatus.canUndo} onClick={undoStudioAction}><Undo2 size={18}/></button>
            <button className="pro-canvas-bar-icon" title={t("studio.redo_ctrl_shift_z_2")} aria-label={t("studio.redo_last_change")} disabled={!historyStatus.canRedo} onClick={redoStudioAction}><Redo2 size={18}/></button>
            <span className="pro-canvas-bar-divider" aria-hidden="true"/>
            <button className={`pro-canvas-bar-icon${(panEnabled || temporarySpacePanActive) ? ' is-active' : ''}`} title={mode==='3d'?t("studio.pan_3d_view_hold_space_for_temporary_hand_tool"):t("studio.drag_2d_board_hold_space_for_temporary_hand_tool")} aria-label={mode==='3d'?t("studio.pan_3d_view"):t("studio.drag_2d_board")} aria-pressed={panEnabled || temporarySpacePanActive} disabled={mode==='dieline' && !!importedDieline} onClick={() => setPanEnabled(enabled => !enabled)}><Move size={18}/></button>
            <button className="pro-canvas-bar-icon" title={t("studio.zoom_out")} aria-label={t("studio.zoom_out")} onClick={() => mode === '3d' ? setZoom(value => scaleStudioZoom(value, 1 / 1.1)) : setDielineZoom(value => scaleStudioZoom(value, 1 / 1.1))}>
              <ZoomOut size={20}/>
            </button>
            <button className="pro-canvas-bar-icon" title={t("studio.zoom_in")} aria-label={t("studio.zoom_in")} onClick={() => mode === '3d' ? setZoom(value => scaleStudioZoom(value, 1.1)) : setDielineZoom(value => scaleStudioZoom(value, 1.1))}>
              <ZoomIn size={20}/>
            </button>
            {mode === 'dieline' && <>
              <span className="pro-2d-zoom-value" aria-live="polite">{Number(dielineZoom.toFixed(1))}%</span>
              <span className="pro-canvas-bar-divider" />
            </>}
            {mode === '3d' && <>
              <span className="pro-canvas-bar-divider" />
              <button
                className="pro-canvas-bar-play"
                aria-label={assemblyProgress>=50?t("studio.flatten_box"):t("studio.assemble_and_close_box")}
                title={assemblyProgress>=50?t("studio.flatten_box"):t("studio.assemble_and_close_box")}
                onClick={() => animateFold(assemblyProgress >= 50 ? 0 : 100)}
              >
                {assemblyProgress>=50?<Grid3X3 size={19}/>:<Box size={19}/>}
              </button>
              <span className="pro-canvas-bar-label">{t("studio.flat")}</span>
              <input
                className="pro-canvas-bar-range"
                type="range"
                min="0"
                max="100"
                step="1"
                value={Math.round(assemblyProgress)}
                aria-label={t("studio.assemble_or_flatten_box")}
                onChange={e => {
                  if (foldAnimationRef.current !== null) cancelAnimationFrame(foldAnimationRef.current);
                  foldAnimationRef.current = null;
                  setAssemblyProgress(Number(e.target.value));
                }}
              />
              <span className="pro-canvas-bar-label">{t("studio.closed")}</span>
              <span className="pro-canvas-bar-divider" />
            </>}
            <button
              className="pro-canvas-bar-icon"
              title={t("studio.fit_view")}
              aria-label={t("studio.fit_view")}
              onClick={() => {
                if (mode === '3d') {
                  zoomRef.current=82;
                  viewPan3dRef.current={x:0,y:0};
                  setZoom(82);
                  setViewPan3d({x:0,y:0});
                  engineRef.current?.resetCamera();
                } else {
                  dielineZoomRef.current=100;
                  canvasPanRef.current={x:0,y:0};
                  setDielineZoom(100);
                  setCanvasPan({ x: 0, y: 0 });
                }
              }}
            >
              <Maximize2 size={20}/>
            </button>
          </div>


        <button className="pro-mobile-inspector" onClick={() => { if(workflowStep==='design'){setDesignToolsOpen(true);return;} if (tool) setInspectorOpen(true); }} disabled={!tool}><Sparkles size={14} /> {workflowStep==='box'?t("studio.box_settings"):workflowStep==='preview'?t("studio.preview_settings"):t("studio.design_tools")}</button>
        {message !== 'Ready' && <div className={`pro-studio-toast${saveFailed?' is-error':''}`} role="status" aria-live="polite"><span className="pro-status-dot" /> <span>{message}</span></div>}
        <div className={`pro-status-bar${saveFailed?' is-save-failed':''}`}><span><span className="pro-status-dot" /> {message}</span><span title={t("studio.finished_size_width_height_depth")}>{family}{" " + t("studio.w") + " "}{formatDimension(dimensions.width, measurementUnit)}{" " + t("studio.h") + " "}{formatDimension(dimensions.height, measurementUnit)}{" " + t("studio.d") + " "}{formatDimension(dimensions.depth, measurementUnit)} {measurementUnit}</span></div>
      </section>

      <aside className={`pro-inspector is-workflow-${workflowStep} ${inspectorOpen ? 'is-open' : ''}`}>
        <div className="pro-inspector-title"><div><span>{t(activeAreaConfig?.label ?? 'studio.inspector')}</span><h2>{activeLabel}</h2></div><button
  className="pro-inspector-close"
  aria-label={t("studio.close_tool_panel")}
  title={t("studio.close")}
  onClick={() => {
    setInspectorOpen(false);
    setTool(null);
  }}
><X size={18} /></button></div>
        {tool && <Inspector tool={tool} family={family} setFamily={setFamily} selectedTemplateId={selectedTemplateId} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch} templateCategory={templateCategory} setTemplateCategory={setTemplateCategory} onChooseTemplate={chooseTemplate} onPreviewTemplate={setTemplatePreview} onImportDieline={() => dielineFileRef.current?.click()} importedDieline={importedDieline} panel={panel} setPanel={setPanel} artworkScope={artworkScope} setArtworkScope={setArtworkScope} material={material} setMaterial={setMaterial} outsideColorMode={outsideColorMode} setOutsideColorMode={setOutsideColorMode} insideColorMode={insideColorMode} setInsideColorMode={setInsideColorMode} outsideCustomColor={outsideCustomColor} setOutsideCustomColor={setOutsideCustomColor} insideCustomColor={insideCustomColor} setInsideCustomColor={setInsideCustomColor} opening={opening} setOpening={setOpening} formation={formation} setFormation={setFormation} assemblyProgress={assemblyProgress} setAssemblyProgress={setAssemblyProgress} assemblyStage={assemblyStage} hasOpeningStage={hasOpeningStage} openingMode={openingMode} setOpeningMode={setOpeningMode} splitTopHingeSide={splitTopHingeSide} setSplitTopHingeSide={setSplitTopHingeSide} dimensions={dimensions} setDimensions={setDimensions} measurementUnit={measurementUnit} setMeasurementUnit={setMeasurementUnit} artworkByPanel={artworkByPanel} setArtworkByPanel={setArtworkByPanel} mediaAssets={mediaAssets} onOpenMediaLibrary={openMediaLibrary} onRemoveArtwork={removeArtwork} onExport={exportPng} onShare={shareDesign} shareBusy={shareBusy} canShare={Boolean(projectId)} onExportPdf={()=>{if(importedDieline){setMessage('PDF export for imported SVG/DXF dielines is not available yet.');return;}setPdfExportRequest(value=>value+1);setMessage(`Preparing ${artworkScope} 2D layout for PDF…`);}} onAnimateFold={animateFold} setMessage={setMessage} />}
      </aside>
    </div>

    {templatePreview && <div className="pro-template-preview-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setTemplatePreview(null);}}>
      <section className="pro-template-preview-modal" role="dialog" aria-modal="true" aria-labelledby="template-preview-title">
        <header>
          <div><span>{t("studio.packaging_template")}</span><h2 id="template-preview-title">{getPackagingTemplateCopy(templatePreview, t).name}</h2><p>{getPackagingTemplateCopy(templatePreview, t).category}</p></div>
          <button type="button" aria-label={t("studio.close_template_preview")} onClick={()=>setTemplatePreview(null)}><X size={20}/></button>
        </header>
        <div className="pro-template-preview-body">
          <div className="pro-template-preview-art"><TemplateVisual template={templatePreview}/></div>
          <div className="pro-template-preview-details">
            <span>{t("studio.structure_preview")}</span>
            <strong>{getPackagingTemplateCopy(templatePreview, t).shortName}</strong>
            <p>{t("studio.review_the_structure_before_replacing_the_current_box_template")}</p>
            {templatePreview.defaultDimensions && <dl>
              <div><dt>{t("studio.width")}</dt><dd>{formatDimension(templatePreview.defaultDimensions.width,measurementUnit)} {measurementUnit}</dd></div>
              <div><dt>{t("studio.height")}</dt><dd>{formatDimension(templatePreview.defaultDimensions.height,measurementUnit)} {measurementUnit}</dd></div>
              <div><dt>{t("studio.depth")}</dt><dd>{formatDimension(templatePreview.defaultDimensions.depth,measurementUnit)} {measurementUnit}</dd></div>
            </dl>}
          </div>
        </div>
        <footer>
          <button type="button" className="pro-secondary-button" onClick={()=>setTemplatePreview(null)}>{t("studio.cancel")}</button>
          <button type="button" className="pro-primary" disabled={templatePreview.status!=='ready'} onClick={()=>{chooseTemplate(templatePreview);setTemplatePreview(null);}}>
            {templatePreview.status==='ready'?t("studio.use_this_template"):t("studio.coming_soon")}
          </button>
        </footer>
      </section>
    </div>}

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
      onUpload={() => { if(!mediaUploadProgress?.active) fileRef.current?.click(); }}
      uploadProgress={mediaUploadProgress}
      onDropFiles={handleArtworkFiles}
      onUse={(asset, options) => applyAssetToPanel(asset, mediaTargetPanel, options)}
      onDelete={removeMediaAsset}
      onClose={() => setMediaLibraryOpen(false)}
    />}

    {shareOpen && <div className="pro-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!shareBusy)setShareOpen(false);}}>
      <section className="pro-confirm-modal pro-share-modal" role="dialog" aria-modal="true" aria-labelledby="share-design-title">
        <div className="pro-confirm-copy">
          <span>{t("studio.share_design")}</span>
          <h2 id="share-design-title">{shareUrl?t("studio.interactive_review_link"):t("studio.could_not_create_link")}</h2>
          <p>{shareUrl?t("studio.anyone_with_this_link_can_view_and_rotate_the_shared_design_they_cannot_edi"):t("studio.the_share_link_was_not_created")}</p>
        </div>
        {shareUrl&&<div className="pro-share-link-row"><input readOnly value={shareUrl} aria-label={t("studio.share_link_2")}/><button type="button" className="pro-secondary-button" onClick={()=>void navigator.clipboard.writeText(shareUrl)}>{t("studio.copy")}</button></div>}
        {shareError&&<p className="pro-transfer-error" role="alert">{shareError}</p>}
        <div className="pro-confirm-actions">
          {shareUrl&&<button type="button" className="pro-secondary-button is-danger-text" disabled={shareBusy} onClick={()=>void revokeShare()}>{t("studio.disable_link")}</button>}
          <button type="button" className="pro-primary" disabled={shareBusy} onClick={()=>setShareOpen(false)}>{t("studio.done")}</button>
        </div>
      </section>
    </div>}
    {projectTransferMode && <div className="pro-confirm-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!transferBusy)setProjectTransferMode(null);}}>
      <section className="pro-confirm-modal pro-project-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="organize-design-title">
        <div className="pro-confirm-copy">
          <span>{t("studio.organize_design")}</span>
          <h2 id="organize-design-title">{projectTransferMode==='move'?t("studio.move_to_project_2"):t("studio.copy_to_project_2")}</h2>
          <p>{projectTransferMode==='move'
            ? t("studio.move_this_same_design_to_another_project_its_design_id_and_revision_history")
            : t("studio.create_a_new_independent_copy_in_another_project_the_original_stays_where_i")}</p>
        </div>
        <div className="pro-transfer-mode" role="radiogroup" aria-label={t("studio.transfer_type")}>
          <button type="button" role="radio" aria-checked={projectTransferMode==='move'} className={projectTransferMode==='move'?'is-active':''} disabled={transferBusy} onClick={()=>setProjectTransferMode('move')}><Move size={16}/><span><strong>{t("studio.move")}</strong><small>{t("studio.same_design")}</small></span></button>
          <button type="button" role="radio" aria-checked={projectTransferMode==='copy'} className={projectTransferMode==='copy'?'is-active':''} disabled={transferBusy} onClick={()=>setProjectTransferMode('copy')}><Copy size={16}/><span><strong>{t("studio.copy")}</strong><small>{t("studio.new_independent_design")}</small></span></button>
        </div>
        <div className="pro-transfer-destination">
          <label>{t("studio.destination_project")}</label>
          {transferLoading?<div className="pro-transfer-loading"><span/><span/><span/></div>:projectOptions.length?<div className="pro-transfer-project-list" role="radiogroup" aria-label={t("studio.destination_project")}>
            {projectOptions.map(project=><button key={project.id} type="button" role="radio" aria-checked={transferProjectId===project.id} className={transferProjectId===project.id?'is-selected':''} disabled={transferBusy} onClick={()=>setTransferProjectId(project.id)}>
              <span className="pro-transfer-project-icon"><Layers3 size={17}/></span>
              <span className="pro-transfer-project-copy"><strong>{project.name}</strong><small>{project.designCount}{" " + t("studio.design")}{project.designCount===1?'':t("studio.s")} · {project.sceneCount}{" " + t("studio.scene_2")}{project.sceneCount===1?'':t("studio.s")}</small></span>
              {transferProjectId===project.id&&<Check size={17}/>}
            </button>)}
          </div>:<div className="pro-transfer-empty"><strong>{t("studio.no_other_projects_yet")}</strong><p>{t("studio.create_another_project_before_moving_or_copying_this_design")}</p><Link href="/studio">{t("studio.go_to_projects")}</Link></div>}
        </div>
        {transferProjectId&&<div className="pro-transfer-summary">
          {projectTransferMode==='move'
            ? <><strong>{projectName}</strong><span>{t("studio.will_move_to") + " "}{projectOptions.find(project=>project.id===transferProjectId)?.name}{t("studio.the_same_design_remains_open")}</span></>
            : <><strong>{projectName}{" " + t("studio.copy_2")}</strong><span>{t("studio.will_be_created_in") + " "}{projectOptions.find(project=>project.id===transferProjectId)?.name}{t("studio.you_will_keep_editing_the_original")}</span></>}
        </div>}
        {transferError&&<p className="pro-transfer-error" role="alert">{transferError}</p>}
        <div className="pro-confirm-actions">
          <button type="button" className="pro-secondary-button" disabled={transferBusy} onClick={()=>setProjectTransferMode(null)}>{t("studio.cancel")}</button>
          <button type="button" className="pro-primary" disabled={transferBusy||transferLoading||!transferProjectId} onClick={()=>void submitProjectTransfer()}>
            {transferBusy?(projectTransferMode==='move'?'Moving…':'Copying…'):(projectTransferMode==='move'?'Move design':'Copy design')}
          </button>
        </div>
      </section>
    </div>}
    {saveConflictOpen && <div className="pro-confirm-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!saving)setSaveConflictOpen(false);}}>
      <section className="pro-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="overwrite-design-title" aria-describedby="overwrite-design-copy">
        <div className="pro-confirm-icon is-warning"><RotateCcw size={22}/></div>
        <div className="pro-confirm-copy">
          <span>{t("studio.save_conflict")}</span>
          <h2 id="overwrite-design-title">{t("studio.overwrite_the_newer_saved_version")}</h2>
          <p id="overwrite-design-copy">{t("studio.this_design_has_changed_since_you_opened_it_overwriting_will_replace_the_ne")}</p>
        </div>
        <div className="pro-confirm-actions">
          <button type="button" className="pro-secondary-button" disabled={saving} onClick={()=>setSaveConflictOpen(false)}>{t("studio.cancel")}</button>
          <button type="button" className="pro-danger-button" disabled={saving} onClick={()=>{setSaveConflictOpen(false);void saveDesign(false,true);}}>{saving?t("studio.overwriting"):t("studio.overwrite_saved_version")}</button>
        </div>
      </section>
    </div>}
    {deleteModalOpen && <div className="pro-confirm-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget&&!deleting)setDeleteModalOpen(false);}}>
      <section className="pro-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-design-title" aria-describedby="delete-design-copy">
        <div className="pro-confirm-icon is-danger"><Trash2 size={22}/></div>
        <div className="pro-confirm-copy">
          <span>{t("studio.delete_design")}</span>
          <h2 id="delete-design-title">{t("studio.delete_2")}{projectName}”?</h2>
          <p id="delete-design-copy">{t("studio.this_design_will_be_permanently_deleted_from_your_workspace_this_action_can")}</p>
        </div>
        <div className="pro-confirm-actions">
          <button type="button" className="pro-secondary-button" disabled={deleting} onClick={()=>setDeleteModalOpen(false)}>{t("studio.cancel")}</button>
          <button type="button" className="pro-danger-button" disabled={deleting} onClick={()=>void deleteDesign()}>{deleting?t("studio.deleting"):t("studio.delete_design")}</button>
        </div>
      </section>
    </div>}
  </main></>;
}

function Inspector(props: {
  tool: Tool; family: string; setFamily: (v:string)=>void;
  selectedTemplateId:string; templateSearch:string; setTemplateSearch:(v:string)=>void; templateCategory:string; setTemplateCategory:(v:string)=>void; onChooseTemplate:(template:PackagingTemplateDefinition)=>void; onPreviewTemplate:(template:PackagingTemplateDefinition)=>void; onImportDieline:()=>void; importedDieline:ParsedDieline|null;
  panel:string; setPanel:(v:string)=>void;
  artworkScope:'outside'|'inside'; setArtworkScope:(v:'outside'|'inside')=>void;
  material:string; setMaterial:(v:string)=>void;
  outsideColorMode:BaseColorMode; setOutsideColorMode:(v:BaseColorMode)=>void;
  insideColorMode:BaseColorMode; setInsideColorMode:(v:BaseColorMode)=>void;
  outsideCustomColor:string; setOutsideCustomColor:(v:string)=>void;
  insideCustomColor:string; setInsideCustomColor:(v:string)=>void;
  opening:number; setOpening:(v:number)=>void;
  formation:number; setFormation:(v:number)=>void;
  assemblyProgress:number; setAssemblyProgress:(v:number)=>void; assemblyStage:string; hasOpeningStage:boolean;
  openingMode:LegacyOpeningMode; setOpeningMode:(v:LegacyOpeningMode)=>void;
  splitTopHingeSide:'side_a'|'side_b'; setSplitTopHingeSide:(v:'side_a'|'side_b')=>void;
  dimensions:CartonDimensions; setDimensions:(v:CartonDimensions)=>void;
  measurementUnit:MeasurementUnit; setMeasurementUnit:(unit:MeasurementUnit)=>void;
  artworkByPanel:ArtworkByPanel; setArtworkByPanel:React.Dispatch<React.SetStateAction<ArtworkByPanel>>;
  mediaAssets: LocalMediaAsset[];
  onOpenMediaLibrary:(panel?:string,tab?:'library'|'upload')=>void; onRemoveArtwork:(panel:string)=>void;
  onExport:()=>void; onShare:()=>void; shareBusy:boolean; canShare:boolean; onExportPdf:()=>void; onAnimateFold:(target:0|100)=>void; setMessage:(v:string)=>void;
}) {
  const t = useTranslations();

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
      <PanelIntro title={t("studio.choose_your_box")} text={t("studio.pick_the_packaging_style_then_set_the_finished_size_of_the_box")} />

      <div className="pro-structure-current">
        <span>{t("studio.current_box")}</span>
        <div>
          <TemplateVisual template={selectedTemplate} dimensions={props.dimensions} compact />
          <div>
            <strong>{getPackagingTemplateCopy(selectedTemplate, t).name}</strong>
            <small>{getPackagingTemplateCopy(selectedTemplate, t).category}{" " + t("studio.ready_to_edit")}</small>
            <div className="pro-current-box-size">
              <div className="pro-current-box-size-head">
                <span>{t("studio.finished_size")}</span>
                <div className="pro-unit-switch" role="group" aria-label={t("studio.measurement_unit")}>
                  <button type="button" className={props.measurementUnit === 'mm' ? 'is-active' : ''} onClick={()=>props.setMeasurementUnit('mm')}>{t("studio.mm")}</button>
                  <button type="button" className={props.measurementUnit === 'in' ? 'is-active' : ''} onClick={()=>props.setMeasurementUnit('in')}>{t("studio.in")}</button>
                </div>
              </div>
              <div className="pro-current-box-size-fields" aria-label={t("studio.finished_box_size")}>
                <label><small>{t("studio.w_2")}</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.width,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,width:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <i>×</i>
                <label><small>{t("studio.h_2")}</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.height,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,height:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <i>×</i>
                <label><small>{t("studio.d_2")}</small><input type="number" min={props.measurementUnit === 'mm' ? 1 : 0.04} step={props.measurementUnit === 'mm' ? 1 : 0.01} value={formatDimension(props.dimensions.depth,props.measurementUnit)} onChange={e=>props.setDimensions({...props.dimensions,depth:parseDimension(Number(e.target.value),props.measurementUnit)})}/></label>
                <em>{props.measurementUnit}</em>
              </div>
              <button type="button" className="pro-reset-box-size" title={t("studio.restore_this_template_s_default_width_height_and_depth")} onClick={() => {
                const defaults = selectedTemplate.defaultDimensions;
                if(!defaults){props.setMessage('This template does not define default dimensions');return;}
                props.setDimensions({...props.dimensions, width: defaults.width, height: defaults.height, depth: defaults.depth});
                props.setMessage('Box size reset to template defaults');
              }}><RotateCcw size={12} aria-hidden="true" />{" " + t("studio.reset_size")}</button>
              <div className="pro-current-box-thickness">
                <span>{t("studio.board_thickness")}</span>
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
        <input value={props.templateSearch} onChange={e=>props.setTemplateSearch(e.target.value)} placeholder={t("studio.search_packaging_templates")} />
      </label>

      <div className="pro-structure-categories" aria-label={t("studio.template_categories")}>
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
            onClick={()=>props.onPreviewTemplate(template)}
          >
            <TemplateVisual template={template} />
            <div className="pro-template-card-copy">
              <strong>{getPackagingTemplateCopy(template, t).shortName}</strong>
              <span>{getPackagingTemplateCopy(template, t).category}</span>
            </div>
            <small className={template.status === 'ready' ? 'is-ready' : ''}>{template.status === 'ready' ? t("studio.ready") : t("studio.coming_soon")}</small>
          </button>;
        })}
      </div>

      {templates.length === 0 && <div className="pro-template-empty">
        <Search size={24}/>
        <strong>{t("studio.no_templates_found")}</strong>
        <span>{t("studio.try_another_search_or_category")}</span>
      </div>}

      <div className="pro-card-section pro-box-thickness-card">
        <SectionTitle title={t("studio.board_thickness")} meta="Box & size" />
        <div className="pro-thickness-control-row">
          <div>
            <strong>{t("studio.thickness")}</strong>
            <span>{t("studio.physical_board_edge")}</span>
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
        <p className="pro-help">{t("studio.controls_the_visible_board_edge_and_the_distance_between_the_outside_and_in")}</p>
      </div>

      <button className="pro-next-step-button" type="button" onClick={()=>props.onOpenMediaLibrary(undefined,'upload')}>
        <span><strong>{t("studio.next_add_your_design")}</strong><small>{t("studio.upload_artwork_and_place_it_on_your_box")}</small></span>
        <ImageIcon size={18}/>
      </button>

      <div className="pro-card-section pro-dieline-import-card">
        <SectionTitle title={t("studio.import_dieline")} meta="SVG / DXF" />
        <p className="pro-help">{t("studio.use_svg_or_ascii_dxf_for_vector_dielines_ai_eps_and_pdf_are_not_directly_su")}</p>
        <button className="pro-wide-button" type="button" onClick={props.onImportDieline}><Upload size={16}/>{" " + t("studio.import_svg_or_dxf")}</button>
        {props.importedDieline ? <div className="pro-dieline-import-status">
          <strong>{props.importedDieline.name}</strong>
          <span>{props.importedDieline.format.toUpperCase()} · {props.importedDieline.primitives.length}{" " + t("studio.vector_elements") + " "}{Math.round(props.importedDieline.width)} × {Math.round(props.importedDieline.height)}</span>
          {props.importedDieline.warnings.map(warning => <small key={warning}>{warning}</small>)}
        </div> : null}
      </div>

    </div>;
  }

  if (tool === 'artwork') {
    const selectedKey = props.artworkScope === 'inside' ? `Interior ${props.panel}` : props.panel;
    const selectedArtwork = props.artworkByPanel[selectedKey];
    return <div className="pro-inspector-content">
      <PanelIntro title={t("studio.place_your_design")} text={t("studio.click_any_side_of_the_box_or_dieline_then_choose_or_upload_artwork_for_that")} />

      <div className="pro-artwork-context">
        <div>
          <span>{t("studio.selected_surface")}</span>
          <strong>{props.artworkScope === 'inside' ? t("studio.inside_2") : ''}{props.panel}</strong>
        </div>
        <div className="pro-scope-switch" role="group" aria-label={t("studio.artwork_side")}>
          <button className={props.artworkScope === 'outside' ? 'is-active' : ''} onClick={() => props.setArtworkScope('outside')}>{t("studio.outside")}</button>
          <button className={props.artworkScope === 'inside' ? 'is-active' : ''} onClick={() => props.setArtworkScope('inside')}>{t("studio.inside")}</button>
        </div>
      </div>

      <div className="pro-card-section pro-artwork-design-card">
        <div className="pro-artwork-source-head">
          <div>
            <strong>{props.artworkScope === 'inside' ? t("studio.design_on_inside") : t("studio.design_on_outside")}</strong>
            <span>{selectedArtwork
              ? `Your ${props.artworkScope} artwork is ready. Change it or adjust how it sits on the package.`
              : `Choose an image for the ${props.artworkScope} of the package.`}</span>
          </div>
          {props.mediaAssets.length > 0 && <small>{props.mediaAssets.length}{" " + t("studio.saved")}</small>}
        </div>

        {selectedArtwork && <div className="pro-current-artwork">
          <div className="pro-current-artwork-preview"><span className="artwork-layer" style={artworkCss(selectedArtwork)} /></div>
          <div className="pro-current-artwork-copy">
            <b>{selectedArtwork.name}</b>
            <small>{props.artworkScope === 'inside' ? t("studio.inside_2") : ''}{props.panel}</small>
          </div>
          <button className="pro-current-artwork-remove" aria-label={t("studio.remove_artwork")} onClick={() => props.onRemoveArtwork(selectedKey)}><Trash2 size={15}/></button>
        </div>}

        <div className="pro-artwork-choice-row pro-artwork-choice-single">
          <button className="pro-artwork-source-primary" onClick={() => props.onOpenMediaLibrary(selectedKey)}>
            <span className="pro-artwork-source-icon"><ImageIcon size={17}/></span>
            <span>
              <b>{selectedArtwork ? t("studio.change_image") : t("studio.choose_image")}</b>
              <small>{props.mediaAssets.length > 0 ? t("studio.browse_your_media_library") : t("studio.upload_your_first_image")}</small>
            </span>
            <ChevronDown size={16}/>
          </button>
        </div>

        <p className="pro-help">{t("studio.drag_the_image_on_the_board_to_move_it_use_the_handles_to_resize_and_rotate")}</p>
      </div>
    </div>;
  }

  if (tool === 'material') return <div className="pro-inspector-content">
    <PanelIntro title={t("studio.material_finish_2")} text={t("studio.choose_the_board_or_surface_treatment_then_fine_tune_the_physical_material_")} />
    <div className="pro-material-grid">{materials.map(item=><button key={item} className={props.material===item?'is-selected':''} onClick={()=>props.setMaterial(item)}><span className={`material-${item.toLowerCase().replaceAll(' ','-')}`}/><b>{item}</b></button>)}</div>

    <div className="pro-card-section pro-base-color-card">
      <SectionTitle title={t("studio.base_color")} meta="Inside / outside" />
      <p className="pro-help">{t("studio.color_is_independent_from_finish_keep_the_material_default_or_override_eith")}</p>

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
              <span>{side === 'outside' ? t("studio.outside_color") : t("studio.inside_color")}</span>
              <strong>{mode === 'material' ? t("studio.material_default") : customColor.toUpperCase()}</strong>
            </div>
            <span className="pro-color-swatch" style={{background:shownColor}} aria-hidden="true"/>
          </div>

          <div className="pro-color-mode-switch" role="group" aria-label={`${side} color source`}>
            <button
              type="button"
              className={mode === 'material' ? 'is-active' : ''}
              onClick={()=>setMode('material')}
            >{t("studio.material_default")}</button>
            <button
              type="button"
              className={mode === 'custom' ? 'is-active' : ''}
              onClick={()=>{
                if (mode !== 'custom') setCustomColor(materialColor);
                setMode('custom');
              }}
            >{t("studio.custom")}</button>
          </div>

          {mode === 'custom' && <div className="pro-color-picker-row">
            <label className="pro-color-picker">
              <input
                type="color"
                value={customColor}
                onChange={e=>setCustomColor(e.target.value.toUpperCase())}
                aria-label={`Choose ${side} box color`}
              />
              <span>{t("studio.select_color")}</span>
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

    <div className="pro-callout"><Sparkles size={16}/><span>{t("studio.more_detailed_finish_controls_like_gloss_roughness_foil_and_print_effects_w")}</span></div>
  </div>;

  if (tool === 'opening') {
    const runtime=getTemplateRuntime(props.selectedTemplateId);
    const assemblyControl=runtime?.assembly.control ?? 'none';
    return <div className="pro-inspector-content">
      <PanelIntro title={t("studio.assemble_your_box")} text={t("studio.use_one_control_from_the_flat_dieline_through_assembly_and_where_the_packag")} />
      {assemblyControl!=='none' && <div className="pro-card-section">
        {assemblyControl==='split-direction' ? <StudioDropdown
          label={t("studio.split_direction")}
          value={props.splitTopHingeSide}
          options={[
            {value:'side_a',label:'Left + right top panels'},
            {value:'side_b',label:'Front + back top panels'},
          ]}
          onChange={value=>props.setSplitTopHingeSide(value as 'side_a'|'side_b')}
        /> : <StudioDropdown
          label={t("studio.opening_mechanism")}
          value={props.openingMode}
          options={[
            {value:'closed',label:'Closed / fixed'},
            {value:'lid_from_back',label:'Top lid · back hinge'},
            {value:'lid_from_front',label:'Top lid · front hinge'},
            {value:'lid_from_left',label:'Top lid · left hinge'},
            {value:'lid_from_right',label:'Top lid · right hinge'},
            {value:'door_left',label:'Left side door'},
            {value:'door_right',label:'Right side door'},
            {value:'double_doors',label:'Double side doors'},
          ]}
          onChange={value=>{const mode=value as LegacyOpeningMode;props.setOpeningMode(mode);if(mode==='closed')props.setOpening(0);}}
        />}
      </div>}
      <div className="pro-card-section pro-fold-card">
        <div className="pro-fold-heading"><div><span>{t("studio.assembly")}</span><strong>{props.assemblyStage}</strong></div><b>{Math.round(props.assemblyProgress)}%</b></div>
        <input className="pro-range pro-fold-range" aria-label={t("studio.assemble_or_flatten_box")} type="range" min="0" max="100" step="1" value={Math.round(props.assemblyProgress)} onChange={e=>props.setAssemblyProgress(Number(e.target.value))}/>
        <div className="pro-fold-endpoints"><span>{t("studio.flat")}</span><span>{t("studio.closed")}</span></div>
        <button className="pro-fold-play" onClick={() => props.onAnimateFold(props.assemblyProgress >= 50 ? 0 : 100)}><CirclePlay size={20}/>{props.assemblyProgress >= 50 ? t("studio.flatten_box") : t("studio.assemble_close")}</button>
      </div>
      <div className="pro-callout"><Sparkles size={16}/><span>{props.hasOpeningStage?t("studio.the_box_passes_through_its_fully_assembled_open_state_before_the_final_lid_"):t("studio.the_same_flat_closed_control_is_used_across_all_box_templates")}</span></div>
    </div>;
  }

  if (tool === 'scene') return <div className="pro-inspector-content">
    <PanelIntro title={t("studio.scene_studio")} text={t("studio.product_photography_scenes_are_planned_for_a_later_v2_release")} />
    <div className="pro-feature-empty pro-coming-soon-panel">
      <Lightbulb size={28}/>
      <span className="pro-coming-soon-badge">{t("studio.coming_soon")}</span>
      <strong>{t("studio.create_product_photography_scenes")}</strong>
      <p>{t("studio.backgrounds_lighting_shadows_cameras_and_multi_box_compositions_will_arrive")}</p>
    </div>
  </div>;

  return <div className="pro-inspector-content">
    <PanelIntro title={t("studio.download_your_design")} text={t("studio.download_the_current_3d_preview_or_prepare_a_physical_size_2d_artwork_layou")} />
    <div className="pro-export-ready">
      <ImageIcon size={22}/>
      <div><strong>{t("studio.png_image")}</strong><span>{t("studio.downloads_the_current_3d_camera_view")}</span></div>
    </div>
    <button className="pro-primary pro-export-button" onClick={props.onExport}><Download size={16}/>{" " + t("studio.download_png")}</button>

    <div className="pro-export-ready pro-export-pdf-ready">
      <Grid3X3 size={22}/>
      <div><strong>{t("studio.pdf_dieline")}</strong><span>{t("studio.print_ready") + " "}{props.artworkScope === 'inside' ? t("studio.inside_3") : t("studio.outside_2")}{" " + t("studio.layout_at_the_finished_physical_size")}</span></div>
    </div>
    <button className="pro-secondary-button pro-export-button pro-export-pdf-button" onClick={props.onExportPdf}><Download size={16}/>{" " + t("studio.print_save_pdf")}</button>

    <div className="pro-export-ready">
      <Share2 size={22}/>
      <div><strong>{t("studio.share_link_2")}</strong><span>{t("studio.send_a_view_only_interactive_3d_review_link")}</span></div>
    </div>
    <button className="pro-secondary-button pro-export-button" disabled={!props.canShare||props.shareBusy} onClick={props.onShare}><Share2 size={16}/> {props.shareBusy?t("studio.preparing_link"):props.canShare?t("studio.copy_share_link"):t("studio.save_design_to_share")}</button>

    <div className="pro-export-coming">
      <span>{t("studio.coming_soon")}</span>
      <div><CirclePlay size={18}/><p><strong>{t("studio.animation")}</strong><small>{t("studio.turntable_and_open_close_video")}</small></p></div>
      <div><Grid3X3 size={18}/><p><strong>{t("studio.vector_dieline")}</strong><small>{t("studio.svg_and_dxf_export")}</small></p></div>
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
  const t = useTranslations();

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
        <span>{t("studio.dieline_mapping")}</span>
        <strong>{dieline.name}</strong>
        <small>{progress.assignedPanels}/{progress.panelCandidates}{" " + t("studio.panel_regions_assigned") + " "}{progress.unresolvedLines}{" " + t("studio.unresolved_vector_element")}{progress.unresolvedLines===1?'':t("studio.s")}</small>
      </div>
      <div className="pro-mapping-toolbar-actions">
        <span className={progress.readyFor3D ? 'pro-mapping-ready is-ready' : 'pro-mapping-ready'}>{progress.readyFor3D ? t("studio.ready_for_3d_mapping") : t("studio.mapping_incomplete")}</span>
        <button className="pro-2d-remove-layout" type="button" onClick={onClear}><Trash2 size={15}/>{" " + t("studio.clear_dieline")}</button>
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
          <h3>{t("studio.map_this_dieline")}</h3>
          <p>{t("studio.click_a_vector_element_or_closed_panel_region_then_classify_it_auto_detecte")}</p>
          <div className="pro-mapping-progress"><span style={{width:`${progress.panelCandidates ? Math.round(progress.assignedPanels/progress.panelCandidates*100) : 0}%`}}/></div>
        </div>

        {selectedPrimitiveIndex == null || !selectedPrimitive ? <div className="pro-mapping-empty">
          <Grid3X3 size={24}/>
          <strong>{t("studio.select_geometry")}</strong>
          <span>{t("studio.choose_a_line_or_closed_region_in_the_preview_to_classify_it")}</span>
        </div> : <div className="pro-mapping-editor">
          <div><span>{t("studio.selected")}</span><strong>{primitiveSummary(selectedPrimitive)} #{selectedPrimitiveIndex+1}</strong></div>

          <fieldset>
            <legend>{t("studio.line_role")}</legend>
            <div className="pro-mapping-role-grid">
              {(['cut','crease','ignore','unknown'] as DielineLineRole[]).map(role => <button
                type="button"
                key={role}
                className={(mapping.lineRoles[selectedPrimitiveIndex]??'unknown')===role?'is-active':''}
                onClick={()=>setLineRole(selectedPrimitiveIndex,role)}
              >{role==='cut'?t("studio.cut"):role==='crease'?t("studio.crease_fold"):role==='ignore'?t("studio.ignore"):t("studio.unclassified")}</button>)}
            </div>
          </fieldset>

          {selectedPanelCandidate ? <label className="pro-mapping-panel-select">
            <span>{t("studio.panel_assignment")}</span>
            <select value={mapping.panelNames[selectedPrimitiveIndex]??''} onChange={e=>setPanelName(selectedPrimitiveIndex,e.target.value as DielinePanelName|'')}>
              <option value="">{t("studio.unassigned")}</option>
              {(['Front','Back','Left','Right','Top','Bottom','Glue','Other'] as DielinePanelName[]).map(name=><option key={name} value={name}>{name}</option>)}
            </select>
            <small>{t("studio.closed_vector_regions_are_treated_as_panel_candidates_in_this_first_mapper")}</small>
          </label> : <p className="pro-mapping-note">{t("studio.this_geometry_is_not_a_closed_panel_candidate_classify_it_as_cut_crease_ign")}</p>}
        </div>}

        <div className="pro-mapping-checklist">
          <strong>{t("studio.mapping_checklist")}</strong>
          <span className={progress.assignedPanels>=4?'is-done':''}><Check size={14}/>{" " + t("studio.assign_at_least_4_panel_regions")}</span>
          <span className={progress.unresolvedLines===0?'is-done':''}><Check size={14}/>{" " + t("studio.resolve_all_vector_elements")}</span>
          <span className={progress.readyFor3D?'is-done':''}><Check size={14}/>{" " + t("studio.structure_ready_for_3d_conversion")}</span>
        </div>

        <button className="pro-primary pro-map-to-3d" type="button" disabled={!progress.readyFor3D} onClick={()=>{}}>
          <Boxes size={16}/>{" " + t("studio.generate_3d_structure")}</button>
        <p className="pro-mapping-note">{t("studio.3d_generation_is_intentionally_disabled_until_the_mapping_is_complete_the_a")}</p>
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
  onReorderLayer,
  artworkScope,
  selectedPanel,
  mediaAssets,
  onPanelSelect,
  onUpdatePanelArtwork,
  onArtworkScopeChange,
  dimensions,
  measurementUnit,
  selectedTemplateId,
  openingMode,
  splitTopHingeSide,
  zoom,
  onZoomChange,
  panEnabled,
  canvasPan,
  setCanvasPan,
  onChooseFullLayout,
  onDropArtworkFiles,
  toolsOpen,
  onCloseTools,
  onApplyChanges,
  pdfExportRequest,
  onClearImportedDieline,
  livePreview,
  viewSwitch,
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
  onReorderLayer:(id:string,targetId:string)=>void;
  artworkScope:'outside'|'inside';
  selectedPanel:string;
  mediaAssets:LocalMediaAsset[];
  onPanelSelect:(panel:string)=>void;
  onUpdatePanelArtwork:(key:string,transform:FullDielineTransform)=>void;
  onArtworkScopeChange:(scope:'outside'|'inside')=>void;
  dimensions:CartonDimensions;
  measurementUnit:MeasurementUnit;
  selectedTemplateId:string;
  openingMode:LegacyOpeningMode;
  splitTopHingeSide:'side_a'|'side_b';
  zoom:number;
  onZoomChange:React.Dispatch<React.SetStateAction<number>>;
  panEnabled:boolean;
  canvasPan:{x:number;y:number};
  setCanvasPan:React.Dispatch<React.SetStateAction<{x:number;y:number}>>;
  onChooseFullLayout:()=>void;
  onDropArtworkFiles:(files:File[],point:{x:number;y:number})=>void;
  toolsOpen:boolean;
  onCloseTools:()=>void;
  onApplyChanges:()=>void;
  pdfExportRequest:number;
  onClearImportedDieline:()=>void;
  livePreview:React.ReactNode;
  viewSwitch:React.ReactNode;
}) {
  const t = useTranslations();

  const printBoardRef=useRef<HTMLDivElement>(null);
  const [printError,setPrintError]=useState('');
  const [printing,setPrinting]=useState(false);
  const cartonPanels = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).panels;
  const bounds = getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
  // Size the 2D sheet from its real physical footprint instead of relying on
  // the old fixed .pro-dieline dimensions. This makes width/height/depth
  // edits visibly reshape the dieline immediately.
  const visualMax = 760;
  const visualScale = visualMax / Math.max(bounds.width, bounds.height);
  const visualWidth = bounds.width * visualScale;
  const visualHeight = bounds.height * visualScale;

  const lastPdfExportRequest=useRef(0);
  useEffect(()=>{
    if(!pdfExportRequest || pdfExportRequest===lastPdfExportRequest.current)return;
    lastPdfExportRequest.current=pdfExportRequest;
    const board=printBoardRef.current;
    if(!board)return;
    const exportBounds=getTemplateGeometry(selectedTemplateId,dimensions,{openingMode,splitTopHingeSide}).bounds;
    setPrintError('');
    setPrinting(true);
    void printDielineLayout(board,exportBounds,layers)
      .catch(error=>setPrintError(error instanceof Error?error.message:'Could not prepare the PDF layout.'))
      .finally(()=>setPrinting(false));
  },[pdfExportRequest,dimensions,layers,selectedTemplateId,openingMode,splitTopHingeSide]);
  const sideArtwork=Object.entries(artworkByPanel).filter(([key])=>artworkScope==='inside'?key.startsWith('Interior '):!key.startsWith('Interior '));
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) ?? null;
  const draggingLayerId = useRef<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [boardFileDragActive,setBoardFileDragActive]=useState(false);
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
  const [transformFeedback,setTransformFeedback]=useState<string|null>(null);

  const normalizeAngle=(value:number)=>{
    const normalized=((value%360)+360)%360;
    return normalized>180?normalized-360:normalized;
  };

  const toDisplayUnit=(millimetres:number)=>measurementUnit==='mm'?millimetres:millimetres/25.4;
  const fromDisplayUnit=(value:number)=>measurementUnit==='mm'?value:value*25.4;
  const formatTransformValue=(value:number)=>measurementUnit==='mm'?Number(value.toFixed(1)):Number(value.toFixed(2));

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
    setTransformFeedback(null);
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
      const nextX=Math.max(-100,Math.min(200,gesture.start.x+dx));
      const nextY=Math.max(-100,Math.min(200,gesture.start.y+dy));
      setTransformFeedback(null);
      updateArtworkLayer(gesture.layerId,{...gesture.start,x:nextX,y:nextY});
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

      setTransformFeedback(null);

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
    let rotation=gesture.start.rotation+delta;
    const snapTarget=Math.round(rotation/15)*15;
    if(event.shiftKey)rotation=snapTarget;
    rotation=normalizeAngle(rotation);
    setTransformFeedback(`${Math.round(rotation*10)/10}°`);
    updateArtworkLayer(gesture.layerId,{...gesture.start,rotation});
  };

  const endLayerGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gestureRef.current=null;
    setTransformFeedback(null);
  };

  if (importedDieline) {
    return <><ImportedDielineMapper
      dieline={importedDieline}
      mapping={mapping ?? createInitialDielineMapping(importedDieline)}
      setMapping={setMapping}
      onClear={onClearImportedDieline}
    /><div className="pro-2d-right-preview pro-2d-preview-only">{livePreview}</div></>;
  }

  return <div className="pro-dieline-stage pro-2d-design-stage">
    <div className="pro-2d-design-toolbar">
      <span>{t("studio.design_canvas")}</span>
      <button type="button" className="pro-apply-artwork-button" onClick={onApplyChanges}><Boxes size={17}/>{" " + t("studio.preview_in_3d")}</button>
    </div>

    {printError && <p className="pro-dieline-print-error" role="alert">{printError}</p>}
    <div
      className={`pro-dieline-workspace${panEnabled ? ' is-pan-enabled' : ''}`}
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
      {toolsOpen && <aside className="pro-2d-left-panel pro-design-inspector-shell" aria-label={t("studio.design_tools")}>
        <div className="pro-inspector-title pro-design-inspector-title">
          <div><span>{t("studio.design_2")}</span><h2>{artworkScope==='inside'?t("studio.inside_artwork"):t("studio.outside_artwork")}</h2></div>
          <button type="button" className="pro-inspector-close pro-design-inspector-close" aria-label={t("studio.close_design_tools")} title={t("studio.close")} onClick={onCloseTools}><X size={18}/></button>
        </div>
        <div className="pro-design-inspector-content">
          <div className="pro-dieline-surface-switch" role="group" aria-label={t("studio.printed_side")}>
            <button type="button" className={artworkScope==='outside'?'is-active':''} onClick={()=>onArtworkScopeChange('outside')}>{t("studio.outside")}</button>
            <button type="button" className={artworkScope==='inside'?'is-active':''} onClick={()=>onArtworkScopeChange('inside')}>{t("studio.inside")}</button>
          </div>

          <div className="pro-2d-left-actions">
            <button className="pro-primary pro-design-add-artwork" onClick={onChooseFullLayout}><ImageIcon size={17}/>{" " + t("studio.add_artwork")}</button>
          </div>

          <aside className="pro-dieline-layers-panel pro-design-left-layers" aria-label={`${artworkScope} artwork layers`}>
            <div className="pro-dieline-layers-heading">
              <div><span>{t("studio.layers")}</span><strong>{layers.length+sideArtwork.length}</strong></div>
              <button type="button" onClick={onChooseFullLayout}><Upload size={14}/>{" " + t("studio.add")}</button>
            </div>

            {layers.length ? <div className="pro-dieline-layer-list">
              {[...layers].reverse().map((layer,reverseIndex) => {
                const realIndex=layers.length-1-reverseIndex;
                const selected=layer.id===selectedLayerId;
                return <button
                  type="button"
                  key={layer.id}
                  className={`${selected?'is-selected':''}${dropTargetId===layer.id?' is-drop-target':''}`}
                  onClick={()=>onSelectLayer(layer.id)}
                  title={t("studio.drag_to_change_layer_order")}
                  draggable
                  onDragStart={event=>{
                    draggingLayerId.current=layer.id;
                    event.dataTransfer.effectAllowed='move';
                    event.dataTransfer.setData('text/plain',layer.id);
                    onSelectLayer(layer.id);
                  }}
                  onDragOver={event=>{
                    if (!draggingLayerId.current || draggingLayerId.current===layer.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect='move';
                    if (dropTargetId!==layer.id) setDropTargetId(layer.id);
                  }}
                  onDragLeave={event=>{
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTargetId(null);
                  }}
                  onDrop={event=>{
                    event.preventDefault();
                    if (draggingLayerId.current && draggingLayerId.current!==layer.id) onReorderLayer(draggingLayerId.current,layer.id);
                    draggingLayerId.current=null;
                    setDropTargetId(null);
                  }}
                  onDragEnd={()=>{draggingLayerId.current=null;setDropTargetId(null);}}
                >
                  <img src={layer.url} alt="" draggable={false}/>
                  <span><strong>{layer.name}</strong><small>{Math.round(layer.transform.width)} × {Math.round(layer.transform.height)}% · {Math.round(layer.transform.rotation)}°</small></span>
                  <i>{realIndex===layers.length-1?t("studio.top"):realIndex+1}</i>
                </button>;
              })}
            </div> : sideArtwork.length ? null : <div className="pro-dieline-layers-empty"><ImageIcon size={22}/><span>{t("studio.add_artwork_to_start_composing")}</span></div>}

            {sideArtwork.length>0 && <div className="pro-dieline-layer-list">{sideArtwork.map(([key,artwork])=><button key={key} type="button" className={selectedPanel===key.replace('Interior ','') && !selectedLayerId?'is-selected':''} onClick={()=>onPanelSelect(key.replace('Interior ',''))}><img src={artwork.url} alt=""/><span><strong>{artwork.name}</strong><small>{key}</small></span></button>)}</div>}

            {selectedLayer && <div className="pro-dieline-layer-actions">
              <button type="button" title={t("studio.bring_forward")} aria-label={t("studio.bring_selected_layer_forward")} disabled={layers[layers.length-1]?.id===selectedLayer.id} onClick={()=>onMoveLayer(selectedLayer.id,1)}><ArrowUp size={16}/></button>
              <button type="button" title={t("studio.send_backward")} aria-label={t("studio.send_selected_layer_backward")} disabled={layers[0]?.id===selectedLayer.id} onClick={()=>onMoveLayer(selectedLayer.id,-1)}><ArrowDown size={16}/></button>
              <button type="button" title={t("studio.duplicate")} aria-label={t("studio.duplicate_selected_layer")} onClick={()=>onDuplicateLayer(selectedLayer.id)}><Copy size={16}/></button>
              <button type="button" title={t("studio.delete")} aria-label={t("studio.delete_selected_layer")} onClick={()=>onRemoveLayer(selectedLayer.id)}><Trash2 size={16}/></button>
            </div>}
          </aside>

          <div className="pro-design-output">
            <span>{t("studio.print_output")}</span>
            <button type="button" className="pro-secondary-button" disabled={printing} onClick={async()=>{
              if (!printBoardRef.current) return;
              setPrintError('');setPrinting(true);
              try { await printDielineLayout(printBoardRef.current,bounds,layers); }
              catch(error) { setPrintError(error instanceof Error ? error.message : 'Could not prepare the print layout.'); }
              finally { setPrinting(false); }
            }}><Download size={16}/> {printing?t("studio.preparing_pdf"):t("studio.print_save_pdf")}</button>
          </div>
        </div>
      </aside>}

      <div className="pro-2d-right-preview pro-design-context-stack">
        {livePreview}
        <aside className={`pro-design-transform-panel${selectedLayer?' has-selection':''}`} aria-label={t("studio.artwork_properties")}>
          {selectedLayer ? <>
            <div className="pro-design-transform-panel-head">
              <div><span>{t("studio.transform")}</span><strong>{t("studio.exact_placement")}</strong></div>
              <button type="button" className="pro-secondary-button" onClick={() => onUpdateLayer(
                selectedLayer.id,
                createFullDielineTransform(selectedLayer.aspectRatio, bounds.width / bounds.height),
              )}><Maximize2 size={15}/>{" " + t("studio.reset")}</button>
            </div>

            <section className="pro-precision-transform" aria-label={t("studio.selected_artwork_transform")}>
              <div className="pro-precision-transform-head">
                <span>{t("studio.selected_artwork")}</span>
                <span>{t("studio.free_movement")}</span>
              </div>
              <div className="pro-precision-transform-grid">
                <label><span>{t("studio.x")}</span><input key={`x-${selectedLayer.id}-${Math.round(selectedLayer.transform.x*100)}`} type="number" step={measurementUnit==='mm'?1:.01} defaultValue={formatTransformValue(toDisplayUnit(bounds.width*selectedLayer.transform.x/100))} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value))updateArtworkLayer(selectedLayer.id,{...selectedLayer.transform,x:fromDisplayUnit(value)/bounds.width*100});}}/><small>{measurementUnit}</small></label>
                <label><span>{t("studio.y")}</span><input key={`y-${selectedLayer.id}-${Math.round(selectedLayer.transform.y*100)}`} type="number" step={measurementUnit==='mm'?1:.01} defaultValue={formatTransformValue(toDisplayUnit(bounds.height*selectedLayer.transform.y/100))} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value))updateArtworkLayer(selectedLayer.id,{...selectedLayer.transform,y:fromDisplayUnit(value)/bounds.height*100});}}/><small>{measurementUnit}</small></label>
                <label><span>{t("studio.w_2")}</span><input key={`w-${selectedLayer.id}-${Math.round(selectedLayer.transform.width*100)}`} type="number" min="0.1" step={measurementUnit==='mm'?1:.01} defaultValue={formatTransformValue(toDisplayUnit(bounds.width*selectedLayer.transform.width/100))} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value)&&value>0)updateArtworkLayer(selectedLayer.id,{...selectedLayer.transform,width:fromDisplayUnit(value)/bounds.width*100});}}/><small>{measurementUnit}</small></label>
                <label><span>{t("studio.h_2")}</span><input key={`h-${selectedLayer.id}-${Math.round(selectedLayer.transform.height*100)}`} type="number" min="0.1" step={measurementUnit==='mm'?1:.01} defaultValue={formatTransformValue(toDisplayUnit(bounds.height*selectedLayer.transform.height/100))} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value)&&value>0)updateArtworkLayer(selectedLayer.id,{...selectedLayer.transform,height:fromDisplayUnit(value)/bounds.height*100});}}/><small>{measurementUnit}</small></label>
                <label className="is-rotation"><span><RotateCw size={13}/>{" " + t("studio.rotation")}</span><input key={`r-${selectedLayer.id}-${Math.round(selectedLayer.transform.rotation*10)}`} type="number" step="1" defaultValue={Number(normalizeAngle(selectedLayer.transform.rotation).toFixed(1))} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value))updateArtworkLayer(selectedLayer.id,{...selectedLayer.transform,rotation:normalizeAngle(value)});}}/><small>°</small></label>
              </div>
              <p>{t("studio.drag_freely_hold") + " "}<kbd>{t("studio.shift")}</kbd>{" " + t("studio.while_rotating_for_15_steps")}</p>
            </section>
          </> : <div className="pro-design-transform-empty">
            <Move size={22}/>
            <strong>{t("studio.select_an_artwork_layer")}</strong>
            <span>{t("studio.choose_a_layer_on_the_left_or_directly_on_the_dieline_to_edit_its_position_")}</span>
          </div>}
        </aside>
      </div>

      <div
        ref={printBoardRef}
        className={`pro-dieline pro-dieline-live${layers.length ? ' has-full-layout-editor' : ''}${boardFileDragActive ? ' is-file-drop-target' : ''}`}
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
        onDragEnter={(event)=>{
          if(!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          setBoardFileDragActive(true);
        }}
        onDragOver={(event)=>{
          if(!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect='copy';
          setBoardFileDragActive(true);
        }}
        onDragLeave={(event)=>{
          if(!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          if(!event.currentTarget.contains(event.relatedTarget as Node|null)) setBoardFileDragActive(false);
        }}
        onDrop={(event)=>{
          if(!event.dataTransfer.files.length) return;
          event.preventDefault();
          event.stopPropagation();
          setBoardFileDragActive(false);
          const rect=event.currentTarget.getBoundingClientRect();
          onDropArtworkFiles(Array.from(event.dataTransfer.files),{
            x:(event.clientX-rect.left)/Math.max(1,rect.width)*100,
            y:(event.clientY-rect.top)/Math.max(1,rect.height)*100,
          });
        }}
      >
        <div className="pro-full-artwork-print-surface">{layers.map(layer=><div key={layer.id} className="pro-printed-artwork-layer" style={{left:`${layer.transform.x}%`,top:`${layer.transform.y}%`,width:`${layer.transform.width}%`,height:`${layer.transform.height}%`,transform:`translate(-50%,-50%) rotate(${layer.transform.rotation}deg)`}}><BoardArtworkImage url={layer.url} aspectRatio={layer.aspectRatio} width={bounds.width*layer.transform.width} height={bounds.height*layer.transform.height}/></div>)}</div>
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
              <button type="button" className="pro-transform-handle pro-transform-rotate" aria-label={t("studio.rotate_selected_artwork")} title={t("studio.rotate_freely_hold_shift_to_snap_to_15_increments")} onPointerDown={event=>beginLayerGesture(event,layer,'rotate')}><RotateCw size={13}/></button>
              {transformFeedback&&<span className="pro-transform-feedback">{transformFeedback}</span>}
            </>}
          </div>;
        })}

        {cartonPanels.map(item => {
          const panelName=item.label.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
          const explicitArtwork=artworkByPanel[artworkScope==='inside'? `Interior ${panelName}`:panelName];
          const hasArtwork=!!explicitArtwork || layers.length>0;
          return <div
            key={item.id}
            className={`dl-live dl-${item.kind} ${hasArtwork?'has-artwork':''} ${explicitArtwork?'has-explicit-artwork':''} pro-dieline-panel-guide`}
            style={{left:`${item.x/bounds.width*100}%`,top:`${item.y/bounds.height*100}%`,width:`${item.width/bounds.width*100}%`,height:`${item.height/bounds.height*100}%`,overflow:'hidden'}}
            aria-label={`${artworkScope} ${panelName} panel guide`}
          >
            {explicitArtwork ? explicitArtwork.transform ? <span className="artwork-layer" style={{...artworkCss(explicitArtwork),backgroundImage:'none'}}><BoardArtworkImage url={explicitArtwork.url} aspectRatio={1} width={item.width*explicitArtwork.transform.width} height={item.height*explicitArtwork.transform.height}/></span> : <span className="artwork-layer" style={artworkCss(explicitArtwork)}/> : null}
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
              <button type="button" className="pro-transform-handle pro-transform-rotate" aria-label={`Rotate ${selectedPanel} artwork`} title={t("studio.rotate_snaps_near_15_increments")} onPointerDown={event=>beginLayerGesture(event,layer,'rotate')}><RotateCw size={13}/></button>
              {transformFeedback&&<span className="pro-transform-feedback">{transformFeedback}</span>}
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className="pro-dieline-legend">
      <span><i className="cut"/>{t("studio.cut")}</span>
      <span><i className="crease"/>{t("studio.crease")}</span>
      <span><i className="bleed"/>{t("studio.bleed")}</span>
      <strong>{layers.length ? t("studio.drag_freely_hold_shift_while_resizing_to_change_proportions_hold_shift_whil") : `Add artwork to the ${artworkScope} side of the sheet`}</strong>
    </div>

  </div>;
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
  uploadProgress: MediaUploadProgress|null;
  onDropFiles: (files:File[])=>void;
  onUse: (asset:LocalMediaAsset, options:{ mode:ArtworkMode; scale:number; rotation:number })=>void;
  onDelete: (assetId:string)=>Promise<{deleted:boolean;usages?:Array<{id:string;name:string}>;error?:string}>;
  onClose: ()=>void;
}) {
  const t = useTranslations();

  const selected = props.assets.find(asset => asset.id === props.selectedAssetId) ?? null;
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteConfirmOpen,setDeleteConfirmOpen] = useState(false);
  const [deleteBusy,setDeleteBusy] = useState(false);
  const [deleteError,setDeleteError] = useState('');
  const [deleteUsages,setDeleteUsages] = useState<Array<{id:string;name:string}>>([]);
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
    <section className="pro-media-modal pro-media-modal-unified" role="dialog" aria-modal="true" aria-label={t("studio.add_artwork")}>
      <header className="pro-media-modal-header">
        <div>
          <span>{t("studio.my_images")}</span>
          <h2>{t("studio.add_artwork")}</h2>
          <p>{t("studio.reuse_images_from_your_account_or_upload_a_new_one_then_position_it_directl")}</p>
        </div>
        <button aria-label={t("studio.close_add_artwork_dialog")} onClick={props.onClose}><X size={20}/></button>
      </header>

      {props.uploadProgress && <div className={`pro-media-upload-progress is-${props.uploadProgress.phase}`} role="status" aria-live="polite">
        <div className="pro-media-upload-progress-head">
          <div>
            <strong>{props.uploadProgress.phase==='complete'?t("studio.upload_complete"):props.uploadProgress.phase==='processing'?t("studio.processing_image"):t("studio.uploading_image")}</strong>
            <span>{props.uploadProgress.fileName}</span>
          </div>
          <div>
            <span>{props.uploadProgress.totalFiles>1?`${props.uploadProgress.fileIndex} of ${props.uploadProgress.totalFiles} · `:''}{props.uploadProgress.percent}%</span>
          </div>
        </div>
        <div className="pro-media-upload-progress-track" aria-hidden="true">
          <span style={{width:`${props.uploadProgress.percent}%`}}/>
        </div>
      </div>}

      <div className="pro-media-unified-workspace">
        <div className="pro-media-unified-library">
          <div className="pro-media-browser-toolbar">
            <label className="pro-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t("studio.search_artwork")} /></label>
            <button className="pro-secondary-button" disabled={props.uploadProgress?.active} onClick={props.onUpload}><Upload size={15}/> {props.uploadProgress?.active?t("studio.uploading"):t("studio.upload_image")}</button>
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
            <div><strong>{dragging ? t("studio.drop_it_here") : t("studio.drop_artwork_here")}</strong><span>{t("studio.png_jpg_webp_or_svg_any_image_dimensions")}</span></div>
            <button type="button" disabled={props.uploadProgress?.active} onClick={props.onUpload}>{t("studio.browse")}</button>
          </div>

          {filteredAssets.length === 0 ? <div className="pro-media-empty">
            <ImageIcon size={30}/>
            <h3>{props.assets.length ? t("studio.no_matching_artwork") : t("studio.upload_your_first_image")}</h3>
            <p>{props.assets.length ? t("studio.try_another_search") : t("studio.uploaded_images_are_saved_to_my_images_so_you_can_reuse_them_in_future_desi")}</p>
            {!props.assets.length && <button className="pro-primary pro-media-empty-action" disabled={props.uploadProgress?.active} onClick={props.onUpload}><Upload size={15}/> {props.uploadProgress?.active?t("studio.uploading"):t("studio.choose_image")}</button>}
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
              <div><span>{t("studio.place_on")}</span><strong>{targetLabel}</strong></div>
              <button type="button" className="pro-media-replace" onClick={props.onUpload}><Upload size={14}/>{" " + t("studio.replace")}</button>
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

            <div className="pro-media-canvas-handoff"><Move size={16}/><p><strong>{t("studio.place_it_on_the_board")}</strong><span>{t("studio.drag_resize_and_rotate_directly_in_2d_design_after_adding")}</span></p></div>

            <div className="pro-media-editor-meta">
              <span>{selected.mimeType.replace('image/','').toUpperCase()}</span>
              <span>{usageCount ? `Used on ${usageCount} panel${usageCount===1?'':'s'}` : t("studio.not_used_yet")}</span>
              <button
                className="pro-media-delete-link"
                title={t("studio.delete_from_my_images")}
                onClick={() => {
                  setDeleteError('');
                  setDeleteUsages([]);
                  setDeleteConfirmOpen(true);
                }}
              ><Trash2 size={14}/>{" " + t("studio.delete")}</button>
            </div>
          </> : <div className="pro-media-editor-empty">
            <ImageIcon size={32}/>
            <h3>{t("studio.choose_from_my_images")}</h3>
            <p>{t("studio.select_an_image_you_have_already_uploaded_or_add_a_new_one_to_your_reusable")}</p>
            <button className="pro-primary pro-media-empty-action" disabled={props.uploadProgress?.active} onClick={props.onUpload}><Upload size={15}/> {props.uploadProgress?.active?t("studio.uploading"):t("studio.upload_image")}</button>
          </div>}
        </aside>
      </div>

      {deleteConfirmOpen && selected && <div className="pro-media-delete-confirm-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!deleteBusy){setDeleteConfirmOpen(false);setDeleteError('');setDeleteUsages([]);}}}>
        <section className="pro-media-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="media-delete-title">
          <div className="pro-confirm-icon is-danger"><Trash2 size={22}/></div>
          <div className="pro-media-delete-confirm-copy">
            <span>{t("studio.delete_image")}</span>
            <h3 id="media-delete-title">{t("studio.delete_2")}{selected.name}{t("studio.from_my_images")}</h3>
            {deleteUsages.length ? <>
              <p>{t("studio.this_image_cannot_be_deleted_because_it_is_still_used_in")}</p>
              <ul>{deleteUsages.map(item=><li key={item.id}><strong>{item.name}</strong></li>)}</ul>
              <p>{t("studio.remove_or_replace_this_image_in") + " "}{deleteUsages.length===1?t("studio.that_design"):t("studio.those_designs")}{t("studio.save_the_changes_then_try_deleting_it_again")}</p>
            </> : <p>{t("studio.this_permanently_removes_the_image_from_your_media_library_and_its_stored_f")}</p>}
            {deleteError && <div className="pro-media-delete-error" role="alert">{deleteError}</div>}
          </div>
          <div className="pro-media-delete-confirm-actions">
            <button type="button" className="pro-secondary-button" disabled={deleteBusy} onClick={()=>{setDeleteConfirmOpen(false);setDeleteError('');setDeleteUsages([]);}}>{deleteUsages.length?t("studio.close"):t("studio.cancel")}</button>
            {!deleteUsages.length && <button type="button" className="pro-danger-button" disabled={deleteBusy} onClick={async()=>{
              setDeleteBusy(true);
              setDeleteError('');
              const result=await props.onDelete(selected.id);
              setDeleteBusy(false);
              if(result.deleted){
                setDeleteConfirmOpen(false);
                setDeleteUsages([]);
                return;
              }
              setDeleteUsages(result.usages ?? []);
              setDeleteError(result.usages?.length ? '' : (result.error ?? 'Could not delete image.'));
            }}>{deleteBusy?t("studio.deleting"):t("studio.delete_image")}</button>}
          </div>
        </section>
      </div>}

      <footer className="pro-media-modal-footer">
        <span>{props.targetPanel === '__FULL_DIELINE__'
          ? `You can continue moving and resizing this artwork on the ${props.targetScope} 2D dieline.`
          : `Adding artwork to ${targetLabel}.`}</span>
        <div>
          <button className="pro-secondary-button" onClick={props.onClose}>{t("studio.cancel")}</button>
          <button className="pro-primary" disabled={!selected} onClick={() => selected && props.onUse(selected,{mode:fitMode,scale,rotation})}>
            {props.targetPanel === '__FULL_DIELINE__' ? t("studio.add_to_dieline") : `Add to ${targetLabel}`}
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

function StudioDropdown({label,value,options,onChange}:{label:string;value:string;options:Array<{value:string;label:string}>;onChange:(value:string)=>void}) {
  const [open,setOpen]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const selected=options.find(option=>option.value===value) ?? options[0];

  useEffect(()=>{
    if(!open)return;
    const close=(event:MouseEvent)=>{
      if(!ref.current?.contains(event.target as Node))setOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('mousedown',close);
    document.addEventListener('keydown',escape);
    return ()=>{
      document.removeEventListener('mousedown',close);
      document.removeEventListener('keydown',escape);
    };
  },[open]);

  return <div className="pro-studio-dropdown-field" ref={ref}>
    <span>{label}</span>
    <button
      type="button"
      className={`pro-studio-dropdown-trigger${open?' is-open':''}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={()=>setOpen(current=>!current)}
    >
      <strong>{selected?.label ?? 'Choose an option'}</strong>
      <ChevronDown size={17}/>
    </button>
    {open&&<div className="pro-studio-dropdown-menu" role="listbox" aria-label={label}>
      {options.map(option=><button
        key={option.value}
        type="button"
        role="option"
        aria-selected={option.value===value}
        className={option.value===value?'is-selected':''}
        onClick={()=>{onChange(option.value);setOpen(false);}}
      >
        <span>{option.label}</span>
        {option.value===value&&<Check size={16}/>}
      </button>)}
    </div>}
  </div>;
}

function PanelIntro({title,text}:{title:string;text:string}) {
  return <div className="pro-panel-intro"><h3>{title}</h3><p>{text}</p></div>;
}

function SectionTitle({title,meta}:{title:string;meta?:string}) { return <div className="pro-section-title"><strong>{title}</strong>{meta&&<span>{meta}</span>}</div>; }
