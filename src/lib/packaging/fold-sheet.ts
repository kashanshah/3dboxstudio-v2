import { CORRUGATED_THICKNESS, faceNormal, type Mesh } from './template-mesh';

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
  /**
   * The outline the artwork spans, when this is one piece of a larger panel
   * (a strip of a bowed face): the piece prints its part of that panel.
   */
  artworkFrame?: Vec2[];
  /**
   * The panel this is a strip of. Strips of one panel bend into each other
   * with no crease: they join edge to edge and shade as one smooth surface.
   */
  piece?: string;
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
  /**
   * Fold on the crease line itself, with no rounded bend of board: the two
   * panels meet edge to edge. For the edges of bowed panels made of strips,
   * which must close exactly, such as a pillow box's sides.
   */
  sharp?: boolean;
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
  /** Filled with each panel's placement in the scene, from the flat sheet (x right, y up). */
  frames?: Map<string, Mat4>;
};

/** Column-major 4×4 matrix. */
export type Mat4 = number[];

const BEND_SEGMENTS = 6;

/**
 * How wide each crease's bend is, in board thicknesses. Scored board folds
 * tight: the bend is a little wider than the board is thick, so corners read
 * crisp and the gap where two bends meet stays small.
 */
export const CREASE_WIDTH = 2.2;

/** Half a crease's bend, in millimetres: the most a setback may move into the child. */
export function creaseHalfWidth(thickness: number) {
  return Math.max(0.05, thickness) * CREASE_WIDTH / 2;
}


/**
 * The setback for a lid or flap that closes over the cut edges of the walls
 * it meets and rests on them, rather than cutting into them.
 */
export function restingSetback(thickness: number) {
  const t = Math.max(0, thickness), w = CREASE_WIDTH * t;
  // A plain square fold of a bend w wide puts the child's outside 2w/π − w/2
  // beyond the cut line; a resting lid needs its inside just clear of that line.
  return Math.max(-w / 2, (2 / Math.PI - 0.5) * w - t * 1.05);
}

export function foldSheet(input: FoldSheetInput): Mesh[] {
  const t = Math.max(0.05, input.thickness);
  const crease = t * CREASE_WIDTH;
  const byId = new Map(input.panels.map(panel => [panel.id, panel]));
  const children = new Map<string, SheetHinge[]>();
  for (const hinge of input.hinges) children.set(hinge.parent, [...(children.get(hinge.parent) ?? []), hinge]);

  const world = new Map<string, Mat4>();
  const trims = new Map<string, Trim[]>();
  const pendingBends: { parent: SheetPanel; child: SheetPanel; q0: Vec3; q1: Vec3; along: Vec3; across: Vec3; angle: number; shift: number; matrix: Mat4; childMatrix: Mat4; parentTrimmed: boolean }[] = [];
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
      if (hinge.sharp || (parent.piece && parent.piece === child.piece)) {
        // Two strips of one bowed panel, or a sharp fold: turn about the
        // crease line itself, set back into the parent if asked.
        let across = normalize(cross([0, 0, 1], along));
        if (dot(sub(average(child.outline.map(flat)), q0), across) < 0) across = scale(across, -1);
        visit(child.id, multiply(matrix, hingeFrame(sub(q0, scale(across, hinge.setback ?? 0)), along, across, hinge.angle, 0, 0)));
        continue;
      }
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
      const parentTrimmed = distance2(shared.start, shared.end) >= parentLength * 0.75;
      if (parentTrimmed) addTrim(trims, parent.id, parentEdge, shift + half, shift <= 1e-9);
      addTrim(trims, child.id, shared.childEdge, Math.max(0, half - shift), false);
      const childMatrix = multiply(matrix, local);
      if (!parent.hidden && !child.hidden) {
        pendingBends.push({ parent, child, q0, q1, along, across, angle: hinge.angle, shift, matrix, childMatrix, parentTrimmed });
      }
      visit(child.id, childMatrix);
    }
  };
  visit(input.root, identity());
  for (const [id, matrix] of world) input.frames?.set(id, multiply(input.placement, matrix));
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
  // overlap in a corner. The exception is a corner where a panel folds both
  // creases that meet there and neither tucks inside (a carton's front, under
  // its lid and beside its walls): the panel's half of each bend runs on into
  // that corner and closes it, as the board does when it folds there, rather
  // than leaving a slot.
  const cornerReach = (panel: SheetPanel) => outlines.has(panel.id)
    ? trimmedOutline(panel)
    : trimOutline(panel.outline, (trims.get(panel.id) ?? []).filter(trim => !trim.corner));
  const built = pendingBends.map(bend => {
    const limit = creaseLimit(bend, trimmedOutline, crease / 2);
    const parentLimit = bend.shift <= 1e-9 ? spanAlong(cornerReach(bend.parent), bend.q0, bend.along) : limit;
    return bendMeshes({ ...bend, half: crease / 2, t, input, limit, parentLimit });
  });
  const ends = built.flatMap(bend => bend.ends);
  const bends = [
    ...built.flatMap(bend => bend.meshes), ...cornerMeshes(ends, input), ...rollEndCaps(ends, input),
    ...uncreasedEdges(pendingBends, trimmedOutline, crease / 2, t, input),
  ];

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
    const box = artworkBox(panel);
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
  smoothPieces(meshes, input.panels);
  return [...meshes, ...bends];
}

