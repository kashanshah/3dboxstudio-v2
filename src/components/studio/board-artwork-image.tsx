'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Scale the decoded image, rather than changing an SVG's internal viewport. */
export function BoardArtworkImage({ url, aspectRatio, width, height }: {
  url: string;
  aspectRatio: number;
  width: number;
  height: number;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [decoded, setDecoded] = useState<{ url: string; aspectRatio: number } | null>(null);
  const readDimensions = useCallback((image: HTMLImageElement) => {
    if (image !== imageRef.current || image.getAttribute('src') !== url || !image.naturalWidth || !image.naturalHeight) return;
    setFailedUrl(null);
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
    }).catch(() => {
      if (!cancelled && image === imageRef.current && image.getAttribute('src') === url) setFailedUrl(url);
    });
    return () => { cancelled = true; };
  }, [readDimensions, attempt, url]);

  const ready = decoded?.url === url;
  const failed = !ready && failedUrl === url;
  const ratio = ready ? decoded.aspectRatio : aspectRatio;
  return <span style={{ display: 'block', position: 'relative', width: '100%', height: '100%' }} aria-busy={!ready && !failed}>
    <img key={`${url}:${attempt}`} ref={imageRef} src={url} alt="" draggable={false}
      style={{ display: 'block', width: '100%', height: 'auto', visibility: ready ? 'visible' : 'hidden', transform: `scaleY(${height * ratio / width})`, transformOrigin: 'top left' }}
      onLoad={event => readDimensions(event.currentTarget)}
      onError={() => setFailedUrl(url)}
    />
    {!ready && <span className="board-artwork-status" role={failed ? 'alert' : 'status'}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', background: 'rgba(248,250,252,.9)', color: '#526175', fontSize: 12, textAlign: 'center', padding: 8 }}>
      <span>{failed ? 'Image couldn’t load' : 'Loading artwork…'}</span>
      {failed && <button type="button" style={{ pointerEvents: 'auto', padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', color: '#0076bc' }}
        onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); setFailedUrl(null); setDecoded(null); setAttempt(value => value + 1); }}>Retry</button>}
    </span>}
  </span>;
}
