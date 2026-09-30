'use client';

import { useState } from 'react';

/** Scale the decoded image, rather than changing an SVG's internal viewport. */
export function BoardArtworkImage({ url, aspectRatio, width, height }: {
  url: string;
  aspectRatio: number;
  width: number;
  height: number;
}) {
  const [decoded, setDecoded] = useState<{ url: string; aspectRatio: number } | null>(null);
  const ratio = decoded?.url === url ? decoded.aspectRatio : aspectRatio;
  return <img src={url} alt="" draggable={false}
    style={{ display: 'block', width: '100%', height: 'auto', transform: `scaleY(${height * ratio / width})`, transformOrigin: 'top left' }}
    onLoad={event => {
      const image = event.currentTarget;
      if (image.naturalWidth && image.naturalHeight) {
        setDecoded({ url, aspectRatio: image.naturalWidth / image.naturalHeight });
      }
    }}
  />;
}
