import type { CartonDimensions } from './reverse-tuck';
import { getTemplateGeometry, type TemplateGeometryOptions } from './template-runtime';
import { defaultArtworkPlacement, type ArtworkByPanel } from './artwork';

export type FullDielineTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type FullDielineArtworkLayer = {
  id: string;
  assetId?: string;
  name: string;
  url: string;
  transform: FullDielineTransform;
  aspectRatio: number;
  visible?: boolean;
  opacity?: number;
  /**
   * Panel ids this layer prints on; all panels when absent. Designs moved to a
   * new dieline layout keep printing exactly where they did through this.
   */
  panels?: string[];
};

/** Overlaps thinner than this (millimetres) are rounding, not artwork. */
const OVERLAP_TOLERANCE_MM = 0.05;

/**
 * Whether the layer's rotated box overlaps the panel's box on the sheet. A
 * layer that stops on a crease does not reach the panel beyond it.
 */
export function layerOverlaps(layer: FullDielineArtworkLayer, panel: {x:number;y:number;width:number;height:number}, bounds: {width:number;height:number}) {
  const t = sheetTransformToPhysical(layer.transform, bounds);
  const angle = t.rotation * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * t.width + Math.abs(Math.sin(angle)) * t.height) / 2 - OVERLAP_TOLERANCE_MM;
  const halfHeight = (Math.abs(Math.sin(angle)) * t.width + Math.abs(Math.cos(angle)) * t.height) / 2 - OVERLAP_TOLERANCE_MM;
  return t.centerX + halfWidth > panel.x && t.centerX - halfWidth < panel.x + panel.width
    && t.centerY + halfHeight > panel.y && t.centerY - halfHeight < panel.y + panel.height;
}

export function layerPrintsOn(layer: FullDielineArtworkLayer, panelId: string) {
  return !layer.panels || layer.panels.includes(panelId);
}

export const DEFAULT_FULL_DIELINE_TRANSFORM: FullDielineTransform = {
  x: 50,
  y: 50,
  width: 72,
  height: 72,
  rotation: 0,
};

export function createFullDielineTransform(
  imageAspect: number,
  dielineAspect: number,
  scalePercent = 100,
  rotation = 0,
): FullDielineTransform {
  const targetBox = DEFAULT_FULL_DIELINE_TRANSFORM.width * scalePercent / 100;
  const safeImageAspect = Math.max(0.0001, imageAspect);
  const safeDielineAspect = Math.max(0.0001, dielineAspect);
  let width = targetBox;
  let height = width * safeDielineAspect / safeImageAspect;
  if (height > targetBox) {
    height = targetBox;
    width = height * safeImageAspect / safeDielineAspect;
  }
  return {
    x: 50,
    y: 50,
    width,
    height,
    rotation,
  };
}

/**
 * The artboard: the dieline's bounding box with the bleed added on every
 * side. Artwork made at this size covers every cut edge's bleed.
 */
export function artboardSize(bounds: { width: number; height: number }, bleedMm: number) {
  const bleed = Math.max(0, bleedMm);
  return { width: bounds.width + 2 * bleed, height: bounds.height + 2 * bleed, bleed };
}

/** Fills the artboard (or the dieline alone with no bleed), cropping the image's overflow. */
export function artboardTransform(
  imageAspect: number,
  bounds: { width: number; height: number },
  bleedMm: number,
  rotation = 0,
): FullDielineTransform {
  const board = artboardSize(bounds, bleedMm);
  const aspect = Math.max(0.0001, imageAspect);
  // Quarter turns swap the image's sides on the sheet.
  const turned = Math.abs(Math.round(rotation / 90)) % 2 === 1;
  const boardWidth = turned ? board.height : board.width, boardHeight = turned ? board.width : board.height;
  let width = boardWidth, height = boardWidth / aspect;
  if (height < boardHeight) { height = boardHeight; width = boardHeight * aspect; }
  return { x: 50, y: 50, width: width / bounds.width * 100, height: height / bounds.height * 100, rotation };
}

