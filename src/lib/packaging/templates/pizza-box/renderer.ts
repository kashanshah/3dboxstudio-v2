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

export const buildPizzaBoxTemplateMeshes: TemplateMeshBuilder = ({ dimensions, formation, opening, color, interiorColor }) => {
  const d = sanitizeCartonDimensions(dimensions);
  const panels = getPizzaBoxPanels(d);
  const base = panels.find(panel => panel.id === 'bottom')!;
  const y = -d.height / 2, left = -d.width / 2, right = d.width / 2;
  const back = -d.depth / 2, front = d.depth / 2;
  const fold = Math.max(0, Math.min(100, formation)) / 100 * Math.PI / 2;
  const close = Math.max(0, Math.min(100, 100 - opening)) / 100 * fold;
  const backHinge = [0, y, back];
  const lidHinge = [0, y, back - d.height];
  const lidFar = back - d.height - d.depth;
  const rear = (p: number[]) => rotate(p, backHinge, fold, 'x');
  const lid = (p: number[]) => rear(rotate(p, lidHinge, close, 'x'));
  const side = (p: number[], isLeft: boolean) => rotate(p, [isLeft ? left : right, y, 0], isLeft ? -fold : fold, 'z');
  const meshes: Mesh[] = [];

  for (const panel of panels) {
    const x0 = panel.x - base.x - d.width / 2, x1 = x0 + panel.width;
    const z0 = panel.y - base.y - d.depth / 2, z1 = z0 + panel.height;
    // All artwork UVs follow the same left-to-right, top-to-bottom sheet axes.
    const flat = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
    const corners = flat.map(p => {
      switch (panel.id) {
        case 'front': return rotate(p, [0, y, front], -fold, 'x');
        case 'back': return rear(p);
        case 'left': return side(p, true);
        case 'right': return side(p, false);
        case 'top': return lid(p);
        case 'lidFront': return lid(rotate(p, [0, y, lidFar], fold * 1.02, 'x'));
        // A slight inward overfold keeps lid skirts clear of the tray walls.
        case 'lidLeft': return lid(rotate(p, [left, y, 0], -fold * 1.02, 'z'));
        case 'lidRight': return lid(rotate(p, [right, y, 0], fold * 1.02, 'z'));
        case 'leftBackTab': case 'rightBackTab':
          return side(rotate(p, [0, y, back], fold * 1.02, 'x'), panel.id.startsWith('left'));
        case 'leftFrontTab': case 'rightFrontTab':
          return side(rotate(p, [0, y, front], -fold * 1.02, 'x'), panel.id.startsWith('left'));
        default: return p;
      }
    });
    const name = panel.label.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    meshes.push(quadFromCorners(corners, color, true, name));
    const normal = faceNormal(corners);
    const inner = corners.map(p => p.map((v, i) => v - normal[i] * d.thickness));
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
