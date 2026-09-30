'use client';

import { useState } from 'react';

type Shape = 'portrait' | 'square' | 'landscape' | 'panoramic';

function classify(width: number, height: number): Shape {
  if (!width || !height) return 'landscape';
  const ratio = width / height;
  if (ratio < 0.85) return 'portrait';
  if (ratio < 1.15) return 'square';
  if (ratio >= 2) return 'panoramic';
  return 'landscape';
}

const widthCaps: Record<Shape, number> = {
  portrait: 620,
  square: 760,
  landscape: 980,
  panoramic: 1120,
};

export function AdaptiveArticleImage({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const [meta, setMeta] = useState<{ width: number; height: number; shape: Shape } | null>(null);
  const targetWidth = meta ? Math.min(meta.width, widthCaps[meta.shape]) : undefined;

  return <figure className={`adaptive-article-media${meta ? ` is-${meta.shape}` : ''}`}>
    <img
      src={src}
      alt={alt}
      onLoad={(event) => {
        const image = event.currentTarget;
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        setMeta({ width, height, shape: classify(width, height) });
      }}
      style={targetWidth ? { width: `${targetWidth}px` } : undefined}
    />
    {caption ? <figcaption>{caption}</figcaption> : null}
  </figure>;
}