/** How close an image's proportions must be to count as made for the artboard. */
const ARTBOARD_ASPECT_TOLERANCE = 0.01;

/**
 * Where a newly added full-sheet image goes: artwork made for the artboard
 * (dieline plus bleed) or for the dieline alone lands exactly on it; anything
 * else is placed in the middle at the given scale.
 */
export function placeFullDielineArtwork(
  imageAspect: number,
  bounds: { width: number; height: number },
  bleedMm: number,
  scalePercent = 100,
  rotation = 0,
): FullDielineTransform {
  if (scalePercent === 100 && rotation === 0) {
    const matches = (width: number, height: number) => Math.abs(imageAspect / (width / height) - 1) <= ARTBOARD_ASPECT_TOLERANCE;
    const board = artboardSize(bounds, bleedMm);
    const fitsBoard = matches(board.width, board.height), fitsSheet = matches(bounds.width, bounds.height);
    if (fitsBoard || fitsSheet) {
      // Nearest of the two when both are within tolerance.
      const board0 = Math.abs(imageAspect - board.width / board.height), sheet0 = Math.abs(imageAspect - bounds.width / bounds.height);
      return artboardTransform(imageAspect, bounds, fitsBoard && (!fitsSheet || board0 <= sheet0) ? bleedMm : 0);
    }
  }
  return createFullDielineTransform(imageAspect, bounds.width / bounds.height, scalePercent, rotation);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load artwork image.'));
    image.src = url;
  });
}

export function sheetTransformToPhysical(
  transform: FullDielineTransform,
  bounds: {width:number;height:number},
) {
  return {
    centerX: bounds.width * transform.x / 100,
    centerY: bounds.height * transform.y / 100,
    width: bounds.width * transform.width / 100,
    height: bounds.height * transform.height / 100,
    rotation: transform.rotation,
  };
}

export function panelRasterSize(
  panel:{width:number;height:number},
  maxCanvas=1200,
) {
  const pixelsPerMm=maxCanvas/Math.max(panel.width,panel.height);
  return {
    width:Math.max(1,Math.round(panel.width*pixelsPerMm)),
    height:Math.max(1,Math.round(panel.height*pixelsPerMm)),
    pixelsPerMm,
  };
}

