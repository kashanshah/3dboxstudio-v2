import type { DielineOutput } from '../types';
import { dielineToSvg, type SvgOptions } from './svg';

// A PNG preview of the dieline at a chosen resolution, drawn by the browser
// from the SVG. Browser only: it needs an image element and a canvas.

/** The largest side a canvas reliably allows across browsers. */
const MAX_PIXELS = 8192;

export async function dielineToPng(output: DielineOutput, dpi = 150, options: SvgOptions = {}): Promise<Blob> {
  const svg = dielineToSvg(output, { ...options, showLabels: options.showLabels ?? true });
  const match = svg.match(/width="([\d.]+)mm" height="([\d.]+)mm"/);
  if (!match) throw new Error('The dieline has no size.');
  const scale = Math.min(dpi / 25.4, MAX_PIXELS / Math.max(Number(match[1]), Number(match[2])));
  const width = Math.round(Number(match[1]) * scale), height = Math.round(Number(match[2]) * scale);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('The preview could not be drawn.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot draw the preview.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('The preview could not be saved.'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}
