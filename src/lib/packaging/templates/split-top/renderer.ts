import { sanitizeCartonDimensions } from '@/lib/packaging/reverse-tuck';
import { splitTopBoxPanels } from '@/lib/packaging/box-structures';
import type { Mesh, TemplateMeshBuilder } from '@/lib/packaging/template-mesh';
import { foldSheet, restingSetback, translation, type SheetHinge } from '@/lib/packaging/fold-sheet';
import { boardThickness, rectangleSheetPanels, substage } from '@/lib/packaging/templates/folded-box';

// Folded from the dieline itself: Front → Right → Back → Left wrap round onto
// the glue flap, the two bottom flaps close under the walls, and the two top
// flaps meet in the middle.

export const buildSplitTopTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor, splitTopHingeSide }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = boardThickness(d);
  const flat = splitTopBoxPanels(d, splitTopHingeSide);
  const front = flat.find(panel => panel.id === 'front')!;
  const formed = Math.min(1, Math.max(0, formation / 100));
  const open = Math.min(1, Math.max(0, opening / 100));
  const quarter = Math.PI / 2;
  const resting = restingSetback(t);
  // The glue flap turns in first; the last wall then closes over it.
  const hinges: SheetHinge[] = [
    { child: 'glue', parent: 'front', angle: substage(formed, 0, 0.5) * quarter, setback: t * 1.1 },
    { child: 'right', parent: 'front', angle: substage(formed, 0, 0.6) * quarter },
    { child: 'back', parent: 'right', angle: substage(formed, 0.1, 0.7) * quarter },
    { child: 'left', parent: 'back', angle: substage(formed, 0.2, 0.8) * quarter },
    { child: 'bottomFront', parent: 'front', angle: substage(formed, 0.7, 1) * quarter, setback: resting },
    { child: 'bottomBack', parent: 'back', angle: substage(formed, 0.7, 1) * quarter, setback: resting },
    { child: 'topLeft', parent: splitTopHingeSide === 'side_b' ? 'front' : 'left', angle: (1 - open) * quarter, setback: resting },
    { child: 'topRight', parent: splitTopHingeSide === 'side_b' ? 'back' : 'right', angle: (1 - open) * quarter, setback: resting },
  ];
  const panels = rectangleSheetPanels(flat).map(panel => ({
    ...panel,
    layer: panel.id === 'glue' ? 0 : flat.find(item => item.id === panel.id)?.kind === 'flap' ? 2 : 1,
  }));
  const placement = translation([-(front.x + front.width / 2), front.y + front.height / 2, d.depth / 2]);
  return foldSheet({ panels, hinges, root: 'front', thickness: t, color, interiorColor, placement }).map(withBottomFallback);
};

// Designs made before the bottom was split print one "Bottom" artwork across
// both bottom flaps.
function withBottomFallback(mesh: Mesh): Mesh {
  const half = mesh.panel?.replace(/^Interior /, '');
  if (half !== 'Bottom Front' && half !== 'Bottom Back') return mesh;
  mesh.fallbackPanel = mesh.panel!.startsWith('Interior ') ? 'Interior Bottom' : 'Bottom';
  mesh.fallbackUv = [0, half === 'Bottom Front' ? 0.5 : 0, 1, 0.5];
  return mesh;
}
