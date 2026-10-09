import { faceNormal, type Mesh } from './template-mesh';

// Folds a flat dieline into 3D the way scored card behaves: every panel is a
// rigid piece of board, and every crease is a short strip of the same sheet
// that bends around a small radius. Outside and inside surfaces stay
// continuous through each fold, and artwork is mapped straight from the
// dieline, so it wraps around the bends with no seam.

type Vec2 = { x: number; y: number };
type Vec3 = [number, number, number];

export type SheetPanel = {
  id: string;
  /** Artwork/picking name ("Front", "Top Tuck"); the inside face is "Interior {name}". */
  name: string;
  /** Dieline outline in millimetres, x right and y down, four corners. */
  outline: Vec2[];
  /** Turn the panel's artwork 180° (a face printed upside down on the sheet). */
  artworkRotation?: 0 | 180;
  closureFlap?: boolean;
  layer?: number;
  /** Leave the panel out of the model (it still anchors its children). */
  hidden?: boolean;
};

export type SheetHinge = {
  child: string;
  parent: string;
  /** Fold angle in radians; positive folds the child toward the inside of the sheet. */
  angle: number;
  /**
   * Moves the effective crease this many millimetres into the parent, so a
   * flap that tucks behind another panel comes to rest inside it, the way
   * real dielines offset such creases by the board thickness. A negative
   * setback moves it into the child, for a lid that rests on the edges of the
   * walls it closes over.
   */
  setback?: number;
};

export type FoldSheetInput = {
  panels: SheetPanel[];
  hinges: SheetHinge[];
  root: string;
  thickness: number;
  color: [number, number, number];
  interiorColor: [number, number, number];
  /** Maps the flat sheet (x right, y up, outside facing +z) into the scene. */
  placement: Mat4;
};

/** Column-major 4×4 matrix. */
export type Mat4 = number[];

const BEND_SEGMENTS = 6;


/**
 * The setback for a lid or flap that closes over the cut edges of the walls
 * it meets and rests on them, rather than cutting into them.
 */
export function restingSetback(thickness: number) {
  const t = Math.max(0, thickness);
  // A plain square fold puts the child's outside 2·3t/π − 1.5t beyond the cut
  // line; a resting lid needs its inside just clear of that line.
  return (6 / Math.PI - 1.5) * t - t * 1.05;
}

