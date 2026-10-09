import type { Mesh, TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, translation, type SheetHinge, type SheetPanel } from '@/lib/packaging/fold-sheet';
import { boardThickness, panelName, substage } from '@/lib/packaging/templates/folded-box';
import { sanitizeSplitTopDimensions, splitTopSheet } from './geometry';

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
