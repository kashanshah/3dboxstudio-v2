import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { ArtworkByPanel, ArtworkPlacement } from '@/lib/packaging/artwork';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { getDefaultPackagingTemplate } from '@/lib/packaging/template-registry';
import { requireTemplateRuntime } from '@/lib/packaging/template-runtime';
import type { Mesh } from '@/lib/packaging/template-mesh';

// Renderer-independent scene maths shared by the 3D preview, picking and tests.

export type RenderStyle = 'realistic' | 'flat';

export type Scene = {
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
  renderStyle: RenderStyle;
  floorShadow: boolean;
};

export type BoxMeshOptions={templateId?:string;formation?:number;openingMode?:LegacyOpeningMode;splitTopHingeSide?:'side_a'|'side_b'};

export function buildMeshes(
  dimensions:CartonDimensions,
  opening:number,
  color:[number,number,number],
  interiorColor:[number,number,number],
  options:BoxMeshOptions={},
):Mesh[]{
  const templateId=options.templateId??getDefaultPackagingTemplate()?.id;
  if(!templateId)throw new Error('No packaging template is available for rendering.');
  const runtime=requireTemplateRuntime(templateId);
  const sanitized=runtime.sanitizeParameters(dimensions);
  return runtime.buildMeshes({
    dimensions:sanitized,
    opening,
    formation:options.formation??(runtime.assembly.legacyOpeningAsFormation?opening:100),
    openingMode:options.openingMode??runtime.assembly.defaultOpeningMode,
    splitTopHingeSide:options.splitTopHingeSide??'side_a',
    color,
    interiorColor,
  });
}

/** Meshes for a scene, with the material and custom colours applied. */
export function sceneMeshes(scene: Scene) {
  const materialBase = materialColor(scene.material);
  const outsideBase = scene.outsideColor ? hexToRgb(scene.outsideColor) : materialBase;
  const insideBase = scene.insideColor ? hexToRgb(scene.insideColor) : materialInteriorColor(scene.material);
  return buildMeshes(scene.dimensions, scene.opening, outsideBase, insideBase, { templateId: scene.templateId, formation: scene.formation, openingMode: scene.openingMode, splitTopHingeSide: scene.splitTopHingeSide });
}

export function defaultScene(): Scene {
  const defaultTemplate = getDefaultPackagingTemplate();
  if (!defaultTemplate) throw new Error('No default packaging template is configured.');
  const defaultRuntime = requireTemplateRuntime(defaultTemplate.id);
  if (!defaultTemplate.defaultDimensions) throw new Error(`Default template ${defaultTemplate.id} is missing dimensions.`);
  return {
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
    viewPan: { x: 0, y: 0 },
    lightIntensity: 0,
    hoverPanel: null,
    renderStyle: 'realistic',
    floorShadow: true,
  };
}

/** The view and projection the scene is drawn with, for a canvas of the given CSS size. */
export function sceneViewMatrices(scene: Scene, cssWidth: number, cssHeight: number) {
  const { width, height, depth } = scene.dimensions;
  return studioViewMatrices(
    Math.max(width, height, depth), Math.max(0.1, cssWidth / Math.max(1, cssHeight)), scene.yaw, scene.pitch, scene.zoom,
    2 * scene.viewPan.x / Math.max(1, cssWidth),
    -2 * scene.viewPan.y / Math.max(1, cssHeight),
  );
}

/** The printable panel under a canvas point, nearest first. */
export function pickScenePanel(scene: Scene, meshes: Mesh[], localX: number, localY: number, cssWidth: number, cssHeight: number) {
  const { view, projection } = sceneViewMatrices(scene, cssWidth, cssHeight);
  const viewProjection = multiply4(projection, view);
  const hits = meshes.filter(mesh => mesh.panel && mesh.pickCorners).map(mesh => {
    const model = mesh.model ?? identity4();
    const projected = mesh.pickCorners!.map(point => projectPoint(point, model, viewProjection, cssWidth, cssHeight));
    if (!projected.every(Boolean)) return null;
    const polygon = projected as [number, number, number][];
    if (!pointInPolygon(localX, localY, polygon)) return null;
    const depth = polygon.reduce((sum, point) => sum + point[2], 0) / polygon.length;
    return { panel: mesh.panel!, depth };
  }).filter((hit): hit is { panel: string; depth: number } => !!hit);
  hits.sort((a, b) => a.depth - b.depth);
  return hits[0]?.panel ?? null;
}

export function artworkUrlSignature(artworkByPanel: ArtworkByPanel) {
  return Object.keys(artworkByPanel)
    .sort()
    .map(panel => `${panel}:${artworkByPanel[panel]?.url ?? ''}`)
    .join('|');
}

