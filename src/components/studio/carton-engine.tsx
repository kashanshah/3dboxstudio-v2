'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import { sanitizeCartonDimensions, reverseTuckPanels, reverseTuckFoldState, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { baseBoxPanels,splitTopBoxPanels } from '@/lib/packaging/box-structures';
import type { ArtworkByPanel, ArtworkPlacement } from '@/lib/packaging/artwork';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { getDefaultPackagingTemplate } from '@/lib/packaging/template-registry';
import { requireTemplateRuntime } from '@/lib/packaging/template-runtime';

export type CartonEngineHandle = {
  thumbnail: () => string | null;
  exportPng: (filename?: string) => boolean;
  resetCamera: () => void;
};

type Props = {
  dimensions: CartonDimensions;
  templateId: string;
  opening: number;
  formation?: number;
  openingMode?: LegacyOpeningMode;
  splitTopHingeSide?: 'side_a' | 'side_b';
  material: string;
  outsideColor?: string | null;
  insideColor?: string | null;
  artworkByPanel: ArtworkByPanel;
  cameraPreset: string;
  zoom: number;
  viewPan?: {x:number;y:number};
  panEnabled?: boolean;
  onViewPanChange?: (pan:{x:number;y:number})=>void;
  onZoomChange?: React.Dispatch<React.SetStateAction<number>>;
  lightIntensity?: number;
  onPanelSelect?: (panel: string, point: { x: number; y: number }) => void;
};

type Mesh = {
  vertices: Float32Array;
  useTexture: boolean;
  color: [number, number, number];
  model?: Float32Array;
  panel?: string;
  fallbackPanel?: string;
  fallbackUv?: [number,number,number,number];
  pickCorners?: number[][];
  faceAspect?: number;
  doubleSided?: boolean;
};

export const CartonEngine = forwardRef<CartonEngineHandle, Props>(function CartonEngine(
  { dimensions, templateId, opening, formation = 100, openingMode = 'closed', splitTopHingeSide = 'side_a', material, outsideColor = null, insideColor = null, artworkByPanel, cameraPreset, zoom, viewPan = {x:0,y:0}, panEnabled = false, onViewPanChange, lightIntensity = 0, onPanelSelect },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createRenderer> | null>(null);
  const [yaw, setYaw] = useState(-0.55);
  const [pitch, setPitch] = useState(0.28);
  const [hoverPanel, setHoverPanel] = useState<string | null>(null);
  const yawRef = useRef(-0.55);
  const pitchRef = useRef(0.28);
  const cameraAnimationRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; yaw: number; pitch: number; panX:number; panY:number; mode:'rotate'|'pan'; moved: boolean } | null>(null);

  const cancelCameraAnimation = useCallback(() => {
    if (cameraAnimationRef.current !== null) {
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
    }
  }, []);

  const animateCameraTo = useCallback((targetYaw: number, targetPitch: number) => {
    cancelCameraAnimation();

    const startYaw = yawRef.current;
    const startPitch = pitchRef.current;
    const yawDelta = shortestAngleDelta(startYaw, targetYaw);
    const pitchDelta = targetPitch - startPitch;
    const startedAt = performance.now();
    const duration = 520;

    const frame = (now: number) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      const nextYaw = startYaw + yawDelta * eased;
      const nextPitch = startPitch + pitchDelta * eased;

      yawRef.current = nextYaw;
      pitchRef.current = nextPitch;
      setYaw(nextYaw);
      setPitch(nextPitch);

      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(frame);
      } else {
        cameraAnimationRef.current = null;
      }
    };

    cameraAnimationRef.current = requestAnimationFrame(frame);
  }, [cancelCameraAnimation]);

  const resetCamera = useCallback(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useImperativeHandle(ref, () => ({
    thumbnail() {
      const source = canvasRef.current;
      if (!source || !source.width || !source.height) return null;
      rendererRef.current?.render();
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = Math.max(1, Math.round(320 * source.height / source.width));
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    },
    exportPng(filename = '3d-box-studio-carton.png') {
      const canvas = canvasRef.current;
      if (!canvas) return false;
      rendererRef.current?.render();
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
      return true;
    },
    resetCamera,
  }), [resetCamera]);

  useEffect(() => {
    const preset = cameraForPreset(cameraPreset);
    animateCameraTo(preset.yaw, preset.pitch);
  }, [cameraPreset, animateCameraTo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = createRenderer(canvas);
    if (!renderer) return;
    rendererRef.current = renderer;

    const observer = new ResizeObserver(() => renderer.resize());
    observer.observe(canvas);
    renderer.resize();

    return () => {
      observer.disconnect();
      cancelCameraAnimation();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [cancelCameraAnimation]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    renderer.setScene({
      dimensions,
      templateId,
      opening,
      formation,
      openingMode,
      splitTopHingeSide,
      material,
      outsideColor,
      insideColor,
      artworkByPanel,
      yaw,
      pitch,
      zoom,
      viewPan,
      lightIntensity,
      hoverPanel,
    });
  }, [dimensions, templateId, opening, formation, openingMode, splitTopHingeSide, material, outsideColor, insideColor, artworkByPanel, yaw, pitch, zoom, viewPan, lightIntensity, hoverPanel]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    cancelCameraAnimation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: yawRef.current, pitch: pitchRef.current, panX:viewPan.x, panY:viewPan.y, mode:panEnabled?'pan':'rotate', moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      if(drag.mode==='pan'){
        onViewPanChange?.({x:drag.panX+dx,y:drag.panY+dy});
      }else{
        const nextYaw = drag.yaw - dx * 0.008;
        const nextPitch = clamp(drag.pitch + dy * 0.006, -1.15, 1.15);
        yawRef.current = nextYaw;
        pitchRef.current = nextPitch;
        setYaw(nextYaw);
        setPitch(nextPitch);
      }
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const hovered = rendererRef.current?.pickPanel(event.clientX - rect.left, event.clientY - rect.top) ?? null;
    setHoverPanel(hovered);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!drag?.moved) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const panel = rendererRef.current?.pickPanel(x, y);
      if (panel) onPanelSelect?.(panel, { x, y });
    }
  };


  return <canvas
    ref={canvasRef}
    className={`carton-engine-canvas${panEnabled?' is-pan-enabled':''}`}
    aria-label="Interactive 3D packaging preview"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={() => { dragRef.current = null; }}
    onPointerLeave={() => { dragRef.current = null; setHoverPanel(null); }}
  />;
});

