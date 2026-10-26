'use client';

import { useState } from 'react';
import { CartonEngine } from '@/components/studio/carton-engine';
import { registerJsonTemplates } from '@/lib/packaging/json-templates';
import { getTemplateRuntime } from '@/lib/packaging/template-runtime';
import type { ParametricTemplate } from '@/lib/packaging/parametric/format';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';

/** A template's flat cutting template (SVG from the server) and its box folding in 3D, at its default size. */
export function AdminTemplatePreview({ templateId, definition, svg, dimensions, material }: {
  templateId: string;
  /** An uploaded template's definition, registered here so the 3D view can draw it. */
  definition: ParametricTemplate | null;
  svg: string | null;
  dimensions: CartonDimensions;
  material: string;
}) {
  if (definition) registerJsonTemplates([definition]);
  const [formation, setFormation] = useState(100);
  const runtime = getTemplateRuntime(templateId);
  if (!runtime) return <p className="admin-muted">This template has no runtime on this page.</p>;
  return <div className="admin-template-preview-pair">
    <figure>
      {/* The SVG is drawn on the server from the definition; as an image it can't run anything. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- an inline data URL */}
      {svg ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="Flat cutting template" /> : <span className="admin-muted">No dieline at this size.</span>}
      <figcaption>Dieline at the default size</figcaption>
    </figure>
    <figure>
      <div className="admin-template-3d">
        <CartonEngine templateId={templateId} dimensions={dimensions} opening={0} formation={formation} openingMode={runtime.assembly.defaultOpeningMode} material={material} artworkByPanel={{}} cameraPreset="Perspective" zoom={78} />
      </div>
      <figcaption>
        <label>Fold <input type="range" min={0} max={100} value={formation} onChange={event => setFormation(Number(event.target.value))} aria-label="Fold" /></label>
      </figcaption>
    </figure>
  </div>;
}
