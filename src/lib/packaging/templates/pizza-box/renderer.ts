import { sanitizeCartonDimensions } from '../../reverse-tuck';
import { faceNormal, quadFromCorners, type Mesh, type TemplateMeshBuilder } from '../../template-mesh';
import { getPizzaBoxPanels } from './geometry';

function rotate(p: number[], pivot: number[], angle: number, axis: 'x' | 'z') {
  const q = p.map((v, i) => v - pivot[i]);
  const c = Math.cos(angle), s = Math.sin(angle);
  const r = axis === 'x'
    ? [q[0], q[1] * c - q[2] * s, q[1] * s + q[2] * c]
    : [q[0] * c - q[1] * s, q[0] * s + q[1] * c, q[2]];
  return r.map((v, i) => v + pivot[i]);
}

/** Eased progress of one fold stage inside the overall 0–1 formation. */
function stage(value: number, start: number, end: number) {
  const x = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return x * x * (3 - 2 * x);
}

/** Boards between a tucked flap and the wall it rests against, plus a hair of air. */
const TUCK = 1.05;

export const buildPizzaBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const t = d.thickness;
  const panels = getPizzaBoxPanels(d);
  const base = panels.find(panel => panel.id === 'bottom')!;
  const y = -d.height / 2, left = -d.width / 2, right = d.width / 2;
  const back = -d.depth / 2, front = d.depth / 2;
  const formed = Math.max(0, Math.min(100, formation)) / 100;
  const quarter = Math.PI / 2;
  // Fold order of a real tray: side walls up, their corner ears in, then the
  // front and back walls up over the ears; the lid's skirts fold last.
  const sideFold = stage(formed, 0, 0.35) * quarter;
  const earFold = stage(formed, 0.2, 0.55) * quarter;
  const wallFold = stage(formed, 0.45, 0.9) * quarter;
  const skirtFold = stage(formed, 0.6, 1) * quarter;
  const close = Math.max(0, Math.min(100, 100 - opening)) / 100 * wallFold;
  const backHinge = [0, y, back];
  const lidHinge = [0, y, back - d.height];
  const lidFar = back - d.height - d.depth;
  const rear = (p: number[]) => rotate(p, backHinge, wallFold, 'x');
  const lid = (p: number[]) => rear(rotate(p, lidHinge, close, 'x'));
  const side = (p: number[], isLeft: boolean) => rotate(p, [isLeft ? left : right, y, 0], isLeft ? -sideFold : sideFold, 'z');
  // Tucked flaps bend around a line just inside their crease, like scored
  // card, so they come to rest one or two boards inside the wall they tuck
  // behind instead of sharing its plane.
  const earSetback = t * TUCK;
  // The lid's front skirt tucks behind the front ears, one layer deeper.
  const frontSkirtSetback = t * (2 * TUCK + 0.05);
  const sideSkirtSetback = t * TUCK;
  // Skirts stop short of the corners, where the ears and the other skirts are.
  const skirtEnd = t * 3.6;
  const meshes: Mesh[] = [];

  for (const panel of panels) {
    let x0 = panel.x - base.x - d.width / 2, x1 = x0 + panel.width;
    let z0 = panel.y - base.y - d.depth / 2, z1 = z0 + panel.height;
    if (panel.id === 'lidFront') { x0 += skirtEnd; x1 -= skirtEnd; }
    if (panel.id === 'lidLeft' || panel.id === 'lidRight') { z0 += skirtEnd; z1 -= skirtEnd; }
    // All artwork UVs follow the same left-to-right, top-to-bottom sheet axes.
    const flat = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
    const corners = flat.map(p => {
      switch (panel.id) {
        case 'front': return rotate(p, [0, y, front], -wallFold, 'x');
        case 'back': return rear(p);
        case 'left': return side(p, true);
        case 'right': return side(p, false);
        case 'top': return lid(p);
        case 'lidFront': return lid(rotate(p, [0, y, lidFar + frontSkirtSetback], skirtFold, 'x'));
        case 'lidLeft': return lid(rotate(p, [left + sideSkirtSetback, y, 0], -skirtFold, 'z'));
        case 'lidRight': return lid(rotate(p, [right - sideSkirtSetback, y, 0], skirtFold, 'z'));
        case 'leftBackTab': case 'rightBackTab':
          return side(rotate(p, [0, y, back + earSetback], earFold, 'x'), panel.id.startsWith('left'));
        case 'leftFrontTab': case 'rightFrontTab':
          return side(rotate(p, [0, y, front - earSetback], -earFold, 'x'), panel.id.startsWith('left'));
        default: return p;
      }
    });
    const name = panel.label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    const outside = quadFromCorners(corners, color, true, name);
    // The front and back walls run the full width, over the side walls' ends.
    if (panel.id === 'front' || panel.id === 'back') outside.layer = 1.5;
    meshes.push(outside);
    const normal = faceNormal(corners);
    const inner = corners.map(p => p.map((v, i) => v - normal[i] * t));
    meshes.push(quadFromCorners([inner[3], inner[2], inner[1], inner[0]], interiorColor, true, `Interior ${name}`));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const edge = quadFromCorners([corners[i], inner[i], inner[j], corners[j]], interiorColor);
      edge.doubleSided = true;
      meshes.push(edge);
    }
  }
  return meshes;
};
