// FROZEN REFERENCE. The split top box exactly as it was hand-written before
// it moved to the parametric definition in
// src/lib/packaging/parametric/definitions/split-top.ts. Nothing in the app
// imports this file: scripts/parametric-templates.test.cjs compares the
// definition against it, so any change to the box's die or fold shows up as a
// test failure rather than slipping through. Never edit it to make that test
// pass; change the definition or, for an intended change, delete this file
// and the parity test together.

import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { sanitizeCorrugatedDimensions } from '@/lib/packaging/templates/corrugated';
import { finishExportGeometry, rectangleOutline, type ExportPanel, type PointMm } from '@/lib/packaging/export-geometry';
import type { Mesh, TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import type { TemplateRuntime } from '@/lib/packaging/template-runtime';
import { boardThickness, panelName, substage } from '@/lib/packaging/templates/folded-box';

// The split top is a regular slotted container (FEFCO 0201), the everyday
// corrugated shipping box: one strip of joint, front, right, back and left,
// with a flap on every wall at each end. Slots cut between the flaps let them
// fold past each other. The outer pair of top flaps meet in the middle and
// split the top in two; with them on the end walls, the end flaps are half
// the width long and both pairs meet (FEFCO 0204, centre special slotted).
// Width, depth and height are inside sizes; each panel is scored one board
// wider, the height two boards taller, so the folded box keeps them.

export type SplitTopSide = 'side_a' | 'side_b';

export function sanitizeSplitTopDimensions(value: CartonDimensions): CartonDimensions {
  return sanitizeCorrugatedDimensions(value, 3);
}

export function splitTopSizes(d: CartonDimensions) {
  const t = d.thickness;
  const corrugated = t >= 1.5;
  // Slots: about 6 mm on single-wall corrugated, wider on double wall; a
  // board and a millimetre on folding board, at least the 3 mm a score bends
  // through so neighbouring flaps clear each other.
  const slot = corrugated ? Math.max(6, 2 * t) : Math.max(3, t + 1);
  // The manufacturer's joint: 30-40 mm on corrugated, 12-15 mm on board.
  const joint = corrugated ? 35 : 14;
  return {
    t, slot, joint,
    jointCutBack: slot / 2,
    jointTaper: Math.min(joint, 10),
    long: d.width + t,
    end: d.depth + t,
    // The end wall the joint is stuck to takes half a board less.
    jointEnd: d.depth + t / 2,
    height: d.height + 2 * t,
  };
}

const LABELS: Record<string, string> = {
  topFront: 'TOP FRONT', topRight: 'TOP RIGHT', topBack: 'TOP BACK', topLeft: 'TOP LEFT',
  bottomFront: 'BOTTOM FRONT', bottomRight: 'BOTTOM RIGHT', bottomBack: 'BOTTOM BACK', bottomLeft: 'BOTTOM LEFT',
};

/** The cutting template's panels, outlines, scores and cuts. */
export function splitTopSheet(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  const d = sanitizeSplitTopDimensions(input);
  const s = splitTopSizes(d);
  const walls = [
    { id: 'front', width: s.long, end: false },
    { id: 'right', width: s.end, end: true },
    { id: 'back', width: s.long, end: false },
    { id: 'left', width: s.jointEnd, end: true },
  ];
  // Every flap is half the end wall long, so the long walls' flaps meet in
  // the middle; with the outer flaps on the end walls (0204), theirs are half
  // the long wall and meet too.
  const flapHeight = (end: 'top' | 'bottom', isEnd: boolean) => (end === 'top' && side === 'side_a' && isEnd ? s.long / 2 : s.end / 2);
  const top = Math.max(...walls.map(wall => flapHeight('top', wall.end)));
  const bottom = top + s.height;
  const panels: ExportPanel[] = [];
  const add = (id: string, kind: ExportPanel['kind'], outline: PointMm[]) => {
    const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    panels.push({ id, label: LABELS[id] ?? id.toUpperCase(), kind, sourceId: id, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, outline });
  };
  add('glue', 'glue', [
    { x: s.joint, y: top + s.jointCutBack }, { x: s.joint, y: bottom - s.jointCutBack },
    { x: 0, y: bottom - s.jointCutBack - s.jointTaper }, { x: 0, y: top + s.jointCutBack + s.jointTaper },
  ]);
  let x = s.joint;
  walls.forEach(wall => {
    add(wall.id, 'body', rectangleOutline({ x, y: top, width: wall.width, height: s.height } as ExportPanel));
    // A slot either side of every flap, half on each neighbour, including at
    // the glued corner where the strip's two ends meet.
    const left = x + s.slot / 2, right = x + wall.width - s.slot / 2;
    for (const end of ['top', 'bottom'] as const) {
      const h = flapHeight(end, wall.end), hinge = end === 'top' ? top : bottom, tip = end === 'top' ? top - h : bottom + h;
      add(`${end}${wall.id[0].toUpperCase()}${wall.id.slice(1)}`, 'flap', [
        { x: left, y: hinge }, { x: right, y: hinge }, { x: right, y: tip }, { x: left, y: tip },
      ]);
    }
    x += wall.width;
  });
  return finishExportGeometry(panels, 'cutting-template', [
    side === 'side_b'
      ? 'Regular slotted container (FEFCO 0201): four flaps at each end, slotted, with a glued manufacturer\'s joint.'
      : 'Centre special slotted container (FEFCO 0204): every top flap meets in the middle; regular slotted bottom.',
    `Width, depth and height are inside sizes; panels are scored one board (${s.t} mm) wider and the height two boards taller. Ask your box maker to confirm the allowances for the flute you choose.`,
    'Artwork prints exactly as laid out on the design grid, including the flaps.',
  ]);
}

/** The printable cutting template, with the size checks. */
export function splitTopExportGeometry(input: CartonDimensions, side: SplitTopSide = 'side_a') {
  const d = sanitizeSplitTopDimensions(input);
  const s = splitTopSizes(d);
  if (d.depth < s.joint + 5) throw new Error(`The depth is too small for the glued joint. Use a depth of at least ${s.joint + 5} mm on this board.`);
  if (d.width < s.joint + 5) throw new Error(`The width is too small for the slotted flaps. Use a width of at least ${s.joint + 5} mm on this board.`);
  if (d.height < 2 * s.slot + 10) throw new Error(`The height is too small for this board. Use a height of at least ${2 * s.slot + 10} mm.`);
  return splitTopSheet(d, side);
}

// Folded from the cutting template itself, as a slotted box is packed: the
// joint turns in and the walls wrap round onto it, the bottom's end flaps
// fold in and its long flaps close over them, then the top closes the same
// way, its outer flaps last and meeting in the middle. Opening reverses the
// top: outer flaps first, then the inner ones.

const WALLS = ['front', 'right', 'back', 'left'] as const;

export const buildSplitTopTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor, splitTopHingeSide }) => {
  const d = sanitizeSplitTopDimensions(dimensions);
  const t = boardThickness(d);
  const sheet = splitTopSheet(d, splitTopHingeSide);
  const front = sheet.panels.find(panel => panel.id === 'front')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const closed = 1 - Math.min(1, Math.max(0, opening / 100));
  const quarter = Math.PI / 2;
  // The outer flaps fold as far out as a score allows (half its width) and
  // the inner flaps one board further in, so the outer pair lies on them.
  const outerSetback = -1.5 * t, innerSetback = outerSetback + t;
  // The outer pair of top flaps.
  const outerTop = splitTopHingeSide === 'side_b' ? ['front', 'back'] : ['right', 'left'];
  const name = (end: string, wall: string) => `${end}${wall[0].toUpperCase()}${wall.slice(1)}`;
  const hinges: SheetHinge[] = [
    { child: 'glue', parent: 'front', angle: substage(formed, 0, 0.5) * quarter, setback: t * 1.1 },
    { child: 'right', parent: 'front', angle: substage(formed, 0, 0.6) * quarter },
    { child: 'back', parent: 'right', angle: substage(formed, 0.1, 0.7) * quarter },
    { child: 'left', parent: 'back', angle: substage(formed, 0.2, 0.8) * quarter },
  ];
  for (const wall of WALLS) {
    const bottomOuter = wall === 'front' || wall === 'back';
    hinges.push({
      child: name('bottom', wall), parent: wall,
      // Only once all four walls are up: end flaps in, then the long flaps.
      angle: (bottomOuter ? substage(formed, 0.9, 1) : substage(formed, 0.8, 0.9)) * quarter,
      setback: bottomOuter ? outerSetback : innerSetback,
    });
    const topOuter = outerTop.includes(wall);
    hinges.push({
      child: name('top', wall), parent: wall,
      angle: (topOuter ? substage(closed, 0.5, 1) : substage(closed, 0, 0.5)) * quarter,
      setback: topOuter ? outerSetback : innerSetback,
    });
  }
  const panels: SheetPanel[] = sheet.panels.map(panel => ({
    id: panel.id,
    name: panelName(panel.label),
    outline: panel.outline,
    // Outer flaps over inner ones over the walls' edges; the joint inside.
    layer: panel.id === 'glue' ? 0 : panel.kind === 'flap' ? (outerTop.includes(panel.id.replace(/^top/, '').toLowerCase()) || /^bottom(Front|Back)$/.test(panel.id) ? 3 : 2) : 1,
  }));
  const placement = translation([-(front.x + front.width / 2), front.y + front.height / 2, d.depth / 2]);
  return foldSheet({ panels, hinges, root: 'front', thickness: t, color, interiorColor, placement }).map(withBottomFallback);
};

