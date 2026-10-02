import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { finishExportGeometry, rectangleOutline, type ExportPanel } from '../../export-geometry';

/** Independent cutting geometry. Saved mockup panels retain their original coordinates. */
export function reverseTuckExportGeometry(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  const clearance = Math.max(0.5, d.thickness);
  if (Math.min(d.width, d.height, d.depth) <= clearance * 4) {
    throw new Error('These dimensions are too small for the selected board thickness. Increase the box size or reduce thickness.');
  }
  const glue = Math.max(12, Math.min(24, d.depth * 0.35));
  if (d.width <= glue + 2 * clearance) {
    throw new Error('The box width is too small to accommodate this template\'s glue flap. Increase the width before exporting.');
  }
  const tongue = Math.min(25, Math.max(2, d.depth * 0.35));
  const bodyY = d.depth + tongue;
  const frontX = glue + d.depth;
  const backX = frontX + d.width + d.depth;
  const panels: ExportPanel[] = [];
  const rect = (id: string, x: number, y: number, width: number, height: number, kind: ExportPanel['kind'], sourceId?: string) => {
    const panel = { id, label: id.toUpperCase(), x, y, width, height, kind, sourceId };
    const result: ExportPanel = { ...panel, outline: rectangleOutline(panel) };
    panels.push(result);
    return result;
  };
  const gluePanel = rect('glue', 0, bodyY, glue, d.height, 'glue', 'glue');
  gluePanel.outline = [
    { x: glue, y: bodyY }, { x: glue, y: bodyY + d.height },
    { x: 0, y: bodyY + d.height - clearance * 2 }, { x: 0, y: bodyY + clearance * 2 },
  ];
  rect('left', glue, bodyY, d.depth, d.height, 'body', 'left');
  rect('front', frontX, bodyY, d.width, d.height, 'body', 'front');
  rect('right', frontX + d.width, bodyY, d.depth, d.height, 'body', 'right');
  rect('back', backX, bodyY, d.width, d.height, 'body', 'back');
  rect('top', frontX, tongue, d.width, d.depth, 'flap', 'top');
  // Opposite hinge from the top is what makes this a reverse-tuck closure.
  rect('bottom', backX, bodyY + d.height, d.width, d.depth, 'flap', 'bottom').sourceRotation = 180;

  for (const [id, x, hingeY, direction] of [
    ['top-tuck', frontX, tongue, -1],
    ['bottom-tuck', backX, bodyY + d.height + d.depth, 1],
  ] as const) {
    const y = direction === -1 ? hingeY - tongue : hingeY;
    const panel = rect(id, x + clearance, y, d.width - 2 * clearance, tongue, 'flap');
    const bevel = Math.min(tongue * 0.25, (d.width - 2 * clearance) * 0.15);
    panel.outline = [
      { x: x + clearance, y: hingeY }, { x: x + d.width - clearance, y: hingeY },
      { x: x + d.width - clearance - bevel, y: hingeY + direction * tongue },
      { x: x + clearance + bevel, y: hingeY + direction * tongue },
    ];
  }
  const dustHeight = Math.min(d.depth * 0.65, d.width / 2 - clearance);
  for (const [side, x] of [['left', glue], ['right', frontX + d.width]] as const) {
    for (const [end, hingeY, direction] of [['top', bodyY, -1], ['bottom', bodyY + d.height, 1]] as const) {
      const y = direction === -1 ? hingeY - dustHeight : hingeY;
      const panel = rect(`${end}-${side}-dust`, x, y, d.depth, dustHeight, 'flap');
      const taper = Math.min(d.depth * 0.2, dustHeight * 0.4);
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
    'Added closure flaps are unprinted. Bottom artwork rotates 180 degrees onto the opposite hinge.',
  ]);
}
