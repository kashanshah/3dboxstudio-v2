import { reverseTuckBounds, reverseTuckPanels, type CartonDimensions } from './reverse-tuck';
import { defaultArtworkPlacement, type ArtworkByPanel } from './artwork';

export type FullDielineTransform = {
  x: number;
  y: number;
  width: number;
  rotation: number;
};

export type FullDielineArtworkLayer = {
  id: string;
  assetId?: string;
  name: string;
  url: string;
  transform: FullDielineTransform;
};

export const DEFAULT_FULL_DIELINE_TRANSFORM: FullDielineTransform = {
  x: 50,
  y: 50,
  width: 72,
  rotation: 0,
};

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
): Promise<ArtworkByPanel> {
  if (!layers.length) return {};

  const loaded = await Promise.all(layers.map(async layer => ({
    layer,
    image: await loadImage(layer.url),
  })));

  const bounds = reverseTuckBounds(dimensions);
  const maxCanvas = 1800;
  const canvasWidth = Math.max(800, Math.min(maxCanvas, Math.round(maxCanvas * Math.min(1, bounds.width / bounds.height))));
  const canvasHeight = Math.max(800, Math.round(canvasWidth * bounds.height / bounds.width));
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const { layer, image } of loaded) {
    const targetWidth = canvasWidth * layer.transform.width / 100;
    const aspect = (image.naturalWidth || image.width || 1) / (image.naturalHeight || image.height || 1);
    const targetHeight = targetWidth / Math.max(aspect, 0.0001);
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
    if (item.id === 'glue') continue;
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
    result[panelName] = {
      ...defaultArtworkPlacement(compositeName, panelCanvas.toDataURL('image/png')),
      mode: 'fill',
      scale: 100,
      rotation: 0,
      alignX: 0,
      alignY: 0,
    };
  }
  return result;
}