// Designs made before the bottom was split print one "Bottom" artwork across
// both outer bottom flaps.
function withBottomFallback(mesh: Mesh): Mesh {
  const half = mesh.panel?.replace(/^Interior /, '');
  if (half !== 'Bottom Front' && half !== 'Bottom Back') return mesh;
  mesh.fallbackPanel = mesh.panel!.startsWith('Interior ') ? 'Interior Bottom' : 'Bottom';
  mesh.fallbackUv = [0, half === 'Bottom Front' ? 0.5 : 0, 1, 0.5];
  return mesh;
}

export const splitTopReferenceRuntime:TemplateRuntime={
  templateId:'split-top-box',
  structureKey:'split-top-box-v1',
  rendererKey:'split-top-box-v1',
  sanitizeParameters:sanitizeSplitTopDimensions,
  // The design grid is the cutting template itself, flaps included.
  getDielinePanels:(dimensions,options)=>splitTopSheet(dimensions,options?.splitTopHingeSide??'side_a').panels,
  getDielineBounds:(dimensions,options)=>splitTopSheet(dimensions,options?.splitTopHingeSide??'side_a').bounds,
  buildMeshes:buildSplitTopTemplateMeshes,
  getExportGeometry:(dimensions,options)=>splitTopExportGeometry(dimensions,options?.splitTopHingeSide??'side_a'),
  exportSummary:'Slotted shipping box cutting template. Your box maker must approve the flute and score allowances.',
  exportArtworkNote:'Artwork prints exactly as laid out on the design grid, including the flaps.',
  assembly:{
    control:'split-direction',
    defaultOpeningMode:'top_split_meet_center',
    hasOpeningStage:()=>true,
  },
};