/**
 * Strips of one bowed panel shade as one surface: where strips meet, each
 * corner takes the average of the normals of the strips that share it.
 */
function smoothPieces(meshes: Mesh[], panels: SheetPanel[]) {
  const pieceOf = new Map(panels.filter(panel => panel.piece).map(panel => [panel.name, panel.piece!]));
  if (!pieceOf.size) return;
  const groups = new Map<string, Mesh[]>();
  for (const mesh of meshes) {
    const name = mesh.panel?.replace(/^Interior /, '');
    if (!name || !pieceOf.has(name)) continue;
    const key = `${mesh.panel}`;
    groups.set(key, [...(groups.get(key) ?? []), mesh]);
  }
  const at = (v: Float32Array, i: number) => `${v[i].toFixed(3)},${v[i + 1].toFixed(3)},${v[i + 2].toFixed(3)}`;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sums = new Map<string, Vec3>();
    for (const mesh of group) {
      const v = mesh.vertices;
      // Each face counts once per corner, though its two triangles repeat corners.
      const seen = new Set<string>();
      for (let i = 0; i < v.length; i += 8) {
        const key = at(v, i);
        if (seen.has(key)) continue;
        seen.add(key);
        sums.set(key, add(sums.get(key) ?? [0, 0, 0], [v[i + 3], v[i + 4], v[i + 5]]));
      }
    }
    for (const mesh of group) {
      const v = mesh.vertices;
      for (let i = 0; i < v.length; i += 8) {
        const n = normalize(sums.get(at(v, i))!);
        v[i + 3] = n[0]; v[i + 4] = n[1]; v[i + 5] = n[2];
      }
    }
  }
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

/** Where a bend ends: the axis point there and the bend's start and end directions, in the scene. */
type BendEnd = {
  centre: Vec3;
  /** Signed bend radius in scene units, and the board's thickness. */
  radius: number;
  thickness: number;
  angle: number;
  /** Outward directions where the bend leaves the parent and meets the child. */
  directions: [Vec3, Vec3];
  /** The panel whose print each direction's side carries, with its texture coordinates there. */
  print: [{ panel: SheetPanel; uv: number[] }, { panel: SheetPanel; uv: number[] }];
  /** The crease's direction, and the bend's inside surface across this end, from the parent to the child. */
  axis: Vec3;
  inner: Vec3[];
};

