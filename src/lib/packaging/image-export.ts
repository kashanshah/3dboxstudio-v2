// What an image export renders: its size, file format, background and which
// views. Pure, so the choices and the ZIP of views can be tested without a browser.

import type { VideoBackground } from './video-timeline';

export type ImageSize = 'hd' | '2k' | '4k';
export type ImageFormat = 'png' | 'jpg';
export type ImageBackground = { kind: 'transparent' } | VideoBackground;
export type ImageAngles = 'current' | 'set';
export type ImageSettings = { size: ImageSize; format: ImageFormat; background: ImageBackground; angles: ImageAngles };

export const IMAGE_SIZES: ImageSize[] = ['hd', '2k', '4k'];
export const IMAGE_FORMATS: ImageFormat[] = ['png', 'jpg'];
/** The longest side of the image, in pixels. */
export const IMAGE_LONG_SIDE: Record<ImageSize, number> = { hd: 1920, '2k': 2560, '4k': 3840 };
/** Phones run out of graphics memory well before 4K. */
export const IMAGE_LONG_SIDE_COARSE = 2560;
export const DEFAULT_IMAGE_SETTINGS: ImageSettings = { size: '4k', format: 'png', background: { kind: 'transparent' }, angles: 'current' };

export type ImageShot = { id: 'front' | 'three-quarter' | 'back' | 'top'; yaw: number; pitch: number };
/** The standard product shots, each framed to fit the box in a square image. */
export const IMAGE_SHOTS: ImageShot[] = [
  { id: 'front', yaw: 0, pitch: 0.12 },
  { id: 'three-quarter', yaw: -0.62, pitch: 0.32 },
  { id: 'back', yaw: Math.PI, pitch: 0.12 },
  { id: 'top', yaw: 0, pitch: 1.3 },
];

/** The longest side to render at: the chosen size, capped on phones and by the GPU's limit. */
export function imageLongSide(size: ImageSize, coarse: boolean, limit = Infinity) {
  return Math.max(1, Math.floor(Math.min(IMAGE_LONG_SIDE[size], coarse ? IMAGE_LONG_SIDE_COARSE : Infinity, limit)));
}

/** A frame of `aspect` (width / height) with its longest side at `longSide`. */
export function imageFrame(longSide: number, aspect: number) {
  const ratio = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  return ratio >= 1
    ? { width: longSide, height: Math.max(1, Math.round(longSide / ratio)) }
    : { width: Math.max(1, Math.round(longSide * ratio)), height: longSide };
}

/** The background actually drawn: a JPG has no transparency, so it goes on white. */
export function imageBackground(settings: ImageSettings): ImageBackground {
  return settings.format === 'jpg' && settings.background.kind === 'transparent' ? { kind: 'color', color: '#ffffff' } : settings.background;
}

export function imageMimeType(format: ImageFormat) {
  return format === 'jpg' ? 'image/jpeg' : 'image/png';
}

/** `3d-box-studio-<template>[-<view>].<ext>` */
export function imageFileName(templateId: string, format: ImageFormat, shot?: ImageShot['id']) {
  return `3d-box-studio-${templateId}${shot ? `-${shot}` : ''}.${format}`;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A ZIP archive holding `files` uncompressed (PNG and JPG are compressed
 * already), so the set of views downloads as one file instead of four.
 */
export function zipFiles(files: { name: string; data: Uint8Array }[], date = new Date()) {
  const encoder = new TextEncoder();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data), size = file.data.length;
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true); // UTF-8 names
    header.setUint16(10, time, true);
    header.setUint16(12, day, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, size, true);
    header.setUint32(22, size, true);
    header.setUint16(26, name.length, true);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const entry = new DataView(central.buffer);
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(12, time, true);
    entry.setUint16(14, day, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, size, true);
    entry.setUint32(24, size, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + size;
  }
  const directorySize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, files.length, true);
  tail.setUint16(10, files.length, true);
  tail.setUint32(12, directorySize, true);
  tail.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end];
  const zip = new Uint8Array(offset + directorySize + end.length);
  let at = 0;
  for (const part of parts) { zip.set(part, at); at += part.length; }
  return zip;
}
