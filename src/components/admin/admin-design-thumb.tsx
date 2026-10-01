'use client';

import { useState } from 'react';

export function AdminDesignThumb({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="admin-design-thumb">
      {src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : <span aria-hidden>3D</span>}
      <span className="sr-only">{name} thumbnail</span>
    </span>
  );
}