function bendMeshes(args: {
  parent: SheetPanel; child: SheetPanel; q0: Vec3; q1: Vec3; along: Vec3; across: Vec3;
  angle: number; shift: number; half: number; t: number; matrix: Mat4; childMatrix: Mat4; input: FoldSheetInput; limit: [number, number]; parentLimit: [number, number];
}): { meshes: Mesh[]; ends: BendEnd[] } {
  const { parent, child, along, across, angle, shift, half, t, matrix, input } = args;
  // Arc coordinates run from the score's centre; the cut line is at +shift.
  const q0 = sub(args.q0, scale(across, shift));
  const a = half, b = half;
  const n: Vec3 = [0, 0, 1];
  const L = a + b;
  const w1 = distance3(args.q1, q0);
  // The stretch that bends (see creaseLimit); the parent's half may run on
  // into a corner it folds on both sides.
  const [from, to] = args.limit;
  if (to - from < 1e-6) return { meshes: [], ends: [] };
  const parentFrom = Math.min(from, Math.max(0, args.parentLimit[0])), parentTo = Math.max(to, Math.min(w1, args.parentLimit[1]));
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
    const [lo, hi] = owner === parent ? [parentFrom, parentTo] : [from, to];
    const dieline = (s: number, w: number) => {
      const p = add(add(q0, scale(along, w)), scale(across, s));
      return panelUv(owner, { x: p[0], y: -p[1] });
    };
    const normal0 = placeNormal(normalAt(s0)), normal1 = placeNormal(normalAt(s1));
    const ownerBox = artworkBox(owner);
    const ownerSize: [number, number] = [ownerBox.width, ownerBox.height];
    // Outside surface, smooth normals around the bend.
    meshes.push(smoothQuad(
      [place(pointAt(s0, lo, 0)), place(pointAt(s0, hi, 0)), place(pointAt(s1, hi, 0)), place(pointAt(s1, lo, 0))],
      [normal0, normal0, normal1, normal1],
      [dieline(s0, lo), dieline(s0, hi), dieline(s1, hi), dieline(s1, lo)],
      input.color, owner.name, false, ownerSize,
    ));
    meshes.push(smoothQuad(
      [place(pointAt(s1, lo, t)), place(pointAt(s1, hi, t)), place(pointAt(s0, hi, t)), place(pointAt(s0, lo, t))],
      [scale(normal1, -1), scale(normal1, -1), scale(normal0, -1), scale(normal0, -1)],
      [dieline(s1, lo), dieline(s1, hi), dieline(s0, hi), dieline(s0, lo)].map(insideUv),
      input.interiorColor, `Interior ${owner.name}`, true, ownerSize,
    ));
    // Cut faces at both ends of the bend.
    for (const w of [lo, hi]) {
      const strip = [place(pointAt(s0, w, 0)), place(pointAt(s1, w, 0)), place(pointAt(s1, w, t)), place(pointAt(s0, w, t))];
      const edgeNormal = faceNormal(strip);
      // Printed board shows its print right up to the cut, so the end of a
      // fold reads as part of the box, not as a hole; corrugated shows flutes.
      const printed = t < CORRUGATED_THICKNESS;
      const uvs = printed ? [dieline(s0, w), dieline(s1, w), dieline(s1, w), dieline(s0, w)] : [[0, 0], [1, 0], [1, 1], [0, 1]];
      const edge = smoothQuad(strip, [edgeNormal, edgeNormal, edgeNormal, edgeNormal], uvs,
        input.color.map(value => value * 0.86) as Vec3, null, false);
      edge.doubleSided = true;
      if (printed) printedEdge(edge, owner.name, ownerSize);
      meshes.push(edge);
    }
  }
  // The strip of parent beyond the score folds flat against the child.
  if (shift > b) {
    const placeChild = (p: Vec3) => apply(input.placement, apply(args.childMatrix, p));
    const flatAt = (s: number, w: number, depth: number): Vec3 => add(add(add(q0, scale(along, w)), scale(across, s)), [0, 0, -depth]);
    const uvAt = (s: number, w: number) => { const p = flatAt(s, w, 0); return panelUv(parent, { x: p[0], y: -p[1] }); };
    const normal = normalize(sub(placeChild([0, 0, 1]), placeChild([0, 0, 0])));
    const ownerBox = artworkBox(parent);
    const size: [number, number] = [ownerBox.width, ownerBox.height];
    const outer = [flatAt(b, from, 0), flatAt(b, to, 0), flatAt(shift, to, 0), flatAt(shift, from, 0)];
    const uvs = [uvAt(b, from), uvAt(b, to), uvAt(shift, to), uvAt(shift, from)];
    meshes.push(smoothQuad(outer.map(placeChild), [normal, normal, normal, normal], uvs, input.color, parent.name, false, size));
    const inner = [flatAt(shift, from, t), flatAt(shift, to, t), flatAt(b, to, t), flatAt(b, from, t)];
    const back = scale(normal, -1);
    meshes.push(smoothQuad(inner.map(placeChild), [back, back, back, back], [uvs[3], uvs[2], uvs[1], uvs[0]].map(insideUv), input.interiorColor, `Interior ${parent.name}`, true, size));
  }
  // Ends that can meet another bend's end in a rounded corner: any fold bent
  // far enough to have a clear axis.
  const ends: BendEnd[] = [];
  if (Math.abs(angle) > 0.2) {
    const unit = distance3(place([0, 0, 0]), place([1, 0, 0]));
    const radius = L / angle;
    // A corner the parent's half already runs into is closed; it needs no corner piece.
    const closed = (w: number) => w === from ? parentFrom < from - 1e-6 : parentTo > to + 1e-6;
    for (const w of [from, to]) {
      if (closed(w)) continue;
      const flatPoint = (s: number) => { const p = add(add(q0, scale(along, w)), scale(across, s)); return { x: p[0], y: -p[1] }; };
      ends.push({
        centre: place(pointAt(0, w, radius)), radius: radius * unit, thickness: t * unit, angle: Math.abs(angle),
        directions: [placeNormal(normalAt(-a)), placeNormal(normalAt(b))],
        print: [{ panel: parent, uv: panelUv(parent, flatPoint(-a)) }, { panel: child, uv: panelUv(child, flatPoint(b)) }],
        axis: normalize(sub(place(along), place([0, 0, 0]))),
        inner: Array.from({ length: BEND_SEGMENTS + 1 }, (_, i) => place(pointAt(-a + L * i / BEND_SEGMENTS, w, t))),
      });
    }
  }
  return { meshes, ends };
}

