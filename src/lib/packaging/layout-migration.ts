import { reverseTuckBounds, reverseTuckPanels, sanitizeCartonDimensions } from './reverse-tuck';
import { reverseTuckSheetV2 } from './templates/reverse-tuck/sheet-v2';
import { reverseTuckSheet } from './templates/reverse-tuck/export';
import { baseBoxSheetV1 } from './templates/base-box/sheet-v1';
import { baseBoxSheet } from './templates/base-box/geometry';
import { splitTopSheetV1 } from './templates/split-top/sheet-v1';
import { splitTopSheet } from './templates/split-top/geometry';
import type { ArtworkByPanel, ArtworkPlacement } from './artwork';
import type { FullDielineArtworkLayer } from './full-dieline-artwork';
import type { StudioProjectState } from '../studio-project';

// When a template's design grid changes, saved designs are moved onto the new
// grid so they look and print exactly as they did before.

type Step = (state: StudioProjectState) => StudioProjectState;

// Each template's grid versions, in order: STEPS[template][n] moves a design
// from version n + 1 to n + 2.
const STEPS: Record<string, Step[]> = {
  'reverse-tuck-carton': [
    // 2: the grid is the cutting template, with tuck and dust flaps, and the
    // bottom panel sits under the back, turned 180°.
    reverseTuckToCuttingTemplate,
    // 3: artwork placed on the bottom panel alone is turned to read upright
    // on the box; stored bottom artwork turns back to match.
    state => ({ ...state, artworkByPanel: turnPanelArtwork(state.artworkByPanel, ['Bottom']) }),
    // 4: sheet layers moved in step 2 also print on the flaps (and, unless
    // they have a turned bottom copy, the bottom) they cover, as artwork made
    // on the full dieline should. Panels printed before print as before.
    reverseTuckLayersOnFlaps,
    // 5: the locking die, creased one board wider per panel with a narrower
    // glue flap; sheet layers move and stretch (well under 1%) to keep the
    // body and top lid's edges, within about a board thickness everywhere.
    state => moveSheetLayers(state, s => reverseTuckSheetV2(s.dimensions), s => reverseTuckSheet(s.dimensions), ['left', 'front', 'right', 'back', 'top']),
  ],
  'base-box': [
    // 2: the grid is the straight tuck end's cutting template, with tucks,
    // dust flaps and a tapered glue flap, panels creased one board wider;
    // sheet layers move and stretch to keep the walls' and lids' edges.
    state => moveSheetLayers(
      state,
      s => baseBoxSheetV1(s.dimensions, s.openingMode),
      s => baseBoxSheet(s.dimensions, s.openingMode),
      ['left', 'front', 'right', 'back', 'top', 'bottom'],
    ),
  ],
  'split-top-box': [
    // 2: the grid is the slotted box's cutting template, with a flap on every
    // wall at each end, slots between them and a wider joint; sheet layers
    // move and stretch to keep the walls' edges. With the outer top flaps on
    // the front and back, their artwork is named for those walls.
    state => {
      const side = state.splitTopHingeSide ?? 'side_a';
      const moved = moveSheetLayers(state, s => splitTopSheetV1(s.dimensions, side), s => splitTopSheet(s.dimensions, side), ['front', 'right', 'back', 'left']);
      return side === 'side_b' ? { ...moved, artworkByPanel: renamePanels(moved.artworkByPanel, { 'Top Left': 'Top Front', 'Top Right': 'Top Back' }) } : moved;
    },
  ],
  'pizza-box': [
    // 2: artwork placed on the front wall, lid or lid front alone is turned to
    // read upright on the box; stored artwork turns to match.
    state => ({ ...state, artworkByPanel: turnPanelArtwork(state.artworkByPanel, ['Front', 'Top', 'Lid Front']) }),
  ],
};

export function layoutVersionFor(templateId: string) {
  return (STEPS[templateId]?.length ?? 0) + 1;
}

export function migrateStudioLayout(state: StudioProjectState): StudioProjectState {
  return migrateStudioLayoutTo(state, layoutVersionFor(state.templateId));
}

/** Moves a design up to `target` (no further than the current version). */
export function migrateStudioLayoutTo(state: StudioProjectState, target: number): StudioProjectState {
  const steps = STEPS[state.templateId] ?? [];
  let version = state.layoutVersion ?? 1;
  const last = Math.min(target, steps.length + 1);
  if (version >= last) return state;
  let result = state;
  for (; version < last; version++) result = steps[version - 1](result);
  return { ...result, layoutVersion: version };
}

type Point = { x: number; y: number };

