import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { finishExportGeometry, rectangleOutline, type ExportPanel } from '../../export-geometry';

const PANEL_LABELS: Record<string, string> = {
  'top-tuck': 'TOP TUCK',
  'bottom-tuck': 'BOTTOM TUCK',
  'top-left-dust': 'TOP LEFT DUST FLAP',
  'top-right-dust': 'TOP RIGHT DUST FLAP',
  'bottom-left-dust': 'BOTTOM LEFT DUST FLAP',
  'bottom-right-dust': 'BOTTOM RIGHT DUST FLAP',
};

/**
 * Tuck and dust flaps with no artwork of their own continue the panel they
 * fold from, mirrored across the crease. The glue flap stays bare for gluing.
 */
export const REVERSE_TUCK_FLAP_SOURCES: Record<string, string> = {
  'top-tuck': 'top', 'bottom-tuck': 'bottom',
  'top-left-dust': 'left', 'bottom-left-dust': 'left', 'top-right-dust': 'right', 'bottom-right-dust': 'right',
};

/** Closure flap sizes shared by the cutting template and the 3D preview. */
export function reverseTuckClosureSizes(d: CartonDimensions) {
  const clearance = Math.max(0.5, d.thickness);
  const tongue = Math.min(25, Math.max(2, d.depth * 0.35));
  const dustHeight = Math.min(d.depth * 0.65, d.width / 2 - clearance);
  return {
    clearance,
    tongue,
    tongueBevel: Math.min(tongue * 0.25, (d.width - 2 * clearance) * 0.15),
    dustHeight,
    dustTaper: Math.min(d.depth * 0.2, dustHeight * 0.4),
  };
}

/** The printable cutting template; it is also the design grid. */
export function reverseTuckExportGeometry(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  const { clearance } = reverseTuckClosureSizes(d);
  if (Math.min(d.width, d.height, d.depth) <= clearance * 4) {
    throw new Error('These dimensions are too small for the selected board thickness. Increase the box size or reduce thickness.');
  }
  const glue = Math.max(12, Math.min(24, d.depth * 0.35));
  if (d.width <= glue + 2 * clearance) {
    throw new Error('The box width is too small to accommodate this template\'s glue flap. Increase the width before exporting.');
  }
  return reverseTuckSheet(d);
}

/** The cutting template's panels and outlines, without the printability checks. */
export function reverseTuckSheet(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  const { clearance, tongue, tongueBevel, dustHeight, dustTaper } = reverseTuckClosureSizes(d);
  const glue = Math.max(12, Math.min(24, d.depth * 0.35));
  const bodyY = d.depth + tongue;
  const frontX = glue + d.depth;
  const backX = frontX + d.width + d.depth;
  const panels: ExportPanel[] = [];
  const rect = (id: string, x: number, y: number, width: number, height: number, kind: ExportPanel['kind']) => {
    const panel = { id, label: PANEL_LABELS[id] ?? id.toUpperCase(), x, y, width, height, kind, sourceId: id };
    const result: ExportPanel = { ...panel, outline: rectangleOutline(panel) };
    panels.push(result);
    return result;
  };
  const gluePanel = rect('glue', 0, bodyY, glue, d.height, 'glue');
  gluePanel.outline = [
    { x: glue, y: bodyY }, { x: glue, y: bodyY + d.height },
    { x: 0, y: bodyY + d.height - clearance * 2 }, { x: 0, y: bodyY + clearance * 2 },
  ];
  rect('left', glue, bodyY, d.depth, d.height, 'body');
  rect('front', frontX, bodyY, d.width, d.height, 'body');
  rect('right', frontX + d.width, bodyY, d.depth, d.height, 'body');
  rect('back', backX, bodyY, d.width, d.height, 'body');
  rect('top', frontX, tongue, d.width, d.depth, 'flap');
  // Opposite hinge from the top is what makes this a reverse-tuck closure.
  rect('bottom', backX, bodyY + d.height, d.width, d.depth, 'flap');

  for (const [id, x, hingeY, direction] of [
    ['top-tuck', frontX, tongue, -1],
    ['bottom-tuck', backX, bodyY + d.height + d.depth, 1],
  ] as const) {
    const y = direction === -1 ? hingeY - tongue : hingeY;
    const panel = rect(id, x + clearance, y, d.width - 2 * clearance, tongue, 'flap');
    const bevel = tongueBevel;
    panel.outline = [
      { x: x + clearance, y: hingeY }, { x: x + d.width - clearance, y: hingeY },
      { x: x + d.width - clearance - bevel, y: hingeY + direction * tongue },
      { x: x + clearance + bevel, y: hingeY + direction * tongue },
    ];
  }
  for (const [side, x] of [['left', glue], ['right', frontX + d.width]] as const) {
    for (const [end, hingeY, direction] of [['top', bodyY, -1], ['bottom', bodyY + d.height, 1]] as const) {
      const y = direction === -1 ? hingeY - dustHeight : hingeY;
      const panel = rect(`${end}-${side}-dust`, x, y, d.depth, dustHeight, 'flap');
      const taper = dustTaper;
      panel.outline = [
        { x, y: hingeY }, { x: x + d.depth, y: hingeY },
        { x: x + d.depth - taper, y: hingeY + direction * dustHeight },
        { x: x + taper, y: hingeY + direction * dustHeight },
      ];
    }
  }
  return finishExportGeometry(panels, 'cutting-template', [
    'Reverse-tuck cutting template with tuck tongues, dust flaps and tapered glue flap.',
    'Nominal face sizes; no material or crease compensation. Obtain printer approval before production.',
    'Artwork prints exactly as laid out on the design grid, including the closure flaps.',
  ]);
}
