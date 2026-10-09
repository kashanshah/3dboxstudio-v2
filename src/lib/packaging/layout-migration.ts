import { reverseTuckBounds, reverseTuckPanels, sanitizeCartonDimensions } from './reverse-tuck';
import { reverseTuckSheet } from './templates/reverse-tuck/export';
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
  const steps = STEPS[state.templateId] ?? [];
  let version = state.layoutVersion ?? 1;
  if (version > steps.length) return state;
  let result = state;
  for (; version <= steps.length; version++) result = steps[version - 1](result);
  return { ...result, layoutVersion: version };
}

type Point = { x: number; y: number };

function reverseTuckToCuttingTemplate(state: StudioProjectState): StudioProjectState {
  const d = sanitizeCartonDimensions(state.dimensions);
  const oldBounds = reverseTuckBounds(d);
  const oldPanels = reverseTuckPanels(d);
  const sheet = reverseTuckSheet(d);
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
  const notBottom = reverseTuckSheet(sanitizeCartonDimensions(state.dimensions)).panels.map(panel => panel.id).filter(id => id !== 'bottom');
  const isTurnedBottom = (layer: FullDielineArtworkLayer) => layer.panels?.length === 1 && layer.panels[0] === 'bottom';
  const widen = (layers: FullDielineArtworkLayer[]) => {
    // A bottom printed before (through turned copies) prints exactly as
    // before; a bottom left blank takes the layers that cover it now.
    const panels = layers.some(isTurnedBottom) ? notBottom : undefined;
    return layers.map(layer => layer.panels && !isTurnedBottom(layer) ? { ...layer, panels } : layer);
  };
  return { ...state, outsideArtworkLayers: widen(state.outsideArtworkLayers), insideArtworkLayers: widen(state.insideArtworkLayers) };
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
