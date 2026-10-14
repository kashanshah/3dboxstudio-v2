import { IMAGE_SHOTS, imageBackground, imageFileName, imageFrame, imageLongSide, imageMimeType, type ImageSettings } from '@/lib/packaging/image-export';
import type { CartonRenderer } from './carton-renderer';
import { fitZoom } from './carton-framing';

// Still images of the box, rendered off screen at the chosen size: the view
// as it is in the Studio, or the standard product shots framed to fit.

export type CartonImage = { name: string; blob: Blob };

const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The image could not be encoded.')), type, 0.92);
});

/** `aspect` is the Studio view's width / height, used for the current view. */
export async function renderCartonImages(renderer: CartonRenderer, settings: ImageSettings, { aspect, coarse }: { aspect: number; coarse: boolean }): Promise<CartonImage[]> {
  const live = renderer.currentScene();
  const templateId = live.templateId;
  const longSide = imageLongSide(settings.size, coarse, renderer.captureLimit());
  const type = imageMimeType(settings.format);
  const background = imageBackground(settings);
  const set = settings.angles === 'set';
  const { width, height } = imageFrame(longSide, set ? 1 : aspect);
  const images: CartonImage[] = [];
  renderer.beginCapture(width, height, background);
  try {
    if (!set) {
      images.push({ name: imageFileName(templateId, settings.format), blob: await toBlob(renderer.captureFrame({}), type) });
    } else {
      for (const shot of IMAGE_SHOTS) {
        const canvas = renderer.captureFrame({ yaw: shot.yaw, pitch: shot.pitch, zoom: fitZoom(live, shot.pitch, 1), viewPan: { x: 0, y: 0 } });
        images.push({ name: imageFileName(templateId, settings.format, shot.id), blob: await toBlob(canvas, type) });
      }
    }
  } finally {
    renderer.endCapture();
  }
  return images;
}