const CORNER_SEGMENTS = 6;

/**
 * Where two bends meet at a corner of the box, their ends share an axis point
 * and a direction (the panel both leave or one passes to the other). The gap
 * between them is filled with the matching piece of a sphere, as a rounded
 * box corner, so the corner reads closed instead of as a notch into the box.
 */
function cornerMeshes(ends: BendEnd[], input: FoldSheetInput): Mesh[] {
  const meshes: Mesh[] = [];
  const made: { centre: Vec3; directions: Vec3[] }[] = [];
  const same = (a: Vec3, b: Vec3) => dot(a, b) > 0.995;
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const e1 = ends[i], e2 = ends[j];
    const size = Math.abs(e1.radius);
    // Folds closed to slightly different angles still meet; the corner follows their average.
    if (distance3(e1.centre, e2.centre) > 0.1 * size + 1e-6 || Math.abs(e1.radius - e2.radius) > 0.1 * size || Math.abs(e1.angle - e2.angle) > 0.2) continue;
    let shared = -1, other = -1;
    for (let k = 0; k < 2 && shared < 0; k++) for (let m = 0; m < 2; m++) if (same(e1.directions[k], e2.directions[m])) { shared = k; other = m; break; }
    if (shared < 0) continue;
    const corner = [e1.directions[shared], e1.directions[1 - shared], e2.directions[1 - other]];
    if (same(corner[1], corner[2]) || dot(corner[1], corner[2]) < -0.5) continue;
    if (made.some(item => distance3(item.centre, e1.centre) < 0.1 * size + 1e-6 && corner.every(d => item.directions.some(e => same(d, e))))) continue;
    made.push({ centre: e1.centre, directions: corner });
    const centre = scale(add(e1.centre, e2.centre), 0.5);
    meshes.push(...spherePatch(centre, (e1.radius + e2.radius) / 2, e1.thickness, corner, (e1.angle + e2.angle) / 2, e1.print[shared], input));
  }
  return meshes;
}