type Scene = {
  dimensions: CartonDimensions;
  templateId: string;
  opening: number;
  formation: number;
  openingMode: LegacyOpeningMode;
  splitTopHingeSide: 'side_a' | 'side_b';
  material: string;
  outsideColor: string | null;
  insideColor: string | null;
  artworkByPanel: ArtworkByPanel;
  yaw: number;
  pitch: number;
  zoom: number;
  viewPan: {x:number;y:number};
  lightIntensity: number;
  hoverPanel: string | null;
};

function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) return null;

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  if (!program) return null;

  const positionLocation = gl.getAttribLocation(program, 'aPosition');
  const normalLocation = gl.getAttribLocation(program, 'aNormal');
  const uvLocation = gl.getAttribLocation(program, 'aUv');
  const viewProjectionLocation = gl.getUniformLocation(program, 'uViewProjection');
  const modelLocation = gl.getUniformLocation(program, 'uModel');
  const colorLocation = gl.getUniformLocation(program, 'uColor');
  const lightLocation = gl.getUniformLocation(program, 'uLightDirection');
  const lightIntensityLocation = gl.getUniformLocation(program, 'uLightIntensity');
  const useTextureLocation = gl.getUniformLocation(program, 'uUseTexture');
  const textureLocation = gl.getUniformLocation(program, 'uTexture');
  const uvScaleLocation = gl.getUniformLocation(program, 'uUvScale');
  const uvOffsetLocation = gl.getUniformLocation(program, 'uUvOffset');
  const uvRotationLocation = gl.getUniformLocation(program, 'uUvRotation');
  const tileLocation = gl.getUniformLocation(program, 'uTile');
  const clipLocation = gl.getUniformLocation(program, 'uClipOutside');
  const faceUvLocation = gl.getUniformLocation(program, 'uFaceUv');
  const uvCropLocation = gl.getUniformLocation(program, 'uUvCrop');
  const overlayColorLocation = gl.getUniformLocation(program, 'uOverlayColor');
  const overlayAlphaLocation = gl.getUniformLocation(program, 'uOverlayAlpha');
  const outlineAlphaLocation = gl.getUniformLocation(program, 'uOutlineAlpha');

  const buffer = gl.createBuffer();
  if (!buffer) return null;

  const panelTextures = new Map<string, { texture: WebGLTexture; url: string; loaded: boolean; width: number; height: number }>();

  const defaultTemplate=getDefaultPackagingTemplate();
  if(!defaultTemplate)throw new Error('No default packaging template is configured.');
  const defaultRuntime=requireTemplateRuntime(defaultTemplate.id);
  if(!defaultTemplate.defaultDimensions)throw new Error(`Default template ${defaultTemplate.id} is missing dimensions.`);
  let scene: Scene = {
    dimensions: defaultRuntime.sanitizeParameters(defaultTemplate.defaultDimensions),
    templateId: defaultTemplate.id,
    opening: 0,
    formation: 100,
    openingMode: 'closed',
    splitTopHingeSide: 'side_a',
    material: 'Soft touch',
    outsideColor: null,
    insideColor: null,
    artworkByPanel: {},
    yaw: -0.55,
    pitch: 0.28,
    zoom: 82,
    viewPan:{x:0,y:0},
    lightIntensity: 0,
    hoverPanel: null,
  };

  const render = () => {
    resize();
    const { width, height, depth } = scene.dimensions;
    const maxDimension = Math.max(width, height, depth);
    const aspect = Math.max(0.1, canvas.width / canvas.height);
    const viewProjection = studioViewProjection(
      maxDimension,aspect,scene.yaw,scene.pitch,scene.zoom,
      2*scene.viewPan.x/Math.max(1,canvas.clientWidth),
      -2*scene.viewPan.y/Math.max(1,canvas.clientHeight),
    );
    const materialBase = materialColor(scene.material);
    const outsideBase = scene.outsideColor ? hexToRgb(scene.outsideColor) : materialBase;
    const insideBase = scene.insideColor ? hexToRgb(scene.insideColor) : materialInteriorColor(scene.material);
    const meshes = buildMeshes(scene.dimensions, scene.opening, outsideBase, insideBase,{templateId:scene.templateId,formation:scene.formation,openingMode:scene.openingMode,splitTopHingeSide:scene.splitTopHingeSide});

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const stride = 8 * 4;
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normalLocation);
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, stride, 6 * 4);

    gl.uniformMatrix4fv(viewProjectionLocation, false, viewProjection);
    gl.uniform3f(lightLocation, -0.45, 0.8, 0.55);
    gl.uniform1f(lightIntensityLocation, clamp(scene.lightIntensity, 0, 1));
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(textureLocation, 0);

    for (const mesh of meshes) {
      if(mesh.doubleSided) gl.disable(gl.CULL_FACE);
      else {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
      }
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
      gl.uniformMatrix4fv(modelLocation, false, mesh.model ?? identity4());
      gl.uniform3fv(colorLocation, mesh.color);

      const artworkKey=mesh.panel&&scene.artworkByPanel[mesh.panel]?mesh.panel:mesh.fallbackPanel;
      const textureEntry = artworkKey ? panelTextures.get(artworkKey) : undefined;
      const placement = artworkKey ? scene.artworkByPanel[artworkKey] : undefined;
      const faceUv=artworkKey===mesh.fallbackPanel?mesh.fallbackUv:undefined;
      gl.uniform4f(faceUvLocation,...(faceUv??[0,0,1,1]));
      const shouldUseTexture = !!mesh.useTexture && !!textureEntry?.loaded && !!placement;
      if (shouldUseTexture && textureEntry && placement) {
        gl.bindTexture(gl.TEXTURE_2D, textureEntry.texture);
        const transform = textureTransform(placement, textureEntry.width / textureEntry.height, faceUv ? (mesh.faceAspect??1)/2 : mesh.faceAspect ?? 1);
        gl.uniform2f(uvScaleLocation, transform.scaleX, transform.scaleY);
        gl.uniform2f(uvOffsetLocation, transform.offsetX, transform.offsetY);
        gl.uniform1f(uvRotationLocation, placement.rotation * Math.PI / 180);
        gl.uniform1i(tileLocation, placement.mode === 'tile' ? 1 : 0);
        gl.uniform1i(clipLocation, placement.mode === 'fit' ? 1 : 0);
        const crop = placement.crop;
        if (crop) {
          gl.uniform4f(uvCropLocation, crop.x, 1 - crop.y - crop.height, crop.width, crop.height);
        } else {
          gl.uniform4f(uvCropLocation, 0, 0, 1, 1);
        }
      } else {
        gl.uniform2f(uvScaleLocation, 1, 1);
        gl.uniform2f(uvOffsetLocation, 0, 0);
        gl.uniform1f(uvRotationLocation, 0);
        gl.uniform1i(tileLocation, 0);
        gl.uniform1i(clipLocation, 0);
        gl.uniform4f(uvCropLocation, 0, 0, 1, 1);
      }

      const isHovered = !!mesh.panel && mesh.panel === scene.hoverPanel;
      gl.uniform3f(overlayColorLocation, 0.0, 0.46, 0.77);
      gl.uniform1f(overlayAlphaLocation, isHovered ? 0.10 : 0.0);
      gl.uniform1f(outlineAlphaLocation, isHovered ? 0.72 : 0.0);

      gl.uniform1i(useTextureLocation, shouldUseTexture ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.vertices.length / 8);
    }
  };

  const resize = () => {
    const ratio = Math.min(3, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  const syncPanelTextures = (artworkByPanel: ArtworkByPanel) => {
    const activePanels = new Set(Object.keys(artworkByPanel));

    for (const [panel, entry] of panelTextures) {
      if (!activePanels.has(panel)) {
        gl.deleteTexture(entry.texture);
        panelTextures.delete(panel);
      }
    }

    for (const [panel, artwork] of Object.entries(artworkByPanel)) {
      const url = artwork.url;
      const current = panelTextures.get(panel);
      if (current?.url === url) continue;

      const texture = current?.texture ?? gl.createTexture();
      if (!texture) continue;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if(!current?.loaded) uploadPlaceholderTexture(gl);

      const entry = { texture, url, loaded: current?.loaded ?? false, width: current?.width ?? 1, height: current?.height ?? 1 };
      panelTextures.set(panel, entry);

      const image = new Image();
      image.onload = () => {
        const latest = panelTextures.get(panel);
        if (latest !== entry) return;
        gl.bindTexture(gl.TEXTURE_2D, latest.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        latest.loaded = true;
        latest.width = image.naturalWidth || image.width || 1;
        latest.height = image.naturalHeight || image.height || 1;
        render();
      };
      image.onerror = () => {
        const latest = panelTextures.get(panel);
        if (latest === entry && !current?.loaded) latest.loaded = false;
        render();
      };
      image.src = url;
    }
  };

  return {
    setScene(next: Scene) {
      const previousUrls = artworkUrlSignature(scene.artworkByPanel);
      const nextUrls = artworkUrlSignature(next.artworkByPanel);
      const runtime=requireTemplateRuntime(next.templateId);
      scene = {...next,dimensions:runtime.sanitizeParameters(next.dimensions)};
      if (previousUrls !== nextUrls) syncPanelTextures(next.artworkByPanel);
      render();
    },
    render,
    pickPanel(localX: number, localY: number) {
      const { width, height, depth } = scene.dimensions;
      const maxDimension = Math.max(width, height, depth);
      const aspect = Math.max(0.1, canvas.width / canvas.height);
      const viewProjection = studioViewProjection(
        maxDimension,aspect,scene.yaw,scene.pitch,scene.zoom,
        2*scene.viewPan.x/Math.max(1,canvas.clientWidth),
        -2*scene.viewPan.y/Math.max(1,canvas.clientHeight),
      );
      const materialBase = materialColor(scene.material);
      const outsideBase = scene.outsideColor ? hexToRgb(scene.outsideColor) : materialBase;
      const insideBase = scene.insideColor ? hexToRgb(scene.insideColor) : materialInteriorColor(scene.material);
      const meshes = buildMeshes(scene.dimensions, scene.opening, outsideBase, insideBase,{templateId:scene.templateId,formation:scene.formation,openingMode:scene.openingMode,splitTopHingeSide:scene.splitTopHingeSide})
        .filter(mesh => mesh.panel && mesh.pickCorners);

      const hits = meshes.map(mesh => {
        const model = mesh.model ?? identity4();
        const projected = mesh.pickCorners!.map(point => projectPoint(point, model, viewProjection, canvas.clientWidth, canvas.clientHeight));
        if (!projected.every(Boolean)) return null;
        const polygon = projected as [number, number, number][];
        if (!pointInPolygon(localX, localY, polygon)) return null;
        const depth = polygon.reduce((sum, point) => sum + point[2], 0) / polygon.length;
        return { panel: mesh.panel!, depth };
      }).filter((hit): hit is { panel: string; depth: number } => !!hit);

      hits.sort((a, b) => a.depth - b.depth);
      return hits[0]?.panel ?? null;
    },
    resize() {
      resize();
      render();
    },
    dispose() {
      gl.deleteBuffer(buffer);
      for (const entry of panelTextures.values()) gl.deleteTexture(entry.texture);
      panelTextures.clear();
      gl.deleteProgram(program);
    },
  };
}

export type BoxMeshOptions={templateId?:string;formation?:number;openingMode?:LegacyOpeningMode;splitTopHingeSide?:'side_a'|'side_b'};

export function buildMeshes(
  dimensions: CartonDimensions,
  opening: number,
  color: [number, number, number],
  interiorColor: [number, number, number],
  options:BoxMeshOptions={},
): Mesh[] {
  const templateId=options.templateId ?? getDefaultPackagingTemplate()?.id;
  if(!templateId)throw new Error('No packaging template is available for rendering.');
  const runtime=requireTemplateRuntime(templateId);
  const sanitized=runtime.sanitizeParameters(dimensions);
  switch(runtime.rendererKey){
    case 'base-box-v1':
      return buildLegacyBoxMeshes(sanitized,options.formation??100,opening,color,interiorColor,options.openingMode??runtime.assembly.defaultOpeningMode,options.splitTopHingeSide??'side_a',false);
    case 'split-top-box-v1':
      return buildLegacyBoxMeshes(sanitized,options.formation??100,opening,color,interiorColor,options.openingMode??runtime.assembly.defaultOpeningMode,options.splitTopHingeSide??'side_a',true);
    case 'reverse-tuck-v1':
      return buildReverseTuckMeshes(sanitized,options.formation??opening,color,interiorColor);
    default:
      throw new Error(`No 3D renderer is registered for template renderer: ${runtime.rendererKey}`);
  }
}

function buildLegacyBoxMeshes(
  dimensions:CartonDimensions,
  formation:number,
  opening:number,
  color:[number,number,number],
  interiorColor:[number,number,number],
  openingMode:LegacyOpeningMode,
  splitTopHingeSide:'side_a'|'side_b',
  splitTop:boolean,
):Mesh[]{
  const d=sanitizeCartonDimensions(dimensions),w=d.width,h=d.height,depth=d.depth;
  const formationT=clamp(formation,0,100)/100;
  const openingT=clamp(opening,0,100)/100;
  const foldAngle=formationT*(Math.PI/2);
  const x0=-w/2,x1=w/2,y0=-h/2,y1=h/2,z0=-depth/2,z1=depth/2;

  const rotateY=(p:number[],pivot:number[],theta:number)=>{
    const x=p[0]-pivot[0],z=p[2]-pivot[2],c=Math.cos(theta),si=Math.sin(theta);
    return [pivot[0]+x*c+z*si,p[1],pivot[2]-x*si+z*c];
  };
  const rotateAroundAxis=(p:number[],a:number[],b:number[],theta:number)=>{
    const axis=normalize3([b[0]-a[0],b[1]-a[1],b[2]-a[2]]);
    const v=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
    const c=Math.cos(theta),s=Math.sin(theta),dot=dot3(axis,v),cross=cross3(axis,v);
    return [
      a[0]+v[0]*c+cross[0]*s+axis[0]*dot*(1-c),
      a[1]+v[1]*c+cross[1]*s+axis[1]*dot*(1-c),
      a[2]+v[2]*c+cross[2]*s+axis[2]*dot*(1-c),
    ];
  };
  const transformAll=(corners:number[][],fn:(p:number[])=>number[])=>corners.map(fn);

  const flatPanels=(splitTop?splitTopBoxPanels(d,splitTopHingeSide):baseBoxPanels(d,openingMode));
  const frontFlat=flatPanels.find(panel=>panel.id==='front')!;
  const flatCornerMap=new Map<string,number[][]>();
  for(const panel of flatPanels){
    const name=panel.label.toLowerCase().split(' ').map(part=>part[0].toUpperCase()+part.slice(1)).join(' ');
    flatCornerMap.set(name,[
      [panel.x-frontFlat.x-w/2,h/2-(panel.y+panel.height-frontFlat.y),z1],
      [panel.x+panel.width-frontFlat.x-w/2,h/2-(panel.y+panel.height-frontFlat.y),z1],
      [panel.x+panel.width-frontFlat.x-w/2,h/2-(panel.y-frontFlat.y),z1],
      [panel.x-frontFlat.x-w/2,h/2-(panel.y-frontFlat.y),z1],
    ]);
  }

  // Fold the body as a real four-panel strip. Every intermediate state is a
  // rigid rotation around a scored crease; no corner is linearly interpolated.
  const frontRightHinge=[x1,0,z1],frontLeftHinge=[x0,0,z1];
  const rightBackFlat=[x1+depth,0,z1];
  const leftGlueFlat=[x0-depth,0,z1];

  const bodyTransform=(name:string,p:number[])=>{
    if(name==='Front')return [...p];
    if(name==='Right')return rotateY(p,frontRightHinge,foldAngle);
    if(name==='Back'){
      const first=rotateY(p,frontRightHinge,foldAngle);
      const hinge=rotateY(rightBackFlat,frontRightHinge,foldAngle);
      return rotateY(first,hinge,foldAngle);
    }

    if(splitTop){
      // Split Top's production net is Front -> Right -> Back -> Left.
      // Left is therefore the third hinged panel in the chain, not a panel
      // directly attached to Front as it is in the legacy Base Box net.
      if(name==='Left'){
        const leftFlat=flatCornerMap.get('Left');
        if(!leftFlat)return [...p];
        const backFlat=flatCornerMap.get('Back');
        if(!backFlat)return [...p];
        const backLeftFlat=[backFlat[1][0],0,z1];

        const first=rotateY(p,frontRightHinge,foldAngle);
        const rightBackHinge=rotateY(rightBackFlat,frontRightHinge,foldAngle);
        const second=rotateY(first,rightBackHinge,foldAngle);

        const backLeftAfterFirst=rotateY(backLeftFlat,frontRightHinge,foldAngle);
        const backLeftHinge=rotateY(backLeftAfterFirst,rightBackHinge,foldAngle);
        return rotateY(second,backLeftHinge,foldAngle);
      }
      if(name==='Glue'){
        // The split-top glue tab is attached directly to Front's left crease.
        return rotateY(p,frontLeftHinge,-foldAngle);
      }
    }else{
      if(name==='Left')return rotateY(p,frontLeftHinge,-foldAngle);
      if(name==='Glue'){
        const first=rotateY(p,frontLeftHinge,-foldAngle);
        const hinge=rotateY(leftGlueFlat,frontLeftHinge,-foldAngle);
        return rotateY(first,hinge,-foldAngle);
      }
    }
    return [...p];
  };

  const bodyCorners=(name:string)=>transformAll(flatCornerMap.get(name)??[],p=>bodyTransform(name,p));
  const frontCorners=bodyCorners('Front');
  const backCorners=bodyCorners('Back');
  let leftCorners=bodyCorners('Left');
  let rightCorners=bodyCorners('Right');

  // Door modes articulate an already folding rigid wall around its actual
  // front vertical crease. Scaling by formation keeps the 0% state identical
  // to the physical flat dieline instead of twisting a flat sheet in 3D.
  const doorAngle=openingT*formationT*(Math.PI/2);
  if((openingMode==='door_left'||openingMode==='double_doors')&&leftCorners.length){
    const hingeA=frontCorners[0],hingeB=frontCorners[3];
    leftCorners=transformAll(leftCorners,p=>rotateAroundAxis(p,hingeA,hingeB,doorAngle));
  }
  if((openingMode==='door_right'||openingMode==='double_doors')&&rightCorners.length){
    const hingeA=frontCorners[1],hingeB=frontCorners[2];
    rightCorners=transformAll(rightCorners,p=>rotateAroundAxis(p,hingeA,hingeB,-doorAngle));
  }

  const panels:{name:string;corners:number[][]}[]=[
    {name:'Front',corners:frontCorners},
    {name:'Back',corners:backCorners},
    {name:'Left',corners:leftCorners},
    {name:'Right',corners:rightCorners},
  ];

  const foldFlap=(name:string,parent:string,edge:'top'|'bottom',theta:number)=>{
    const flat=flatCornerMap.get(name);
    if(!flat)return null;
    const parentTransformed=transformAll(flat,p=>bodyTransform(parent,p));
    const hingeIndices=edge==='top'?[0,1]:[3,2];
    const a=bodyTransform(parent,flat[hingeIndices[0]]);
    const b=bodyTransform(parent,flat[hingeIndices[1]]);
    return transformAll(parentTransformed,p=>rotateAroundAxis(p,a,b,theta));
  };

  // Bottom closures fold while the body is being erected.
  if(splitTop){
    const bottomFront=foldFlap('Bottom Front','Front','bottom',foldAngle);
    const bottomBack=foldFlap('Bottom Back','Back','bottom',foldAngle);
    if(bottomFront)panels.push({name:'Bottom Front',corners:bottomFront});
    if(bottomBack)panels.push({name:'Bottom Back',corners:bottomBack});

    // At 70% assembly the carton is formed with both top flaps physically
    // upright. The final 30% closes them around their own front/back creases.
    const closeAngle=(1-openingT)*(Math.PI/2);
    const topParents=splitTopHingeSide==='side_a'
      ? {left:'Left',right:'Right'}
      : {left:'Front',right:'Back'};
    const topLeft=foldFlap('Top Left',topParents.left,'top',-closeAngle);
    const topRight=foldFlap('Top Right',topParents.right,'top',-closeAngle);
    if(topLeft)panels.push({name:'Top Left',corners:topLeft});
    if(topRight)panels.push({name:'Top Right',corners:topRight});
  }else{
    const bottom=foldFlap('Bottom','Front','bottom',foldAngle);
    if(bottom)panels.push({name:'Bottom',corners:bottom});

    const topParent=openingMode==='lid_from_back'?'Back'
      :openingMode==='lid_from_left'?'Left'
        :openingMode==='lid_from_right'?'Right'
          :'Front';
    // Fixed tops close as the carton forms. Hinged lids remain coplanar/open
    // through formation and only close during the opening stage.
    const hasSeparateOpening=openingMode!=='closed'&&!openingMode.startsWith('door_')&&openingMode!=='double_doors';
    const topCloseT=hasSeparateOpening?(1-openingT):formationT;
    const top=foldFlap('Top',topParent,'top',-topCloseT*(Math.PI/2));
    if(top)panels.push({name:'Top',corners:top});
  }

  const result:Mesh[]=[];
  if(formationT<.999){
    const glueCorners=bodyCorners('Glue');
    if(glueCorners.length){
      resultGlue(glueCorners);
    }
  }

  function resultGlue(glueCorners:number[][]){
    result.push(quadFromCorners(glueCorners,color,true,'Glue'));
    const glueNormal=faceNormal(glueCorners),offset=Math.max(0.02,Math.min(2,d.thickness));
    const glueInner=glueCorners.map(p=>[p[0]-glueNormal[0]*offset,p[1]-glueNormal[1]*offset,p[2]-glueNormal[2]*offset]);
    result.push(quadFromCorners([glueInner[3],glueInner[2],glueInner[1],glueInner[0]],interiorColor,true,'Interior Glue'));
  }

  for(const panel of panels){
    const formedCorners=panel.corners;
    const outer=quadFromCorners(formedCorners,color,true,panel.name);
    if(splitTop&&panel.name.startsWith('Bottom ')){
      outer.fallbackPanel='Bottom';
      outer.fallbackUv=[0,panel.name==='Bottom Front'?.5:0,1,.5];
    }
    result.push(outer);
    const normal=faceNormal(formedCorners),offset=Math.max(0.02,Math.min(2,d.thickness));
    const innerCorners=formedCorners.map(p=>[p[0]-normal[0]*offset,p[1]-normal[1]*offset,p[2]-normal[2]*offset]);
    const inner=quadFromCorners([innerCorners[3],innerCorners[2],innerCorners[1],innerCorners[0]],interiorColor,true,`Interior ${panel.name}`);
    if(outer.fallbackPanel){inner.fallbackPanel='Interior Bottom';inner.fallbackUv=outer.fallbackUv;}
    result.push(inner);
  }
  return result;
}

function buildReverseTuckMeshes(
  dimensions: CartonDimensions,
  opening: number,
  color: [number, number, number],
  interiorColor: [number, number, number],
): Mesh[] {
  dimensions=sanitizeCartonDimensions(dimensions);
  const { width: w, height: h, depth: d } = dimensions;
  const footprint=reverseTuckPanels(dimensions);
  const t = clamp(dimensions.thickness, 0.3, Math.min(w, d) * 0.08);
  const fold = reverseTuckFoldState(opening);
  const wallAngle = fold.walls * Math.PI / 2;
  const backAngle = fold.back * Math.PI / 2;
  const topAngle = fold.top * Math.PI / 2;
  const bottomAngle = fold.bottom * Math.PI / 2;

  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const zFront = d / 2;

  // Exterior faces intentionally share the exact same base color. The default
  // studio view is a color-proofing view, not a photographic render: rotating
  // the carton must not make one printed face appear darker or lighter simply
  // because its normal points away from a virtual key light.
  const interior: [number, number, number] = interiorColor;

  const frontCorners = [
    [x0, y0, zFront],
    [x1, y0, zFront],
    [x1, y1, zFront],
    [x0, y1, zFront],
  ];

  const leftOuterX = x0 - d * Math.cos(wallAngle);
  const leftOuterZ = zFront - d * Math.sin(wallAngle);
  const leftCorners = [
    [leftOuterX, y0, leftOuterZ],
    [x0, y0, zFront],
    [x0, y1, zFront],
    [leftOuterX, y1, leftOuterZ],
  ];

  const rightOuterX = x1 + d * Math.cos(wallAngle);
  const rightOuterZ = zFront - d * Math.sin(wallAngle);
  const rightCorners = [
    [x1, y0, zFront],
    [rightOuterX, y0, rightOuterZ],
    [rightOuterX, y1, rightOuterZ],
    [x1, y1, zFront],
  ];

  const backDirectionAngle = wallAngle + backAngle;
  const backDx = Math.cos(backDirectionAngle);
  const backDz = -Math.sin(backDirectionAngle);
  const backFarX = rightOuterX + w * backDx;
  const backFarZ = rightOuterZ + w * backDz;
  const backCorners = [
    [rightOuterX, y0, rightOuterZ],
    [backFarX, y0, backFarZ],
    [backFarX, y1, backFarZ],
    [rightOuterX, y1, rightOuterZ],
  ];

  const topOuterY = y1 + d * Math.cos(topAngle);
  const topOuterZ = zFront - d * Math.sin(topAngle);
  const topCorners = [
    [x0, y1, zFront],
    [x1, y1, zFront],
    [x1, topOuterY, topOuterZ],
    [x0, topOuterY, topOuterZ],
  ];

  const bottomOuterY = y0 - d * Math.cos(bottomAngle);
  const bottomOuterZ = zFront - d * Math.sin(bottomAngle);
  const bottomCorners = [
    [x0, bottomOuterY, bottomOuterZ],
    [x1, bottomOuterY, bottomOuterZ],
    [x1, y0, zFront],
    [x0, y0, zFront],
  ];

  const glueWidth=footprint.find(item=>item.id==='glue')!.width;
  const glueAngle=wallAngle+backAngle;
  const glueFarX=leftOuterX-glueWidth*Math.cos(glueAngle);
  const glueFarZ=leftOuterZ+glueWidth*Math.sin(glueAngle);
  // The glue strip sits inside the back wall when fully folded.
  const glueInset=t*fold.back*2;
  const glueCorners=[
    [glueFarX,y0,glueFarZ+glueInset],
    [leftOuterX,y0,leftOuterZ+glueInset],
    [leftOuterX,y1,leftOuterZ+glueInset],
    [glueFarX,y1,glueFarZ+glueInset],
  ];

  const panels: Array<{
    name: string;
    corners: number[][];
    surfaceColor: [number, number, number];
    aspect: number;
  }> = [
    { name: 'Glue', corners: glueCorners, surfaceColor: color, aspect: glueWidth/h },
    { name: 'Front', corners: frontCorners, surfaceColor: color, aspect: w / h },
    { name: 'Left', corners: leftCorners, surfaceColor: color, aspect: d / h },
    { name: 'Right', corners: rightCorners, surfaceColor: color, aspect: d / h },
    { name: 'Back', corners: backCorners, surfaceColor: color, aspect: w / h },
    { name: 'Top', corners: topCorners, surfaceColor: color, aspect: w / d },
    { name: 'Bottom', corners: bottomCorners, surfaceColor: color, aspect: w / d },
  ];

  const exteriorMeshes: Mesh[] = [];
  const interiorMeshes: Mesh[] = [];
  const edgeMeshes: Mesh[] = [];
  // At a fully closed fold the exterior panels meet each other and cover the
  // board thickness. Drawing a thickness wall around every panel in that state
  // stacks tiny perpendicular strips at each carton corner, which shows up as
  // the dark/hatched seams seen on closed previews. Keep thickness geometry for
  // open/intermediate folds, where a cut board edge is genuinely exposed.
  const showExposedBoardEdges = opening < 99.5;
  const edgeGeometryKeys=new Set<string>();

  const edgeGeometryKey=(corners:number[][])=>corners
    .map(point=>point.map(value=>Math.round(value*1e6)/1e6).join(','))
    .sort()
    .join('|');

  for (const panel of panels) {
    const exterior = quadFromCorners(panel.corners, panel.surfaceColor, true, panel.name);
    const netPanel=footprint.find(item=>item.label.toLowerCase()===panel.name.toLowerCase())!;
    exterior.faceAspect = netPanel.width/netPanel.height;
    exteriorMeshes.push(exterior);

    const normal = faceNormal(panel.corners);
    const insideCorners = panel.corners.map(point => [
      point[0] - normal[0] * t,
      point[1] - normal[1] * t,
      point[2] - normal[2] * t,
    ]);
    const reversed = [insideCorners[3], insideCorners[2], insideCorners[1], insideCorners[0]];
    const inside = quadFromCorners(reversed, interior, true, `Interior ${panel.name}`);
    inside.faceAspect = exterior.faceAspect;
    interiorMeshes.push(inside);

    const edgeColor: [number, number, number] = [
      Math.max(0, Math.min(1, panel.surfaceColor[0] * 0.72)),
      Math.max(0, Math.min(1, panel.surfaceColor[1] * 0.72)),
      Math.max(0, Math.min(1, panel.surfaceColor[2] * 0.72)),
    ];

    if (!showExposedBoardEdges) continue;

    for (let index = 0; index < 4; index += 1) {
      const nextIndex = (index + 1) % 4;
      const edgeCorners = [
        panel.corners[index],
        panel.corners[nextIndex],
        insideCorners[nextIndex],
        insideCorners[index],
      ];

      // A board edge is one physical surface. Rendering a second reversed
      // quad in exactly the same plane causes depth-buffer contention and
      // flickering/fuzzy seams. Draw one mesh with culling disabled instead.
      const geometryKey=edgeGeometryKey(edgeCorners);
      if(!edgeGeometryKeys.has(geometryKey)){
        edgeGeometryKeys.add(geometryKey);
        const edgeMesh=quadFromCorners(edgeCorners, edgeColor, false);
        edgeMesh.doubleSided=true;
        edgeMeshes.push(edgeMesh);
      }
    }
  }

  return [...exteriorMeshes, ...interiorMeshes, ...edgeMeshes];
}

function quadFromCorners(
  corners: number[][],
  color: [number, number, number],
  useTexture = false,
  panel?: string,
): Mesh {
  const normal = faceNormal(corners);
  return quad(corners[0], corners[1], corners[2], corners[3], normal, color, useTexture, panel);
}

function faceNormal(corners: number[][]): [number, number, number] {
  const a = corners[0], b = corners[1], d = corners[3];
  const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const ad = [d[0]-a[0], d[1]-a[1], d[2]-a[2]];
  const cross = [
    ab[1] * ad[2] - ab[2] * ad[1],
    ab[2] * ad[0] - ab[0] * ad[2],
    ab[0] * ad[1] - ab[1] * ad[0],
  ];
  const length = Math.hypot(cross[0], cross[1], cross[2]) || 1;
  return [cross[0] / length, cross[1] / length, cross[2] / length];
}

function quad(
  a: number[], b: number[], c: number[], d: number[],
  normal: [number, number, number],
  color: [number, number, number],
  useTexture = false,
  panel?: string,
): Mesh {
  const vertices = [
    ...vertex(a, normal, [0,0]), ...vertex(b, normal, [1,0]), ...vertex(c, normal, [1,1]),
    ...vertex(a, normal, [0,0]), ...vertex(c, normal, [1,1]), ...vertex(d, normal, [0,1]),
  ];
  const edge1 = Math.hypot(b[0]-a[0], b[1]-a[1], b[2]-a[2]);
  const edge2 = Math.hypot(d[0]-a[0], d[1]-a[1], d[2]-a[2]);
  return {
    vertices: new Float32Array(vertices),
    useTexture,
    color,
    panel,
    pickCorners: panel ? [a,b,c,d] : undefined,
    faceAspect: edge2 > 0 ? edge1 / edge2 : 1,
  };
}

function vertex(position: number[], normal: number[], uv: number[]) {
  return [...position, ...normal, ...uv];
}

function uploadPlaceholderTexture(gl: WebGLRenderingContext) {
  gl.bindTexture(gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D));
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([
      242,246,249,255, 242,246,249,255,
      242,246,249,255, 242,246,249,255,
    ]),
  );
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
uniform mat4 uViewProjection;
uniform mat4 uModel;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  gl_Position = uViewProjection * world;
  vNormal = mat3(uModel) * aNormal;
  vUv = aUv;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
varying vec3 vNormal;
varying vec2 vUv;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform float uLightIntensity;
uniform bool uUseTexture;
uniform sampler2D uTexture;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform float uUvRotation;
uniform bool uTile;
uniform bool uClipOutside;
uniform vec4 uUvCrop;
uniform vec4 uFaceUv;
uniform vec3 uOverlayColor;
uniform float uOverlayAlpha;
uniform float uOutlineAlpha;
void main() {
  vec3 normal = normalize(vNormal);
  float diffuse = max(0.0, dot(normal, normalize(uLightDirection)));
  // Zero is the default "true color" proofing mode: no directional shading,
  // no artificial face darkening, and therefore no perceived cast shadow.
  // A future scene/lighting control can blend directional modeling back in.
  float directionalLight = 0.52 + diffuse * 0.48;
  float light = mix(1.0, directionalLight, uLightIntensity);

  vec2 centered = (uFaceUv.xy + vUv * uFaceUv.zw) - vec2(0.5) - uUvOffset;
  float c = cos(uUvRotation);
  float s = sin(uUvRotation);
  vec2 rotated = mat2(c, -s, s, c) * centered;
  vec2 texUv = rotated / uUvScale + vec2(0.5);
  bool outside = texUv.x < 0.0 || texUv.x > 1.0 || texUv.y < 0.0 || texUv.y > 1.0;
  if (uTile) texUv = fract(texUv);
  texUv = uUvCrop.xy + texUv * uUvCrop.zw;

  vec4 materialBase = vec4(uColor, 1.0);
  vec4 base = materialBase;
  if (uUseTexture && !(uClipOutside && outside)) {
    vec4 artwork = texture2D(uTexture, texUv);
    // Artwork is a printed layer over the package material. Transparent pixels
    // reveal the underlying board/finish instead of making the face disappear.
    base.rgb = mix(materialBase.rgb, artwork.rgb, artwork.a);
    base.a = 1.0;
  }

  vec3 shaded = base.rgb * light;
  shaded = mix(shaded, uOverlayColor, uOverlayAlpha);

  float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float edge = 1.0 - smoothstep(0.002, 0.012, edgeDistance);
  shaded = mix(shaded, uOverlayColor, edge * uOutlineAlpha);

  gl_FragColor = vec4(shaded, base.a);
}
`;

function artworkUrlSignature(artworkByPanel: ArtworkByPanel) {
  return Object.keys(artworkByPanel)
    .sort()
    .map(panel => `${panel}:${artworkByPanel[panel]?.url ?? ''}`)
    .join('|');
}

function textureTransform(
  placement: ArtworkPlacement,
  imageAspect: number,
  faceAspect: number,
) {
  if(placement.panelTexture) return {scaleX:1,scaleY:1,offsetX:0,offsetY:0};
  let scaleX = 1;
  let scaleY = 1;

  if (placement.mode === 'fill') {
    if (imageAspect > faceAspect) scaleX = imageAspect / faceAspect;
    else scaleY = faceAspect / imageAspect;
  } else if (placement.mode === 'fit') {
    if (imageAspect > faceAspect) scaleY = faceAspect / imageAspect;
    else scaleX = imageAspect / faceAspect;
  }

  const userScale = Math.max(0.25, placement.scale / 100);
  scaleX *= userScale;
  scaleY *= userScale;

  if (placement.mode === 'tile') {
    const tileScale = Math.max(0.2, 100 / Math.max(25, placement.scale));
    scaleX = tileScale;
    scaleY = tileScale;
  }

  const overflowX = Math.max(0, 1 - 1 / Math.max(scaleX, 1e-5));
  const overflowY = Math.max(0, 1 - 1 / Math.max(scaleY, 1e-5));
  const offsetX = placement.alignX * overflowX * 0.5;
  const offsetY = -placement.alignY * overflowY * 0.5;

  return { scaleX, scaleY, offsetX, offsetY };
}

function materialColor(material: string): [number, number, number] {
  switch (material) {
    case 'Kraft': return [0.64, 0.47, 0.29];
    case 'White board': return [0.92, 0.93, 0.94];
    case 'Matte coated': return [0.82, 0.86, 0.89];
    case 'Gloss coated': return [0.77, 0.84, 0.9];
    case 'Foil': return [0.78, 0.64, 0.3];
    default: return [0.78, 0.83, 0.87];
  }
}

function materialInteriorColor(material: string): [number, number, number] {
  const base = materialColor(material);
  return base.map(value => Math.min(1, value * 0.92 + 0.08)) as [number, number, number];
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return [1, 1, 1];
  return [
    parseInt(expanded.slice(0, 2), 16) / 255,
    parseInt(expanded.slice(2, 4), 16) / 255,
    parseInt(expanded.slice(4, 6), 16) / 255,
  ];
}

function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function cameraForPreset(preset: string) {
  switch (preset) {
    case 'Front': return { yaw: 0, pitch: 0 };
    case 'Back': return { yaw: Math.PI, pitch: 0 };
    case 'Left': return { yaw: -Math.PI / 2, pitch: 0 };
    case 'Right': return { yaw: Math.PI / 2, pitch: 0 };
    case 'Top': return { yaw: -0.15, pitch: 1.12 };
    case 'LegacyPerspective': return { yaw: 0.7568345056, pitch: 0.4180918584 };
    default: return { yaw: -0.55, pitch: 0.28 };
  }
}

function orbitEye(distance: number, yaw: number, pitch: number): [number, number, number] {
  const cosPitch = Math.cos(pitch);
  return [
    Math.sin(yaw) * cosPitch * distance,
    Math.sin(pitch) * distance,
    Math.cos(yaw) * cosPitch * distance,
  ];
}

function identity4() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    0,0,0,1,
  ]);
}

function translation4(x: number, y: number, z: number) {
  const out = identity4();
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

function rotationX4(angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return new Float32Array([
    1,0,0,0,
    0,c,s,0,
    0,-s,c,0,
    0,0,0,1,
  ]);
}

function perspective(fov: number, aspect: number, near: number, far: number, zoomScale = 1) {
  const f = zoomScale / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect,0,0,0,
    0,f,0,0,
    0,0,(far + near) * nf,-1,
    0,0,(2 * far * near) * nf,0,
  ]);
}

function lookAt(eye: number[], center: number[], up: number[]) {
  const z = normalize3([eye[0]-center[0], eye[1]-center[1], eye[2]-center[2]]);
  const x = normalize3(cross3(up, z));
  const y = cross3(z, x);
  return new Float32Array([
    x[0],y[0],z[0],0,
    x[1],y[1],z[1],0,
    x[2],y[2],z[2],0,
    -dot3(x,eye),-dot3(y,eye),-dot3(z,eye),1,
  ]);
}

function multiply4(a: Float32Array, b: Float32Array) {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function projectPoint(
  point: number[],
  model: Float32Array,
  viewProjection: Float32Array,
  width: number,
  height: number,
): [number, number, number] | null {
  const world = multiplyVec4(model, [point[0], point[1], point[2], 1]);
  const clip = multiplyVec4(viewProjection, world);
  if (Math.abs(clip[3]) < 1e-6) return null;
  const ndcX = clip[0] / clip[3];
  const ndcY = clip[1] / clip[3];
  const ndcZ = clip[2] / clip[3];
  return [
    (ndcX * 0.5 + 0.5) * width,
    (1 - (ndcY * 0.5 + 0.5)) * height,
    ndcZ,
  ];
}

function multiplyVec4(matrix: Float32Array, vector: number[]) {
  return [
    matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
    matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
    matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
    matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
  ];
}

function pointInPolygon(x: number, y: number, polygon: [number, number, number][]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function normalize3(v: number[]) {
  const length = Math.hypot(v[0],v[1],v[2]) || 1;
  return [v[0]/length,v[1]/length,v[2]/length];
}
function cross3(a:number[],b:number[]) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot3(a:number[],b:number[]) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function clamp(value:number,min:number,max:number){ return Math.min(max,Math.max(min,value)); }

/** Shared by drawing and picking. Magnify the lens without moving through the box or clipping distant zoom levels. */
export function studioViewProjection(
  maxDimension:number,
  aspect:number,
  yaw:number,
  pitch:number,
  zoom:number,
  offsetNdcX=0,
  offsetNdcY=0,
) {
  const eye = orbitEye(maxDimension * 2.462, yaw, pitch);
  const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
  // Keep the depth range close to the actual carton. A near plane at 1% of
  // its size loses enough precision to make 0.3–2 mm board edges flicker.
  const projection = perspective(Math.PI / 4.2, aspect, Math.max(0.1, maxDimension * 0.2), maxDimension * 12, zoom / 82);
  if(!offsetNdcX&&!offsetNdcY)return multiply4(projection,view);

  // Translate after perspective projection so the offset is true screen-space
  // panning. This lets wheel zoom keep the point under the cursor stationary.
  const clipTranslation=new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    offsetNdcX,offsetNdcY,0,1,
  ]);
  return multiply4(clipTranslation,multiply4(projection,view));
}
