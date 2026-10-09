import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { arcPoints, finishExportGeometry, rectangleOutline, type ExportPanel, type LineMm, type PointMm } from '../../export-geometry';

// The reverse tuck end carton (ECMA A20.20) as die makers draw it today. The
// entered width, depth and height are the inside of the carton; each panel is
// creased one board thickness wider so the folded carton keeps that inside.
// Its closures lock: slits at the tuck creases catch on the dust flaps'
// shoulders, the dust flaps crease one board below the lids so the lids close
// flat over them, and the panel each tuck slides into is cut one board short
// of its lid's crease, with a thumb notch at the top.

const PANEL_LABELS: Record<string, string> = {
  'top-tuck': 'TOP TUCK',
  'bottom-tuck': 'BOTTOM TUCK',
  'top-left-dust': 'TOP LEFT DUST FLAP',
  'top-right-dust': 'TOP RIGHT DUST FLAP',
  'bottom-left-dust': 'BOTTOM LEFT DUST FLAP',
  'bottom-right-dust': 'BOTTOM RIGHT DUST FLAP',
};

/**
 * Panels with no artwork of their own carry on the edge of the panel they fold
 * from: tuck and dust flaps, and the top and bottom from the front and back.
 * The glue flap stays bare for gluing.
 */
export const REVERSE_TUCK_FLAP_SOURCES: Record<string, string> = {
  'top-tuck': 'top', 'bottom-tuck': 'bottom', top: 'front', bottom: 'back',
  'top-left-dust': 'left', 'bottom-left-dust': 'left', 'top-right-dust': 'right', 'bottom-right-dust': 'right',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Every size of the cutting template, in millimetres, for an inside size. */
export function reverseTuckClosureSizes(d: CartonDimensions) {
  const t = d.thickness;
  // Crease to crease: inside size plus one board. The back, which the glue
  // flap is stuck to, takes half a board less.
  const front = d.width + t, back = d.width + t / 2, side = d.depth + t, height = d.height + t;
  const glue = clamp(0.3 * Math.min(d.width, d.depth) + 4, 10, 15);
  const glueSetback = t + 1;
  const glueTaper = glue * Math.tan(15 * Math.PI / 180);
  // The tuck tongue slides down inside the opposite panel.
  const tongue = Math.max(4, Math.min(clamp(0.4 * d.depth, 12, 25), d.height / 3));
  const tuckInset = t + 0.5;
  const shoulder = Math.min(3, tongue / 3);
  const tuckRadius = Math.max(1, Math.min(clamp(0.6 * tongue, 5, 15), tongue - shoulder, (front - 2 * tuckInset) / 2 - 1));
  const slit = Math.max(tuckInset + 1, Math.min(clamp(0.04 * d.width, 3, 6), front / 4));
  // Dust flaps clear the panels beside them and leave room between their tips.
  const dustRelief = t + 0.5;
  const dustHeight = Math.max(4, Math.min(d.width / 2 - t - 1.5, Math.max(0.6 * d.depth, 12)));
  const dustShoulder = Math.min(3, dustHeight / 3);
  const dustTaper = Math.max(0, Math.min((dustHeight - dustShoulder) * Math.tan(20 * Math.PI / 180), (side - 2 * dustRelief) / 2 - 2));
  const notch = Math.min(10, d.width / 6);
  return {
    t, front, back, side, height, glue, glueSetback, glueTaper,
    tongue, tuckInset, shoulder, tuckRadius, slit,
    dustRelief, dustHeight, dustShoulder, dustTaper, notch,
  };
}

/** The printable cutting template; it is also the design grid. */
export function reverseTuckExportGeometry(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  if (d.width < 20) throw new Error('The width is too small for the glue flap, tucks and thumb notch. Use a width of at least 20 mm.');
  if (d.depth < 10) throw new Error('The depth is too small for a reverse tuck carton\'s glue flap and tuck. Use a depth of at least 10 mm.');
  // The tuck tongue is at most a third of the height and needs about 8 mm to lock.
  if (d.height < 24) throw new Error('The height is too small for the tuck tongues to lock. Use a height of at least 24 mm.');
  return reverseTuckSheet(d);
}

/** The cutting template's panels and outlines, without the printability checks. */
export function reverseTuckSheet(input: CartonDimensions) {
  const d = sanitizeCartonDimensions(input);
  const s = reverseTuckClosureSizes(d);
  const { t } = s;
  const top = s.tongue + s.side;
  const left = s.glue, frontX = left + s.side, right = frontX + s.front, backX = right + s.side;
  const panels: ExportPanel[] = [];
  const slits: LineMm[] = [];
  const add = (id: string, kind: ExportPanel['kind'], outline: PointMm[], fold?: PointMm[]) => {
    const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    const panel: ExportPanel = {
      id, label: PANEL_LABELS[id] ?? id.toUpperCase(), kind, sourceId: id,
      x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline,
    };
    if (fold) panel.fold = fold;
    panels.push(panel);
    return panel;
  };
  const rect = (x: number, y: number, width: number, height: number) => rectangleOutline({ x, y, width, height } as ExportPanel);

  // Body: the top lid creases on the front at `top`; the bottom lid on the
  // back at `top + height`. Each tuck slides into the opposite panel, cut one
  // board short of the lid's crease; the side panels are cut one board short
  // at both ends, where the dust flaps crease.
  const bottomCrease = top + s.height;
  add('glue', 'glue', [
    { x: left, y: top + t + s.glueSetback }, { x: left, y: bottomCrease - t - s.glueSetback },
    { x: 0, y: bottomCrease - t - s.glueSetback - s.glueTaper }, { x: 0, y: top + t + s.glueSetback + s.glueTaper },
  ]);
  add('left', 'body', rect(left, top + t, s.side, s.height - 2 * t));
  add('front', 'body', rect(frontX, top, s.front, s.height - t));
  add('right', 'body', rect(right, top + t, s.side, s.height - 2 * t));
  // The top tuck slides into the back; a thumb notch at its top edge lets
  // the carton be opened.
  const notchCentre = backX + s.back / 2;
  add('back', 'body', [
    { x: backX, y: top + t },
    ...arcPoints(notchCentre, top + t, s.notch, Math.PI, 0, 12),
    { x: backX + s.back, y: top + t }, { x: backX + s.back, y: bottomCrease }, { x: backX, y: bottomCrease },
  ], rect(backX, top + t, s.back, s.height - t));
  add('top', 'flap', rect(frontX, s.tongue, s.front, s.side));
  // Opposite hinge from the top is what makes this a reverse-tuck closure.
  // Hinged on the back, the bottom sits upside down on the sheet: artwork
  // placed on it alone is turned half a turn to read upright on the box.
  add('bottom', 'flap', rect(backX, bottomCrease, s.back, s.side)).artworkRotation = 180;

  for (const [id, x, width, hingeY, direction] of [
    ['top-tuck', frontX, s.front, s.tongue, -1],
    ['bottom-tuck', backX, s.back, bottomCrease + s.side, 1],
  ] as const) {
    const { tongue, tuckInset: inset, shoulder, tuckRadius: radius } = s;
    const l = x + inset, r = x + width - inset, tip = hingeY + direction * tongue;
    const up = direction === -1;
    // Straight shoulders below the crease, then rounded corners to the tip.
    const outline: PointMm[] = [
      { x: l, y: hingeY }, { x: r, y: hingeY },
      { x: r, y: hingeY + direction * shoulder },
      ...arcPoints(r - radius, tip - direction * radius, radius, 0, up ? -Math.PI / 2 : Math.PI / 2),
      ...arcPoints(l + radius, tip - direction * radius, radius, up ? -Math.PI / 2 : Math.PI / 2, up ? -Math.PI : Math.PI),
      { x: l, y: hingeY + direction * shoulder },
    ];
    const bevel = radius * (1 - Math.SQRT1_2);
    add(id, 'flap', outline, [{ x: l, y: hingeY }, { x: r, y: hingeY }, { x: r - bevel, y: tip }, { x: l + bevel, y: tip }]);
    // Slit locks: the crease stops short of the tuck's ends.
    slits.push(
      { start: { x: l, y: hingeY }, end: { x: x + s.slit, y: hingeY } },
      { start: { x: x + width - s.slit, y: hingeY }, end: { x: r, y: hingeY } },
    );
  }
  for (const [side, x] of [['left', left], ['right', right]] as const) {
    for (const [end, hingeY, direction] of [['top', top + t, -1], ['bottom', bottomCrease - t, 1]] as const) {
      const { dustRelief: relief, dustHeight: height, dustShoulder: shoulder, dustTaper: taper } = s;
      const l = x + relief, r = x + s.side - relief, tip = hingeY + direction * height;
      // A straight shoulder that the tuck's slit catches on, then a taper.
      add(`${end}-${side}-dust`, 'flap', [
        { x: l, y: hingeY }, { x: r, y: hingeY },
        { x: r, y: hingeY + direction * shoulder }, { x: r - taper, y: tip },
        { x: l + taper, y: tip }, { x: l, y: hingeY + direction * shoulder },
      ], [{ x: l, y: hingeY }, { x: r, y: hingeY }, { x: r - taper, y: tip }, { x: l + taper, y: tip }]);
    }
  }
  return finishExportGeometry(panels, 'cutting-template', [
    'Reverse tuck end (ECMA A20.20): slit-locked tucks, shouldered dust flaps, 15° glue flap and a thumb notch.',
    `Width, depth and height are inside sizes; panels are creased one board (${t} mm) wider. Ask your printer to confirm the allowances for the board you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the closure flaps.',
  ], { slits });
}