function reverseTuckToCuttingTemplate(state: StudioProjectState): StudioProjectState {
  const d = sanitizeCartonDimensions(state.dimensions);
  const oldBounds = reverseTuckBounds(d);
  const oldPanels = reverseTuckPanels(d);
  const sheet = reverseTuckSheetV2(d);
  const newBounds = sheet.bounds;
  const oldBottom = oldPanels.find(panel => panel.id === 'bottom')!;
  const newBottom = sheet.panels.find(panel => panel.id === 'bottom')!;
  const oldTop = oldPanels.find(panel => panel.id === 'top')!;
  const newTop = sheet.panels.find(panel => panel.id === 'top')!;
  // Every panel but the bottom keeps its x and moves down by the top tongue;
  // the bottom now hangs under the back, turned half a turn.
  const shift = newTop.y - oldTop.y;
  const oldBottomCentre = { x: oldBottom.x + oldBottom.width / 2, y: oldBottom.y + oldBottom.height / 2 };
  const newBottomCentre = { x: newBottom.x + newBottom.width / 2, y: newBottom.y + newBottom.height / 2 };
  const bodyIds: string[] = oldPanels.filter(panel => panel.id !== 'bottom').map(panel => panel.id);

  const toPercent = (point: Point) => ({ x: point.x / newBounds.width * 100, y: point.y / newBounds.height * 100 });
  const moveLayers = (layers: FullDielineArtworkLayer[]) => layers.flatMap(layer => {
    const t = layer.transform;
    const centre = { x: t.x / 100 * oldBounds.width, y: t.y / 100 * oldBounds.height };
    const size = { width: t.width / 100 * oldBounds.width, height: t.height / 100 * oldBounds.height };
    const scaled = { width: size.width / newBounds.width * 100, height: size.height / newBounds.height * 100 };
    const allowed = layer.panels ?? oldPanels.map(panel => panel.id);
    const result: FullDielineArtworkLayer[] = [];
    const body = allowed.filter(id => bodyIds.includes(id));
    if (body.length) {
      result.push({ ...layer, panels: body, transform: { ...t, ...toPercent({ x: centre.x, y: centre.y + shift }), ...scaled } });
    }
    if (allowed.includes('bottom') && covers(centre, size, t.rotation, oldBottom)) {
      const turned = { x: newBottomCentre.x - (centre.x - oldBottomCentre.x), y: newBottomCentre.y - (centre.y - oldBottomCentre.y) };
      result.push({
        ...layer,
        id: `${layer.id}-bottom`,
        name: `${layer.name} (bottom)`,
        panels: ['bottom'],
        transform: { ...toPercent(turned), ...scaled, rotation: normalizeAngle(t.rotation + 180) },
      });
    }
    return result;
  });

  return {
    ...state,
    outsideArtworkLayers: moveLayers(state.outsideArtworkLayers),
    insideArtworkLayers: moveLayers(state.insideArtworkLayers),
    artworkByPanel: turnPanelArtwork(state.artworkByPanel, ['Bottom']),
  };
}

function reverseTuckLayersOnFlaps(state: StudioProjectState): StudioProjectState {
  const notBottom = reverseTuckSheetV2(sanitizeCartonDimensions(state.dimensions)).panels.map(panel => panel.id).filter(id => id !== 'bottom');
  const isTurnedBottom = (layer: FullDielineArtworkLayer) => layer.panels?.length === 1 && layer.panels[0] === 'bottom';
  const widen = (layers: FullDielineArtworkLayer[]) => {
    // A bottom printed before (through turned copies) prints exactly as
    // before; a bottom left blank takes the layers that cover it now.
    const panels = layers.some(isTurnedBottom) ? notBottom : undefined;
    return layers.map(layer => layer.panels && !isTurnedBottom(layer) ? { ...layer, panels } : layer);
  };
  return { ...state, outsideArtworkLayers: widen(state.outsideArtworkLayers), insideArtworkLayers: widen(state.insideArtworkLayers) };
}

type Rect = { id: string; x: number; y: number; width: number; height: number };
type Sheet = (state: StudioProjectState) => { panels: Rect[]; bounds: { width: number; height: number } };
type Axis = { scale: number; offset: number };

/** Least-squares a·old + b = new over matching values. */
function fitAxis(pairs: [number, number][]): Axis {
  const n = pairs.length, mx = pairs.reduce((sum, [a]) => sum + a, 0) / n, my = pairs.reduce((sum, [, b]) => sum + b, 0) / n;
  const sxx = pairs.reduce((sum, [a]) => sum + (a - mx) ** 2, 0), sxy = pairs.reduce((sum, [a, b]) => sum + (a - mx) * (b - my), 0);
  const scale = sxx > 1e-9 ? sxy / sxx : 1;
  return { scale, offset: my - scale * mx };
}