export function foldSheet(input: FoldSheetInput): Mesh[] {
  const t = Math.max(0.05, input.thickness);
  const crease = t * 3;
  const byId = new Map(input.panels.map(panel => [panel.id, panel]));
  const children = new Map<string, SheetHinge[]>();
  for (const hinge of input.hinges) children.set(hinge.parent, [...(children.get(hinge.parent) ?? []), hinge]);

  const world = new Map<string, Mat4>();
  const trims = new Map<string, { edge: number; depth: number }[]>();
  const pendingBends: { parent: SheetPanel; child: SheetPanel; q0: Vec3; q1: Vec3; along: Vec3; across: Vec3; angle: number; shift: number; matrix: Mat4; childMatrix: Mat4 }[] = [];
  const flat = (point: Vec2): Vec3 => [point.x, -point.y, 0];

  const visit = (id: string, matrix: Mat4) => {
    world.set(id, matrix);
    const parent = byId.get(id)!;
    for (const hinge of children.get(id) ?? []) {
      const child = byId.get(hinge.child);
      if (!child) continue;
      const shared = sharedEdge(parent.outline, child.outline);
      if (!shared) throw new Error(`No crease between ${hinge.parent} and ${hinge.child}`);
      const q0 = flat(shared.start), q1 = flat(shared.end);
      const along = normalize(sub(q1, q0));
      const centroid = average(child.outline.map(flat));
      let across = normalize(cross([0, 0, 1], along));
      if (dot(sub(centroid, q0), across) < 0) across = scale(across, -1);
      // The score sits `setback` into the parent; the strip of parent between
      // the score and the cut line folds with the child.
      const half = crease / 2;
      const shift = Math.max(-half, hinge.setback ?? 0);
      const local = hingeFrame(sub(q0, scale(across, shift)), along, across, hinge.angle, half, half);
      // Trim the parent where the bend begins, unless the child covers only a
      // small part of that edge, where the bend simply tucks in.
      const parentEdge = shared.parentEdge;
      const parentLength = distance2(parent.outline[parentEdge], parent.outline[(parentEdge + 1) % parent.outline.length]);
      if (distance2(shared.start, shared.end) >= parentLength * 0.75) addTrim(trims, parent.id, parentEdge, shift + half);
      addTrim(trims, child.id, shared.childEdge, Math.max(0, half - shift));
      const childMatrix = multiply(matrix, local);
      if (!parent.hidden && !child.hidden) {
        pendingBends.push({ parent, child, q0, q1, along, across, angle: hinge.angle, shift, matrix, childMatrix });
      }
      visit(child.id, childMatrix);
    }
  };
  visit(input.root, identity());
  // A flap that tucks inside (a setback crease) stays clear of the bends at
  // either end of its parent and of a tongue or glue flap lying along the
  // walls there, as real dielines relieve those flaps. It narrows as the
  // carton folds, so the flat sheet stays exactly the dieline.
  const angles = new Map(input.hinges.map(hinge => [hinge.child, Math.abs(hinge.angle)]));
  const clearance = t * 2.5;
  const outlines = new Map<string, Vec2[]>();
  const trimmedOutline = (panel: SheetPanel) => outlines.get(panel.id) ?? trimOutline(panel.outline, trims.get(panel.id) ?? []);
  for (const bend of pendingBends) {
    const own = trimmedOutline(bend.child);
    if (bend.shift <= 1e-9) { outlines.set(bend.child.id, own); continue; }
    const span = spanAlong(trimmedOutline(bend.parent), bend.q0, bend.along);
    const margin = Math.min(clearance, (span[1] - span[0]) / 4);
    const lo = span[0] + margin, hi = span[1] - margin;
    const folded = Math.max(Math.abs(bend.angle), angles.get(bend.parent.id) ?? 0);
    const amount = Math.min(1, folded / (Math.PI / 2));
    outlines.set(bend.child.id, own.map(point => {
      const u = (point.x - bend.q0[0]) * bend.along[0] + (-point.y - bend.q0[1]) * bend.along[1];
      const shift = (Math.min(hi, Math.max(lo, u)) - u) * amount;
      return { x: point.x + bend.along[0] * shift, y: point.y - bend.along[1] * shift };
    }));
  }
  // A crease stops where the neighbouring creases begin, so two bends never
  // overlap in a corner (the slot a real dieline cuts there).
  const bends = pendingBends.flatMap(bend => bendMeshes({
    ...bend, half: crease / 2, t, input,
    limit: overlap(spanAlong(trimmedOutline(bend.parent), bend.q0, bend.along), spanAlong(trimmedOutline(bend.child), bend.q0, bend.along)),
  }));

  const meshes: Mesh[] = [];
  for (const panel of input.panels) {
    const matrix = world.get(panel.id);
    if (!matrix || panel.hidden) continue;
    const trimmed = trimmedOutline(panel);
    const full = panel.outline.map(flat);
    const place = (p: Vec3) => apply(input.placement, apply(matrix, p));
    const outer = trimmed.map(point => place(flat(point)));
    const inner = trimmed.map(point => place([point.x, -point.y, -t]));
    const uv = trimmed.map(point => panelUv(panel, point));
    const normalCheck = faceNormal(outer);
    const expected = sub(place([0, 0, 1]), place([0, 0, 0]));
    const flip = dot(normalCheck, expected) < 0;
    const order = flip ? [1, 0, 3, 2] : [0, 1, 2, 3];
    const outside = quad(order.map(i => outer[i]), order.map(i => uv[i]), input.color, panel.name);
    // Picking outlines run from the artwork's lower-left corner, as every
    // template's panels do; the inside face is picked from its own surface.
    const pick = cornersByArtwork(panel);
    outside.pickCorners = pick.map(i => place(full[i]));
    const box = boundsOf(panel.outline);
    outside.faceAspect = box.width / box.height;
    outside.uvSize = [box.width, box.height];
    outside.creases = (trims.get(panel.id) ?? []).map(trim => remapEdge(trim.edge, flip));
    if (panel.closureFlap) outside.closureFlap = true;
    if (panel.layer !== undefined) outside.layer = panel.layer;
    const insideOrder = [order[3], order[2], order[1], order[0]];
    const inside = quad(insideOrder.map(i => inner[i]), insideOrder.map(i => insideUv(uv[i])), input.interiorColor, `Interior ${panel.name}`);
    inside.pickCorners = [...pick].reverse().map(i => place([panel.outline[i].x, -panel.outline[i].y, -t]));
    inside.faceAspect = outside.faceAspect;
    inside.uvSize = outside.uvSize;
    if (panel.closureFlap) inside.closureFlap = true;
    meshes.push(outside, inside);
  }
  return [...meshes, ...bends];
}

