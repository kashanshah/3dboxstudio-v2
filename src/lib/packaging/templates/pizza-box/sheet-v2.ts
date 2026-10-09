import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { dielineBounds, type DielinePanel } from '../../box-structures';

// The pizza box's design grid as it stood for layout version 2 (a single-wall
// tray), kept unchanged so saved designs can be moved from it onto the
// current one. Never edit this file: layout migrations depend on it.

/** A single sheet: lid lip, lid, rear hinge wall, tray base, front wall. */
export function pizzaBoxPanelsV2(input: CartonDimensions): DielinePanel[] {
  const { width: w, height: h, depth: d } = sanitizeCartonDimensions(input);
  const lip = h * 0.65;
  const baseY = lip + d + h;
  const tab = Math.min(h * 0.7, d * 0.2, w * 0.2);
  return [
    { id: 'bottom', label: 'BOTTOM', x: h, y: baseY, width: w, height: d, kind: 'body' },
    // The front wall, lid and lid front sit upside down on the sheet relative
    // to the folded box: artwork placed on one of them alone is turned to
    // read upright on the box.
    { id: 'front', label: 'FRONT', x: h, y: baseY + d, width: w, height: h, kind: 'body', artworkRotation: 180 },
    { id: 'back', label: 'BACK', x: h, y: lip + d, width: w, height: h, kind: 'body' },
    { id: 'left', label: 'LEFT', x: 0, y: baseY, width: h, height: d, kind: 'body' },
    { id: 'right', label: 'RIGHT', x: h + w, y: baseY, width: h, height: d, kind: 'body' },
    { id: 'top', label: 'TOP', x: h, y: lip, width: w, height: d, kind: 'body', artworkRotation: 180 },
    { id: 'lidFront', label: 'LID FRONT', x: h, y: 0, width: w, height: lip, kind: 'flap', artworkRotation: 180 },
    { id: 'lidLeft', label: 'LID LEFT', x: h - lip, y: lip, width: lip, height: d, kind: 'flap' },
    { id: 'lidRight', label: 'LID RIGHT', x: h + w, y: lip, width: lip, height: d, kind: 'flap' },
    // Gaps next to Front/Back keep corner tabs separate from those walls.
    { id: 'leftBackTab', label: 'LEFT BACK TAB', x: 0, y: baseY - tab, width: h * 0.8, height: tab, kind: 'flap' },
    { id: 'leftFrontTab', label: 'LEFT FRONT TAB', x: 0, y: baseY + d, width: h * 0.8, height: tab, kind: 'flap' },
    { id: 'rightBackTab', label: 'RIGHT BACK TAB', x: w + h * 1.2, y: baseY - tab, width: h * 0.8, height: tab, kind: 'flap' },
    { id: 'rightFrontTab', label: 'RIGHT FRONT TAB', x: w + h * 1.2, y: baseY + d, width: h * 0.8, height: tab, kind: 'flap' },
  ];
}

export function pizzaBoxSheetV2(input: CartonDimensions) {
  const panels = pizzaBoxPanelsV2(input);
  return { panels, bounds: dielineBounds(panels) };
}