export async function rasterizeFullDielineLayers(
  layers: FullDielineArtworkLayer[],
  dimensions: CartonDimensions,
  templateId: string,
  panelPrefix = '',
  geometryOptions?: TemplateGeometryOptions,
  /** Panel id → colour painted under the layers (a flap's edge colour). */
  fills: Record<string, string> = {},
): Promise<ArtworkByPanel> {
  if (!layers.length) return {};

  const visibleLayers=layers.filter(layer=>layer.visible!==false);
  if(!visibleLayers.length) return {};
  const loaded = await Promise.all(visibleLayers.map(async layer => ({
    layer,
    image: await loadImage(layer.url),
  })));

  const geometry = getTemplateGeometry(templateId,dimensions,geometryOptions);
  const bounds = geometry.bounds;
  const result: ArtworkByPanel = {};
  const compositeName = visibleLayers.length === 1 ? visibleLayers[0].name : `${visibleLayers.length} layer composition`;

  // Render each face directly from the physical 2D sheet coordinate system.
  // This deliberately avoids drawing one giant sheet bitmap and cropping it
  // afterwards: each 3D texture is now generated from the exact panel rectangle
  // (Front W×H, sides D×H, top/bottom W×D).
  for (const panel of geometry.panels) {
    // Panels no layer reaches get no texture, so a closure flap can continue
    // its neighbour's artwork instead of showing an empty one.
    if (!visibleLayers.some(layer=>layerPrintsOn(layer,panel.id)&&layerOverlaps(layer,panel,bounds))) continue;
    const raster=panelRasterSize(panel);
    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = raster.width;
    panelCanvas.height = raster.height;
    const ctx = panelCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.clearRect(0,0,panelCanvas.width,panelCanvas.height);
    if(fills[panel.id]){ctx.fillStyle=fills[panel.id];ctx.fillRect(0,0,panelCanvas.width,panelCanvas.height);}

    const scaleX=panelCanvas.width/panel.width;
    const scaleY=panelCanvas.height/panel.height;
    // The 3D model reads a panel's texture in the panel's artwork orientation;
    // sheet layers print as laid out, so a turned panel's texture is turned back.
    if(panel.artworkRotation===180){ctx.translate(panelCanvas.width,panelCanvas.height);ctx.rotate(Math.PI);}

    for(const {layer,image} of loaded){
      if(!layerPrintsOn(layer,panel.id)) continue;
      const physical=sheetTransformToPhysical(layer.transform,bounds);
      ctx.save();
      ctx.globalAlpha=Math.max(0,Math.min(1,(layer.opacity ?? 100)/100));
      // Rotate in physical sheet coordinates before mapping to rounded pixels.
      ctx.scale(scaleX,scaleY);
      ctx.translate(physical.centerX-panel.x,physical.centerY-panel.y);
      ctx.rotate(physical.rotation*Math.PI/180);
      ctx.drawImage(image,-physical.width/2,-physical.height/2,physical.width,physical.height);
      ctx.restore();
    }

    const panelName = panel.label.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
    result[`${panelPrefix}${panelName}`] = {
      ...defaultArtworkPlacement(compositeName, panelCanvas.toDataURL('image/png')),
      panelTexture: true,
      mode: 'fill',
      scale: 100,
      rotation: 0,
      alignX: 0,
      alignY: 0,
    };
  }

  return result;
}

// Bake board transforms into a transparent face texture, so the 2D and 3D
// views use identical clipping, rotation, stretching, and placement.
export async function rasterizePanelArtwork(
  artwork: ArtworkByPanel,
  dimensions: CartonDimensions,
  templateId: string,
  geometryOptions?: TemplateGeometryOptions,
): Promise<ArtworkByPanel> {
  const panels=getTemplateGeometry(templateId,dimensions,geometryOptions).panels;
  const entries=await Promise.all(Object.entries(artwork).filter(([,value])=>value.transform).map(async([key,value])=>{
    const panel=panels.find(item=>item.label.toLowerCase()===key.replace('Interior ','').toLowerCase());
    if(!panel || !value.transform) return null;
    const image=await loadImage(value.url);
    const canvas=document.createElement('canvas');
    const ratio=panel.width/panel.height;
    canvas.width=Math.max(1,Math.round(1200*Math.min(1,ratio)));
    canvas.height=Math.max(1,Math.round(1200*Math.min(1,1/ratio)));
    const ctx=canvas.getContext('2d');
    if(!ctx) throw new Error('Canvas is not available');
    const t=value.transform;
    ctx.scale(canvas.width/panel.width,canvas.height/panel.height);
    ctx.translate(panel.width*t.x/100,panel.height*t.y/100);
    ctx.rotate(t.rotation*Math.PI/180);
    const width=panel.width*t.width/100,height=panel.height*t.height/100;
    ctx.drawImage(image,-width/2,-height/2,width,height);
    return [key,{...defaultArtworkPlacement(value.name,canvas.toDataURL('image/png'),value.assetId),panelTexture:true,mode:'fill' as const}] as const;
  }));
  return Object.fromEntries(entries.filter(entry=>entry!==null));
}

export function dielineRasterSize(bounds:{width:number;height:number},maxCanvas=1800) {
  const pixelsPerMm=maxCanvas / Math.max(bounds.width,bounds.height);
  return {width:Math.max(1,Math.round(bounds.width*pixelsPerMm)),height:Math.max(1,Math.round(bounds.height*pixelsPerMm))};
}
