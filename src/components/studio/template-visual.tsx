import type { PackagingTemplateDefinition } from '@/lib/packaging/template-registry';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { svgNumber, svgPoints } from '@/lib/svg-number';
import { getTemplateExportGeometry, getTemplateGeometry, getTemplateRuntime } from '@/lib/packaging/template-runtime';

export function TemplateVisual({template,dimensions,compact=false}:{template:PackagingTemplateDefinition;dimensions?:CartonDimensions;compact?:boolean}) {
  const visualClass = template.id === 'pizza-box'
    ? 'is-pizza'
    : template.family === 'bottle'
    ? 'is-bottle'
    : template.family === 'jar'
      ? 'is-jar'
      : template.family === 'pouch'
        ? 'is-pouch'
        : template.family === 'cup'
          ? 'is-cup'
          : template.family === 'can'
            ? 'is-can'
            : template.family === 'rigid-box'
              ? 'is-rigid'
              : template.family === 'corrugated'
                ? 'is-corrugated'
                : template.id.includes('sleeve')
                  ? 'is-sleeve'
                  : 'is-carton';

  const size = dimensions ?? template.defaultDimensions;
  const runtime = getTemplateRuntime(template.id);
  const photo = template.thumbnail;
  // A render of the finished box in front of the template's real cutting
  // dieline, so the card shows both the flat sheet and the result.
  if (photo && runtime && size) {
    const dieline = getTemplateExportGeometry(template.id, size);
    const pad = Math.max(dieline.bounds.width, dieline.bounds.height) * 0.02;
    const n = svgNumber;
    const line = (segment: { start: { x: number; y: number }; end: { x: number; y: number } }) => `M${n(segment.start.x)} ${n(segment.start.y)}L${n(segment.end.x)} ${n(segment.end.y)}`;
    return <span className={`pro-template-visual is-photo ${compact ? 'is-compact' : ''}`} aria-hidden="true">
      <svg className="pro-template-photo-dieline" viewBox={`${n(-pad)} ${n(-pad)} ${n(dieline.bounds.width + pad * 2)} ${n(dieline.bounds.height + pad * 2)}`} preserveAspectRatio="xMidYMid meet">
        {dieline.panels.map(panel => <polygon key={panel.id} points={svgPoints(panel.outline)}/>)}
        <path className="is-cut" d={dieline.cut.map(line).join('')}/>
        <path className="is-crease" d={dieline.crease.map(line).join('')}/>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static render, already sized */}
      <img className="pro-template-photo" src={photo} alt="" loading="lazy" decoding="async"/>
    </span>;
  }
  const geometry = runtime && size ? getTemplateGeometry(template.id,size) : null;
  const bounds = geometry?.bounds;
  const hasRealDieline = !!geometry;

  return <span className={`pro-template-visual is-combined ${visualClass} ${compact ? 'is-compact' : ''}`} aria-hidden="true">
    <span className="pro-template-flat" data-preview="Dieline">
      {hasRealDieline && bounds && geometry ? <svg viewBox={`0 0 ${bounds.width} ${bounds.height}`} preserveAspectRatio="xMidYMid meet">
        {geometry.panels.map(panel => <rect
          key={panel.id}
          x={panel.x} y={panel.y} width={panel.width} height={panel.height}
          className={panel.kind === 'glue' ? 'is-glue' : ''}
        />)}
      </svg> : template.family === 'pouch'
        ? <svg className="pro-template-generic-net" viewBox="0 0 100 82"><path d="M24 12h52l6 58H18z"/><path className="is-crease" d="M22 57h56M28 20h44"/></svg>
        : ['bottle','jar','can','cup'].includes(template.family)
          ? <svg className="pro-template-generic-net" viewBox="0 0 100 82"><rect x="18" y="24" width="64" height="38"/><path className="is-crease" d="M26 24v38M74 24v38"/><circle cx="50" cy="14" r="8"/></svg>
          : <svg className="pro-template-generic-net" viewBox="0 0 100 82" preserveAspectRatio="xMidYMid meet">
            <rect x="31" y="28" width="20" height="28"/>
            <rect x="51" y="28" width="20" height="28"/>
            <rect x="11" y="28" width="20" height="28"/>
            <rect x="71" y="28" width="13" height="28" className="is-glue"/>
            <rect x="31" y="10" width="20" height="18"/>
            <rect x="31" y="56" width="20" height="16"/>
          </svg>}
    </span>
    <span className="pro-template-package" data-preview="3D">
      <i className="shape-main"/>
      <i className="shape-side"/>
      <i className="shape-top"/>
    </span>
  </span>;
}