/** The outside and inside of a sphere's triangle between three unit directions, as board `thickness` thick. */
function spherePatch(centre: Vec3, radius: number, thickness: number, corner: Vec3[], angle: number, print: { panel: SheetPanel; uv: number[] }, input: FoldSheetInput): Mesh[] {
  const n = CORNER_SEGMENTS;
  // Weights that move evenly along each edge, so the edges match the bends' segments.
  const direction = (i: number, j: number) => {
    const b = [(n - i - j) / n, i / n, j / n];
    return normalize(corner.reduce((sum, d, k) => add(sum, scale(d, Math.sin(b[k] * angle))), [0, 0, 0] as Vec3));
  };
  const box = artworkBox(print.panel);
  const size: [number, number] = [box.width, box.height];
  const surface = (depth: number, inside: boolean) => {
    const vertices: number[] = [];
    const point = (d: Vec3) => add(centre, scale(d, radius - depth));
    const uv = inside ? insideUv(print.uv) : print.uv;
    const triangle = (a: Vec3, b: Vec3, c: Vec3) => {
      const outward = normalize(add(add(a, b), c));
      const want = inside ? scale(outward, -1) : outward;
      let order = [a, b, c];
      const [pa, pb, pc] = order.map(point);
      if (dot(cross(sub(pb, pa), sub(pc, pa)), want) < 0) order = [a, c, b];
      for (const d of order) vertices.push(...point(d), ...(inside ? scale(d, -1) : d), uv[0], uv[1]);
    };
    for (let i = 0; i < n; i++) for (let j = 0; j < n - i; j++) {
      triangle(direction(i, j), direction(i + 1, j), direction(i, j + 1));
      if (i + j < n - 1) triangle(direction(i + 1, j), direction(i + 1, j + 1), direction(i, j + 1));
    }
    const mesh: Mesh = {
      vertices: new Float32Array(vertices), useTexture: true, color: inside ? input.interiorColor : input.color,
      sourcePanel: inside ? `Interior ${print.panel.name}` : print.panel.name, uvSize: size, faceAspect: size[0] / size[1],
      bend: inside ? 'inside' : 'outside',
    };
    return mesh;
  };
  return [surface(0, false), surface(thickness, true)];
}

type CreaseBend = { parent: SheetPanel; child: SheetPanel; q0: Vec3; q1: Vec3; along: Vec3; across: Vec3; shift: number; matrix: Mat4; parentTrimmed: boolean };

/**
 * The stretch of a crease that bends. A score runs the whole edge it is cut
 * along, so where the bend carries only the parent's board (a flap set back
 * from the edge, or the crease at the edge itself) it runs the parent's edge
 * even past a narrower flap; otherwise it bends only where both panels meet.
 */
function creaseLimit(bend: CreaseBend, trimmedOutline: (panel: SheetPanel) => Vec2[], half: number): [number, number] {
  const parent = spanAlong(trimmedOutline(bend.parent), bend.q0, bend.along);
  if (bend.parentTrimmed && bend.shift >= half - 1e-9) return parent;
  const shared = overlap(parent, spanAlong(trimmedOutline(bend.child), bend.q0, bend.along));
  return [Math.max(0, shared[0]), Math.min(distance3(bend.q1, bend.q0), shared[1])];
}