/** Rigid transform of a child folded `angle` about a crease that bends over arc length a + b. */
function hingeFrame(q0: Vec3, along: Vec3, across: Vec3, angle: number, a: number, b: number): Mat4 {
  const n: Vec3 = [0, 0, 1];
  const L = a + b;
  let origin: Vec3;
  if (Math.abs(angle) < 1e-5) origin = add(q0, scale(across, 0));
  else {
    const R = L / angle;
    const centre = sub(sub(q0, scale(across, a)), scale(n, R));
    const normalEnd = add(scale(n, Math.cos(angle)), scale(across, Math.sin(angle)));
    const tangentEnd = sub(scale(across, Math.cos(angle)), scale(n, Math.sin(angle)));
    origin = sub(add(centre, scale(normalEnd, R)), scale(tangentEnd, b));
  }
  const tangent = sub(scale(across, Math.cos(angle)), scale(n, Math.sin(angle)));
  const normal = add(scale(n, Math.cos(angle)), scale(across, Math.sin(angle)));
  // Basis change: along→along, across→tangent, n→normal, about q0.
  const rotation = basisMap([along, across, n], [along, tangent, normal]);
  return multiply(translation(origin), multiply(rotation, translation(scale(q0, -1))));
}

function bendMeshes(args: {
  parent: SheetPanel; child: SheetPanel; q0: Vec3; q1: Vec3; along: Vec3; across: Vec3;
  angle: number; shift: number; half: number; t: number; matrix: Mat4; childMatrix: Mat4; input: FoldSheetInput; limit: [number, number];
}): Mesh[] {
  const { parent, child, along, across, angle, shift, half, t, matrix, input } = args;
  // Arc coordinates run from the score's centre; the cut line is at +shift.
  const q0 = sub(args.q0, scale(across, shift));
  const a = half, b = half;
  const n: Vec3 = [0, 0, 1];
  const L = a + b;
  const w0 = 0, w1 = distance3(args.q1, q0);
  // Only the stretch of crease both panels share bends.
  const from = Math.max(w0, args.limit[0]), to = Math.min(w1, args.limit[1]);
  if (to - from < 1e-6) return [];
  const pointAt = (s: number, w: number, depth: number): Vec3 => {
    if (Math.abs(angle) < 1e-5) return add(add(add(q0, scale(along, w)), scale(across, s)), scale(n, -depth));
    const R = L / angle;
    const phi = angle * (s + a) / L;
    const centre = sub(sub(q0, scale(across, a)), scale(n, R));
    const radial = add(scale(n, Math.cos(phi)), scale(across, Math.sin(phi)));
    return add(add(centre, scale(radial, R - depth)), scale(along, w));
  };
  const normalAt = (s: number): Vec3 => {
    const phi = Math.abs(angle) < 1e-5 ? 0 : angle * (s + a) / L;
    return add(scale(n, Math.cos(phi)), scale(across, Math.sin(phi)));
  };
  const place = (p: Vec3) => apply(input.placement, apply(matrix, p));
  const placeNormal = (v: Vec3) => normalize(sub(place(v), place([0, 0, 0])));
  // Split the bend where it crosses from the parent's artwork to the child's.
  const steps = Array.from({ length: BEND_SEGMENTS + 1 }, (_, i) => -a + L * i / BEND_SEGMENTS);
  if (shift < b && !steps.some(s => Math.abs(s - shift) < 1e-9)) steps.push(shift);
  steps.sort((x, y) => x - y);
  const meshes: Mesh[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const s0 = steps[i], s1 = steps[i + 1];
    const owner = (s0 + s1) / 2 < shift ? parent : child;
    const dieline = (s: number, w: number) => {
      const p = add(add(q0, scale(along, w)), scale(across, s));
      return panelUv(owner, { x: p[0], y: -p[1] });
    };
    const normal0 = placeNormal(normalAt(s0)), normal1 = placeNormal(normalAt(s1));
    const ownerBox = boundsOf(owner.outline);
    const ownerSize: [number, number] = [ownerBox.width, ownerBox.height];
    // Outside surface, smooth normals around the bend.
    meshes.push(smoothQuad(
      [place(pointAt(s0, from, 0)), place(pointAt(s0, to, 0)), place(pointAt(s1, to, 0)), place(pointAt(s1, from, 0))],
      [normal0, normal0, normal1, normal1],
      [dieline(s0, from), dieline(s0, to), dieline(s1, to), dieline(s1, from)],
      input.color, owner.name, false, ownerSize,
    ));
    meshes.push(smoothQuad(
      [place(pointAt(s1, from, t)), place(pointAt(s1, to, t)), place(pointAt(s0, to, t)), place(pointAt(s0, from, t))],
      [scale(normal1, -1), scale(normal1, -1), scale(normal0, -1), scale(normal0, -1)],
      [dieline(s1, from), dieline(s1, to), dieline(s0, to), dieline(s0, from)].map(insideUv),
      input.interiorColor, `Interior ${owner.name}`, true, ownerSize,
    ));
    // Cut faces at both ends of the bend.
    for (const w of [from, to]) {
      const strip = [place(pointAt(s0, w, 0)), place(pointAt(s1, w, 0)), place(pointAt(s1, w, t)), place(pointAt(s0, w, t))];
      const edgeNormal = faceNormal(strip);
      const edge = smoothQuad(strip, [edgeNormal, edgeNormal, edgeNormal, edgeNormal], [[0, 0], [1, 0], [1, 1], [0, 1]],
        input.color.map(value => value * 0.86) as Vec3, null, false);
      edge.doubleSided = true;
      meshes.push(edge);
    }
  }
  // The strip of parent beyond the score folds flat against the child.
  if (shift > b) {
    const placeChild = (p: Vec3) => apply(input.placement, apply(args.childMatrix, p));
    const flatAt = (s: number, w: number, depth: number): Vec3 => add(add(add(q0, scale(along, w)), scale(across, s)), [0, 0, -depth]);
    const uvAt = (s: number, w: number) => { const p = flatAt(s, w, 0); return panelUv(parent, { x: p[0], y: -p[1] }); };
    const normal = normalize(sub(placeChild([0, 0, 1]), placeChild([0, 0, 0])));
    const ownerBox = boundsOf(parent.outline);
    const size: [number, number] = [ownerBox.width, ownerBox.height];
    const outer = [flatAt(b, from, 0), flatAt(b, to, 0), flatAt(shift, to, 0), flatAt(shift, from, 0)];
    const uvs = [uvAt(b, from), uvAt(b, to), uvAt(shift, to), uvAt(shift, from)];
    meshes.push(smoothQuad(outer.map(placeChild), [normal, normal, normal, normal], uvs, input.color, parent.name, false, size));
    const inner = [flatAt(shift, from, t), flatAt(shift, to, t), flatAt(b, to, t), flatAt(b, from, t)];
    const back = scale(normal, -1);
    meshes.push(smoothQuad(inner.map(placeChild), [back, back, back, back], [uvs[3], uvs[2], uvs[1], uvs[0]].map(insideUv), input.interiorColor, `Interior ${parent.name}`, true, size));
  }
  return meshes;
}

