'use client';

import { useEffect, useRef, useState } from 'react';

export function AdminDesignThumb({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const image = useRef<HTMLImageElement>(null);
  // An image that failed before this component hydrated never fires onError.
  useEffect(() => {
    const node = image.current;
    if (node?.complete && node.naturalWidth === 0) setFailed(true);
  }, [src]);
  return (
    <span className="admin-design-thumb">
      {src && !failed ? <img ref={image} src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span aria-hidden>3D</span>}
      <span className="sr-only">{name} thumbnail</span>
    </span>
  );
}