/**
 * Where a side is folded double over a narrow strip (a mailer's rolled side
 * wall), the hollow inside the roll shows at each end as a hole into the box.
 * Real board is crushed tight there, so the end of the roll is closed with
 * a cut face of board.
 */
function rollEndCaps(ends: BendEnd[], input: FoldSheetInput): Mesh[] {
  const meshes: Mesh[] = [];
  for (const first of ends) for (const second of ends) {
    if (first.print[1].panel.id !== second.print[0].panel.id || first === second) continue;
    // A U turn: the panel before the strip and the one after it face apart.
    if (dot(first.directions[0], second.directions[1]) > -0.9) continue;
    const a = first.inner[first.inner.length - 1], b = second.inner[0];
    if (Math.abs(dot(first.axis, sub(b, a))) > 0.05 * first.thickness) continue;
    // Only a tight roll: the layers sit a few boards apart at most.
    const gap = distance3(first.inner[0], second.inner[second.inner.length - 1]);
    if (gap > 4 * first.thickness) continue;
    const outline = [...first.inner, ...second.inner];
    const centre = scale(outline.reduce(add, [0, 0, 0] as Vec3), 1 / outline.length);
    const vertices: number[] = [];
    const normal = first.axis;
    for (let i = 0; i < outline.length; i++) {
      for (const point of [centre, outline[i], outline[(i + 1) % outline.length]]) vertices.push(...point, ...normal, 0, 0);
    }
    const cap: Mesh = { vertices: new Float32Array(vertices), useTexture: false, color: input.color.map(value => value * 0.86) as Vec3, bend: 'edge', doubleSided: true };
    meshes.push(cap);
  }
  return meshes;
}

/**
 * Where a flap is narrower than the edge it folds from (a lid's tuck or side
 * flaps), the panel's board runs flat to its cut line beyond the crease, as
 * on the real sheet, instead of stopping where the bend begins and leaving a
 * notch at the corner. Corners cut back by two such edges are filled too.
 */
function uncreasedEdges(
  bends: CreaseBend[],
  trimmedOutline: (panel: SheetPanel) => Vec2[], half: number, t: number, input: FoldSheetInput,
): Mesh[] {
  const meshes: Mesh[] = [];
  const corners: { panel: SheetPanel; matrix: Mat4; cut: Vec2; inner: Vec2 }[] = [];
  const point = (bend: { q0: Vec3; along: Vec3; across: Vec3 }, w: number, s: number): Vec2 => {
    const p = add(add(bend.q0, scale(bend.along, w)), scale(bend.across, s));
    return { x: p[0], y: -p[1] };
  };
  for (const bend of bends) {
    // A flap set well back from the edge takes the strip beyond its score
    // down with it, so there is no flat board to continue there.
    // A crease with no setback runs its parent's half on to the corners instead.
    if (!bend.parentTrimmed || bend.parent.hidden || bend.shift > half + 1e-6 || bend.shift <= 1e-9) continue;
    const span = spanAlong(trimmedOutline(bend.parent), bend.q0, bend.along);
    const [from, to] = creaseLimit(bend, trimmedOutline, half);
    const depth = bend.shift + half;
    const pieces: [number, number][] = to - from > 1e-6 ? [[span[0], Math.min(from, span[1])], [Math.max(to, span[0]), span[1]]] : [span];
    for (const [lo, hi] of pieces) {
      if (hi - lo < 1e-3) continue;
      // Corners: trimmed (inner) corner of the panel, and the cut line point beside it.
      const outline = [point(bend, lo, 0), point(bend, hi, 0), point(bend, hi, -depth), point(bend, lo, -depth)];
      meshes.push(...flatPiece(bend.parent, bend.matrix, outline, [0], t, input));
      if (Math.abs(lo - span[0]) < 1e-6) corners.push({ panel: bend.parent, matrix: bend.matrix, cut: outline[0], inner: outline[3] });
      if (Math.abs(hi - span[1]) < 1e-6) corners.push({ panel: bend.parent, matrix: bend.matrix, cut: outline[1], inner: outline[2] });
    }
  }
  for (let i = 0; i < corners.length; i++) for (let j = i + 1; j < corners.length; j++) {
    const c1 = corners[i], c2 = corners[j];
    if (c1.panel !== c2.panel || distance2(c1.inner, c2.inner) > 1e-3 || distance2(c1.cut, c2.cut) < 1e-3) continue;
    const corner = { x: c1.cut.x + c2.cut.x - c1.inner.x, y: c1.cut.y + c2.cut.y - c1.inner.y };
    meshes.push(...flatPiece(c1.panel, c1.matrix, [c1.cut, corner, c2.cut, c1.inner], [0, 1], t, input));
  }
  return meshes;
}

