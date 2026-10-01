'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Scale the decoded image, rather than changing an SVG's internal viewport. */
export function BoardArtworkImage({ url, aspectRatio, width, height }: {
  url: string;
  aspectRatio: number;
  width: number;
  height: number;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [decoded, setDecoded] = useState<{ url: string; aspectRatio: number } | null>(null);
  const readDimensions = useCallback((image: HTMLImageElement) => {
    if (image !== imageRef.current || image.getAttribute('src') !== url || !image.naturalWidth || !image.naturalHeight) return;
    const nextRatio = image.naturalWidth / image.naturalHeight;
    setDecoded(current => current?.url === url && current.aspectRatio === nextRatio
      ? current
      : { url, aspectRatio: nextRatio });
  }, [url]);

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    let cancelled = false;
    // Cached and server-rendered images may finish before React attaches onLoad.
    // Read their dimensions before paint, and also handle decoding in progress.
    if (image.complete) readDimensions(image);
    void image.decode().then(() => {
      if (!cancelled) readDimensions(image);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [readDimensions]);

  const ratio = decoded?.url === url ? decoded.aspectRatio : aspectRatio;
  return <img ref={imageRef} src={url} alt="" draggable={false}
    style={{ display: 'block', width: '100%', height: 'auto', transform: `scaleY(${height * ratio / width})`, transformOrigin: 'top left' }}
    onLoad={event => readDimensions(event.currentTarget)}
  />;
}
