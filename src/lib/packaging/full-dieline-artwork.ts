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
};

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
  panelPrefix = '',
  templateId = 'reverse-tuck-carton',
  geometryOptions?: TemplateGeometryOptions,
): Promise<ArtworkByPanel> {
  if (!layers.length) return {};

  const loaded = await Promise.all(layers.map(async layer => ({
    layer,
    image: await loadImage(layer.url),
  })));

  const geometry = getTemplateGeometry(templateId,dimensions,geometryOptions);
  const bounds = geometry.bounds;
  const result: ArtworkByPanel = {};
  const compositeName = layers.length === 1 ? layers[0].name : `${layers.length} layer composition`;

  // Render each face directly from the physical 2D sheet coordinate system.
  // This deliberately avoids drawing one giant sheet bitmap and cropping it
  // afterwards: each 3D texture is now generated from the exact panel rectangle
  // (Front W×H, sides D×H, top/bottom W×D).
  for (const panel of geometry.panels) {
    const raster=panelRasterSize(panel);
    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = raster.width;
    panelCanvas.height = raster.height;
    const ctx = panelCanvas.getContext('2d');
    if (!ctx) continue;
    ctx.clearRect(0,0,panelCanvas.width,panelCanvas.height);

    const scaleX=panelCanvas.width/panel.width;
    const scaleY=panelCanvas.height/panel.height;

    for(const {layer,image} of loaded){
      const physical=sheetTransformToPhysical(layer.transform,bounds);
      ctx.save();
      // Rotate in physical sheet coordinates before mapping to rounded pixels.
      ctx.scale(scaleX,scaleY);
      ctx.translate(physical.centerX-panel.x,physical.centerY-panel.y);
      ctx.rotate(physical.rotation*Math.PI/180);
      ctx.drawImage(image,-physical.width/2,-physical.height/2,physical.width,physical.height);
      ctx.restore();
    }

    const panelName = panel.label[0] + panel.label.slice(1).toLowerCase();
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
  templateId = 'reverse-tuck-carton',
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