/** A flat piece of a panel's board (outside, inside, and the cut faces along the given edges). */
function flatPiece(panel: SheetPanel, matrix: Mat4, outline: Vec2[], cutEdges: number[], t: number, input: FoldSheetInput): Mesh[] {
  const place = (p: Vec3) => apply(input.placement, apply(matrix, p));
  const outer = outline.map(p => place([p.x, -p.y, 0]));
  const inner = outline.map(p => place([p.x, -p.y, -t]));
  const normal = normalize(sub(place([0, 0, 1]), place([0, 0, 0])));
  const order = dot(faceNormal(outer) as Vec3, normal) < 0 ? [3, 2, 1, 0] : [0, 1, 2, 3];
  const uv = outline.map(p => panelUv(panel, p));
  const box = artworkBox(panel);
  const size: [number, number] = [box.width, box.height];
  const back = scale(normal, -1);
  const meshes = [
    smoothQuad(order.map(i => outer[i]), [normal, normal, normal, normal], order.map(i => uv[i]), input.color, panel.name, false, size),
    smoothQuad([...order].reverse().map(i => inner[i]), [back, back, back, back], [...order].reverse().map(i => insideUv(uv[i])), input.interiorColor, `Interior ${panel.name}`, true, size),
  ];
  const printed = t < CORRUGATED_THICKNESS;
  for (const edge of cutEdges) {
    const i = edge, j = (edge + 1) % outline.length;
    const strip = [outer[i], outer[j], inner[j], inner[i]];
    const edgeNormal = faceNormal(strip) as Vec3;
    const uvs = printed ? [uv[i], uv[j], uv[j], uv[i]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    const face = smoothQuad(strip, [edgeNormal, edgeNormal, edgeNormal, edgeNormal], uvs, input.color.map(value => value * 0.86) as Vec3, null, false);
    face.doubleSided = true;
    if (printed) printedEdge(face, panel.name, size);
    meshes.push(face);
  }
  return meshes;
}

/**
 * A curved surface of board through a grid of points in the scene (rows of
 * equal length), printed with `panel`'s artwork: `flat` gives each point's
 * place on the flat sheet, which fixes its texture and which side is the
 * printed one. Used where board bends in two directions at once, such as a
 * pillow box's end flaps, which no set of rigid panels can follow.
 */
export function surfaceMeshes(args: { rows: Vec3[][]; flat: Vec2[][]; panel: SheetPanel; thickness: number; color: Vec3; interiorColor: Vec3 }): Mesh[] {
  const { rows, flat, panel } = args;
  const count = rows[0]?.length ?? 0;
  if (rows.length < 2 || count < 2) return [];
  const normals = rows.map(row => row.map((): Vec3 => [0, 0, 0]));
  const triangles: [number, number][][] = [];
  for (let r = 0; r < rows.length - 1; r++) for (let c = 0; c < count - 1; c++) {
    for (const cell of [[[r, c], [r, c + 1], [r + 1, c + 1]], [[r, c], [r + 1, c + 1], [r + 1, c]]] as [number, number][][]) {
      // Printed side out: counter-clockwise on the sheet seen from the print (x right, y up).
      const [a, b, d] = cell.map(([i, j]) => flat[i][j]);
      const area = (b.x - a.x) * (-(d.y) + a.y) - (-(b.y) + a.y) * (d.x - a.x);
      if (Math.abs(area) < 1e-9) continue;
      const ordered = area > 0 ? cell : [cell[0], cell[2], cell[1]];
      const [p, q, w] = ordered.map(([i, j]) => rows[i][j]);
      const normal = cross(sub(q, p), sub(w, p));
      if (Math.hypot(...normal) < 1e-12) continue;
      for (const [i, j] of ordered) normals[i][j] = add(normals[i][j], normal);
      triangles.push(ordered);
    }
  }
  const t = Math.max(0.05, args.thickness);
  const box = artworkBox(panel);
  const size: [number, number] = [box.width, box.height];
  const outside: number[] = [], inside: number[] = [];
  for (const triangle of triangles) {
    for (const [i, j] of triangle) {
      const n = normalize(normals[i][j]);
      outside.push(...rows[i][j], ...n, ...panelUv(panel, flat[i][j]));
    }
    for (const [i, j] of [...triangle].reverse()) {
      const n = normalize(normals[i][j]);
      inside.push(...sub(rows[i][j], scale(n, t)), ...scale(n, -1), ...insideUv(panelUv(panel, flat[i][j])));
    }
  }
  const last = rows.length - 1;
  const corners = [rows[0][0], rows[0][count - 1], rows[last][count - 1], rows[last][0]];
  const face = (vertices: number[], color: Vec3, name: string, pick: Vec3[]): Mesh => ({
    vertices: new Float32Array(vertices), useTexture: true, color, panel: name,
    pickCorners: pick, uvSize: size, faceAspect: size[0] / size[1],
  });
  return [
    face(outside, args.color, panel.name, corners),
    face(inside, args.interiorColor, `Interior ${panel.name}`, corners.map(point => sub(point, [0, 0, 0])).reverse()),
  ];
}

/** A cut board edge that shows `panel`'s print through its own texture coordinates. */
export function printedEdge(mesh: Mesh, panel: string, uvSize: [number, number]) {
  mesh.useTexture = true;
  mesh.sourcePanel = panel;
  mesh.uvSize = uvSize;
  mesh.faceAspect = uvSize[0] / uvSize[1];
}

function smoothQuad(corners: Vec3[], normals: Vec3[], uvs: number[][], color: Vec3, panel: string | null, inside: boolean, uvSize?: [number, number]): Mesh {
  const order = [0, 1, 2, 0, 2, 3];
  const vertices: number[] = [];
  for (const i of order) vertices.push(...corners[i], ...normals[i], uvs[i][0], uvs[i][1]);
  const mesh: Mesh = { vertices: new Float32Array(vertices), useTexture: !!panel, color };
  if (uvSize) mesh.uvSize = uvSize;
  if (panel) {
    // Borrow the panel's artwork without becoming a pickable panel itself.
    mesh.sourcePanel = panel;
    if (uvSize) mesh.faceAspect = uvSize[0] / uvSize[1];
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
  const box = artworkBox(panel);
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

/**
 * Where a panel stops short of a crease's bend. `corner` marks a crease the
 * panel folds itself with no setback, whose bend may run on into the corner.
 */
type Trim = { edge: number; depth: number; corner: boolean };

function addTrim(trims: Map<string, Trim[]>, id: string, edge: number, depth: number, corner: boolean) {
  trims.set(id, [...(trims.get(id) ?? []), { edge, depth, corner }]);
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

/** The box the panel's artwork spans: its own outline's, or the whole panel's for a piece of one. */
function artworkBox(panel: SheetPanel) {
  return boundsOf(panel.artworkFrame ?? panel.outline);
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
