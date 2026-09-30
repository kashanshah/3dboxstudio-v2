import { reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from './reverse-tuck';
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

export async function rasterizeFullDielineLayers(
  layers: FullDielineArtworkLayer[],
  dimensions: CartonDimensions,
  panelPrefix = '',
): Promise<ArtworkByPanel> {
  if (!layers.length) return {};

  const loaded = await Promise.all(layers.map(async layer => ({
    layer,
    image: await loadImage(layer.url),
  })));

  const bounds = reverseTuckBounds(dimensions);
  const {width:canvasWidth,height:canvasHeight}=dielineRasterSize(bounds);
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const { layer, image } of loaded) {
    const targetWidth = canvasWidth * layer.transform.width / 100;
    const targetHeight = canvasHeight * layer.transform.height / 100;
    const cx = canvasWidth * layer.transform.x / 100;
    const cy = canvasHeight * layer.transform.y / 100;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(layer.transform.rotation * Math.PI / 180);
    ctx.drawImage(image, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
    ctx.restore();
  }

  const result: ArtworkByPanel = {};
  const compositeName = layers.length === 1 ? layers[0].name : `${layers.length} layer composition`;
  for (const item of reverseTuckPanels(dimensions)) {
    const sx = Math.round(item.x / bounds.width * canvasWidth);
    const sy = Math.round(item.y / bounds.height * canvasHeight);
    const sw = Math.max(1, Math.round(item.width / bounds.width * canvasWidth));
    const sh = Math.max(1, Math.round(item.height / bounds.height * canvasHeight));

    const panelCanvas = document.createElement('canvas');
    panelCanvas.width = sw;
    panelCanvas.height = sh;
    const panelCtx = panelCanvas.getContext('2d');
    if (!panelCtx) continue;
    panelCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    const panelName = item.label[0] + item.label.slice(1).toLowerCase();
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
export async function rasterizePanelArtwork(artwork: ArtworkByPanel, dimensions: CartonDimensions): Promise<ArtworkByPanel> {
  const panels=reverseTuckPanels(dimensions);
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
    ctx.translate(canvas.width*t.x/100,canvas.height*t.y/100);
    ctx.rotate(t.rotation*Math.PI/180);
    const width=canvas.width*t.width/100,height=canvas.height*t.height/100;
    ctx.drawImage(image,-width/2,-height/2,width,height);
    return [key,{...defaultArtworkPlacement(value.name,canvas.toDataURL('image/png'),value.assetId),panelTexture:true,mode:'fill' as const}] as const;
  }));
  return Object.fromEntries(entries.filter(entry=>entry!==null));
}

export function dielineRasterSize(bounds:{width:number;height:number},maxCanvas=1800) {
  const pixelsPerMm=maxCanvas / Math.max(bounds.width,bounds.height);
  return {width:Math.max(1,Math.round(bounds.width*pixelsPerMm)),height:Math.max(1,Math.round(bounds.height*pixelsPerMm))};
}