function smoothQuad(corners: Vec3[], normals: Vec3[], uvs: number[][], color: Vec3, panel: string | null, inside: boolean, uvSize?: [number, number]): Mesh {
  const order = [0, 1, 2, 0, 2, 3];
  const vertices: number[] = [];
  for (const i of order) vertices.push(...corners[i], ...normals[i], uvs[i][0], uvs[i][1]);
  const mesh: Mesh = { vertices: new Float32Array(vertices), useTexture: !!panel, color };
  if (uvSize) mesh.uvSize = uvSize;
  if (panel) {
    // Borrow the panel's artwork without becoming a pickable panel itself.
    mesh.fallbackPanel = panel;
    mesh.bend = inside ? 'inside' : 'outside';
  } else {
    mesh.bend = 'edge';
  }
  return mesh;
}

function quad(corners: Vec3[], uvs: number[][], color: Vec3, panel: string): Mesh {
  const normal = faceNormal(corners) as Vec3;
  const order = [0, 1, 2, 0, 2, 3];
  const vertices: number[] = [];
  for (const i of order) vertices.push(...corners[i], ...normal, uvs[i][0], uvs[i][1]);
  return { vertices: new Float32Array(vertices), useTexture: true, color, panel };
}

/**
 * Inside artwork runs the same way across the panel as the outside and is
 * turned over top to bottom, as every template has always mapped it, so
 * inside designs keep printing and showing exactly as they were made.
 */
function insideUv(uv: number[]) {
  return [uv[0], 1 - uv[1]];
}

/** Outline corner indices nearest the artwork's (0,0), (1,0), (1,1) and (0,1). */
function cornersByArtwork(panel: SheetPanel) {
  const uvs = panel.outline.map(point => panelUv(panel, point));
  return [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
    let best = 0;
    uvs.forEach((uv, i) => { if (Math.hypot(uv[0] - u, uv[1] - v) < Math.hypot(uvs[best][0] - u, uvs[best][1] - v)) best = i; });
    return best;
  });
}

/** Texture coordinates inside the panel's bounding box, v up, as the 3D view expects. */
function panelUv(panel: SheetPanel, point: Vec2) {
  const box = boundsOf(panel.outline);
  let u = (point.x - box.x) / box.width;
  let v = 1 - (point.y - box.y) / box.height;
  if (panel.artworkRotation === 180) { u = 1 - u; v = 1 - v; }
  return [u, v];
}