/**
 * Moves sheet layers from one cutting template to another of the same carton:
 * a layer kept to one panel maps exactly onto that panel; any other layer
 * takes the move and stretch that best keeps the `fit` panels' edges.
 */
function moveSheetLayers(state: StudioProjectState, from: Sheet, to: Sheet, fit: string[]): StudioProjectState {
  const before = from(state), after = to(state);
  const pairs = (ids: string[]) => ids.flatMap(id => {
    const a = before.panels.find(panel => panel.id === id), b = after.panels.find(panel => panel.id === id);
    return a && b ? [[a, b] as const] : [];
  });
  const axes = (matches: (readonly [Rect, Rect])[]) => ({
    x: fitAxis(matches.flatMap(([a, b]) => [[a.x, b.x], [a.x + a.width, b.x + b.width]] as [number, number][])),
    y: fitAxis(matches.flatMap(([a, b]) => [[a.y, b.y], [a.y + a.height, b.y + b.height]] as [number, number][])),
  });
  const sheetFit = axes(pairs(fit));
  const move = (layers: FullDielineArtworkLayer[]) => layers.map(layer => {
    const single = layer.panels?.length === 1 ? pairs(layer.panels) : [];
    const { x, y } = single.length ? axes(single) : sheetFit;
    const t = layer.transform;
    const centre = { x: t.x / 100 * before.bounds.width, y: t.y / 100 * before.bounds.height };
    const size = { width: t.width / 100 * before.bounds.width, height: t.height / 100 * before.bounds.height };
    // Each side of the image stretches along its own direction on the sheet.
    const angle = t.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    return {
      ...layer,
      transform: {
        ...t,
        x: (x.scale * centre.x + x.offset) / after.bounds.width * 100,
        y: (y.scale * centre.y + y.offset) / after.bounds.height * 100,
        width: Math.hypot(x.scale * cos, y.scale * sin) * size.width / after.bounds.width * 100,
        height: Math.hypot(x.scale * sin, y.scale * cos) * size.height / after.bounds.height * 100,
      },
    };
  });
  return { ...state, outsideArtworkLayers: move(state.outsideArtworkLayers), insideArtworkLayers: move(state.insideArtworkLayers) };
}

/** Moves panel artwork to new panel names, outside and inside. */
function renamePanels(artwork: ArtworkByPanel, names: Record<string, string>): ArtworkByPanel {
  const result: ArtworkByPanel = { ...artwork };
  for (const [from, to] of Object.entries(names)) {
    for (const prefix of ['', 'Interior ']) {
      const placement = artwork[prefix + from];
      if (!placement) continue;
      delete result[prefix + from];
      result[prefix + to] = placement;
    }
  }
  return result;
}

/** Turns the named panels' own artwork (outside and inside) half a turn. */
function turnPanelArtwork(artwork: ArtworkByPanel, panels: string[]): ArtworkByPanel {
  const result: ArtworkByPanel = { ...artwork };
  for (const key of panels.flatMap(panel => [panel, `Interior ${panel}`])) {
    const placement = artwork[key];
    if (placement) result[key] = turnHalf(placement);
  }
  return result;
}

function turnHalf(placement: ArtworkPlacement): ArtworkPlacement {
  const flip = (value: -1 | 0 | 1) => (value === 0 ? 0 : -value) as -1 | 0 | 1;
  if (placement.transform) {
    const t = placement.transform;
    return { ...placement, transform: { ...t, x: 100 - t.x, y: 100 - t.y, rotation: normalizeAngle(t.rotation + 180) } };
  }
  return { ...placement, rotation: normalizeAngle(placement.rotation + 180), alignX: flip(placement.alignX), alignY: flip(placement.alignY) };
}

/** Whether a rotated artwork box overlaps a panel rectangle at all. */
function covers(centre: Point, size: { width: number; height: number }, rotation: number, panel: { x: number; y: number; width: number; height: number }) {
  const angle = rotation * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * size.width + Math.abs(Math.sin(angle)) * size.height) / 2;
  const halfHeight = (Math.abs(Math.sin(angle)) * size.width + Math.abs(Math.cos(angle)) * size.height) / 2;
  return centre.x + halfWidth > panel.x && centre.x - halfWidth < panel.x + panel.width
    && centre.y + halfHeight > panel.y && centre.y - halfHeight < panel.y + panel.height;
}

function normalizeAngle(angle: number) {
  const value = ((angle % 360) + 540) % 360 - 180;
  return value === -180 ? 180 : value;
}