export function textureTransform(
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

export function materialColor(material: string): [number, number, number] {
  switch (material) {
    case 'Kraft': return [0.64, 0.47, 0.29];
    case 'White board': return [0.92, 0.93, 0.94];
    case 'Matte coated': return [0.82, 0.86, 0.89];
    case 'Gloss coated': return [0.77, 0.84, 0.9];
    case 'Foil': return [0.78, 0.64, 0.3];
    default: return [0.78, 0.83, 0.87];
  }
}

export function materialInteriorColor(material: string): [number, number, number] {
  const base = materialColor(material);
  return base.map(value => Math.min(1, value * 0.92 + 0.08)) as [number, number, number];
}

export function hexToRgb(hex: string): [number, number, number] {
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

export function shortestAngleDelta(from: number, to: number) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function cameraForPreset(preset: string) {
  switch (preset) {
    case 'Front': return { yaw: 0, pitch: 0 };
    case 'Back': return { yaw: Math.PI, pitch: 0 };
    case 'Left': return { yaw: -Math.PI / 2, pitch: 0 };
    case 'Right': return { yaw: Math.PI / 2, pitch: 0 };
    case 'Top': return { yaw: -0.15, pitch: 1.12 };
    case 'Hero': return { yaw: -0.62, pitch: 0.07 };
    case 'Back angle': return { yaw: 2.55, pitch: 0.3 };
    case 'Overhead': return { yaw: -0.5, pitch: 0.82 };
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

export function identity4() {
  return new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
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
export function clamp(value:number,min:number,max:number){ return Math.min(max,Math.max(min,value)); }

const STUDIO_FOV = Math.PI / 4.2;
const STUDIO_EYE_DISTANCE = 2.462;

/**
 * The zoom factor (at most 1) that keeps everything within `reach` of the
 * box's centre in view at the default zoom, with a little margin: what an
 * opened lid or the flat sheet needs, since the camera is framed for the
 * closed box (`maxDimension`).
 */
export function studioFitZoom(maxDimension:number,reach:number,aspect:number){
  const distance = maxDimension * STUDIO_EYE_DISTANCE;
  const halfAngle = Math.asin(Math.min(0.99, reach / Math.max(1e-6, distance)));
  const room = Math.tan(STUDIO_FOV / 2) * Math.min(1, aspect) * 0.92;
  return Math.min(1, room / Math.tan(halfAngle));
}

/** How far the furthest vertex of `meshes` lies from the scene's centre. */
export function meshReach(meshes:Mesh[]){
  let reach = 0;
  for (const mesh of meshes) {
    const v = mesh.vertices, m = mesh.model;
    for (let i = 0; i < v.length; i += 8) {
      const [x, y, z] = m
        ? [m[0]*v[i]+m[4]*v[i+1]+m[8]*v[i+2]+m[12], m[1]*v[i]+m[5]*v[i+1]+m[9]*v[i+2]+m[13], m[2]*v[i]+m[6]*v[i+1]+m[10]*v[i+2]+m[14]]
        : [v[i], v[i+1], v[i+2]];
      reach = Math.max(reach, Math.hypot(x, y, z));
    }
  }
  return reach;
}

/** Shared by drawing and picking. Magnify the lens without moving through the box or clipping distant zoom levels. */
export function studioViewMatrices(
  maxDimension:number,
  aspect:number,
  yaw:number,
  pitch:number,
  zoom:number,
  offsetNdcX=0,
  offsetNdcY=0,
) {
  const eye = orbitEye(maxDimension * STUDIO_EYE_DISTANCE, yaw, pitch);
  const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
  // Keep the depth range close to the actual carton. A near plane at 1% of
  // its size loses enough precision to make 0.3–2 mm board edges flicker.
  const projection = perspective(STUDIO_FOV, aspect, Math.max(0.1, maxDimension * 0.2), maxDimension * 12, zoom / 82);
  if(!offsetNdcX&&!offsetNdcY)return {view,projection,eye};

  // Translate after perspective projection so the offset is true screen-space
  // panning. This lets wheel zoom keep the point under the cursor stationary.
  const clipTranslation=new Float32Array([
    1,0,0,0,
    0,1,0,0,
    0,0,1,0,
    offsetNdcX,offsetNdcY,0,1,
  ]);
  return {view,projection:multiply4(clipTranslation,projection),eye};
}

export function studioViewProjection(
  maxDimension:number,
  aspect:number,
  yaw:number,
  pitch:number,
  zoom:number,
  offsetNdcX=0,
  offsetNdcY=0,
) {
  const {view,projection}=studioViewMatrices(maxDimension,aspect,yaw,pitch,zoom,offsetNdcX,offsetNdcY);
  return multiply4(projection,view);
}