function sharedEdge(parent: Vec2[], child: Vec2[]) {
  for (let i = 0; i < parent.length; i++) {
    const p0 = parent[i], p1 = parent[(i + 1) % parent.length];
    for (let j = 0; j < child.length; j++) {
      const c0 = child[j], c1 = child[(j + 1) % child.length];
      const direction = { x: p1.x - p0.x, y: p1.y - p0.y };
      const length = Math.hypot(direction.x, direction.y);
      if (length < 1e-9) continue;
      const unit = { x: direction.x / length, y: direction.y / length };
      const offset = (q: Vec2) => Math.abs((q.x - p0.x) * unit.y - (q.y - p0.y) * unit.x);
      if (offset(c0) > 1e-6 || offset(c1) > 1e-6) continue;
      const t0 = (c0.x - p0.x) * unit.x + (c0.y - p0.y) * unit.y;
      const t1 = (c1.x - p0.x) * unit.x + (c1.y - p0.y) * unit.y;
      const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(length, Math.max(t0, t1));
      if (hi - lo < 1e-6) continue;
      return {
        start: { x: p0.x + unit.x * lo, y: p0.y + unit.y * lo },
        end: { x: p0.x + unit.x * hi, y: p0.y + unit.y * hi },
        parentEdge: i,
        childEdge: j,
      };
    }
  }
  return null;
}

function spanAlong(outline: Vec2[], q0: Vec3, along: Vec3): [number, number] {
  const values = outline.map(point => (point.x - q0[0]) * along[0] + (-point.y - q0[1]) * along[1]);
  return [Math.min(...values), Math.max(...values)];
}

function overlap(a: [number, number], b: [number, number]): [number, number] {
  return [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
}

function addTrim(trims: Map<string, { edge: number; depth: number }[]>, id: string, edge: number, depth: number) {
  trims.set(id, [...(trims.get(id) ?? []), { edge, depth }]);
}

/** Pull each trimmed edge of the outline in by `depth`, keeping the panel a quad. */
function trimOutline(outline: Vec2[], trims: { edge: number; depth: number }[]) {
  const points = outline.map(point => ({ ...point }));
  const count = points.length;
  for (const { edge, depth } of trims) {
    const a = points[edge], b = points[(edge + 1) % count];
    // Inward normal of this edge: toward the polygon's centre.
    const centre = average2(outline);
    let normal = { x: -(b.y - a.y), y: b.x - a.x };
    const length = Math.hypot(normal.x, normal.y) || 1;
    normal = { x: normal.x / length, y: normal.y / length };
    if ((centre.x - a.x) * normal.x + (centre.y - a.y) * normal.y < 0) normal = { x: -normal.x, y: -normal.y };
    // Slide each end along its neighbouring side so the shape stays a quad.
    for (const [corner, neighbour] of [[edge, (edge + count - 1) % count], [(edge + 1) % count, (edge + 2) % count]]) {
      const from = points[corner], to = points[neighbour];
      const side = { x: to.x - from.x, y: to.y - from.y };
      const rate = side.x * normal.x + side.y * normal.y;
      if (Math.abs(rate) < 1e-9) continue;
      const k = Math.min(0.45, depth / rate);
      points[corner] = { x: from.x + side.x * k, y: from.y + side.y * k };
    }
  }
  return points;
}

/** Edge index after the corner order [1,0,3,2] flip used for back-facing outlines. */
function remapEdge(edge: number, flipped: boolean) {
  if (!flipped) return edge;
  // Original edge i joins corners i and i+1; in [1,0,3,2] order those sit at:
  return [0, 3, 2, 1][edge];
}

function boundsOf(outline: Vec2[]) {
  const xs = outline.map(point => point.x), ys = outline.map(point => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(1e-9, Math.max(...xs) - x), height: Math.max(1e-9, Math.max(...ys) - y) };
}

export function identity(): Mat4 { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
export function translation(v: Vec3): Mat4 { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, v[0], v[1], v[2], 1]; }
export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}
export function apply(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}
/** The rotation taking orthonormal basis `from` onto `to`. */
function basisMap(from: Vec3[], to: Vec3[]): Mat4 {
  const out = identity();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    out[c * 4 + r] = from.reduce((sum, f, k) => sum + to[k][r] * f[c], 0);
  }
  return out;
}

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const average = (points: Vec3[]): Vec3 => scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
const average2 = (points: Vec2[]) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });
const distance2 = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const distance3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
