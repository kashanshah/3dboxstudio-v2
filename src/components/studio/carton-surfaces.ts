import { faceNormal, quadFromCorners, type Mesh } from '@/lib/packaging/template-mesh';

// How each face meets its neighbours, worked out from the template meshes so
// every template gets soft inside corners, rounded folds and cut board edges
// without describing them itself.

type Vec3 = number[];

/** Per-edge shading for one quad, in edge order a→b, b→c, c→d, d→a. */
export type EdgeShading = {
  /** Strength of the soft shadow along an inside (concave) fold, 0–1. */
  occlusion: [number, number, number, number];
  /** 1 where the edge is an outside (convex) fold that should look rounded. */
  rounded: [number, number, number, number];
  /** The neighbouring face's normal across each rounded edge. */
  neighbourNormals: [Vec3, Vec3, Vec3, Vec3];
};

type Quad = { mesh: Mesh; corners: Vec3[]; normal: Vec3; centre: Vec3 };

const QUAD_FLOATS = 6 * 8;

/** World-space corners a, b, c, d of a two-triangle quad mesh, or null for other shapes. */
export function quadCorners(mesh: Mesh): Vec3[] | null {
  if (mesh.vertices.length !== QUAD_FLOATS) return null;
  const m = mesh.model;
  return [0, 1, 2, 5].map(index => {
    const x = mesh.vertices[index * 8], y = mesh.vertices[index * 8 + 1], z = mesh.vertices[index * 8 + 2];
    return m ? [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]] : [x, y, z];
  });
}

const isInside = (mesh: Mesh) => !!mesh.panel?.startsWith('Interior ');
const isBoardEdge = (mesh: Mesh) => !!mesh.doubleSided && !mesh.panel;

function faces(meshes: Mesh[]) {
  const result: (Quad | null)[] = [];
  for (const mesh of meshes) {
    const corners = isBoardEdge(mesh) || mesh.bend ? null : quadCorners(mesh);
    result.push(corners ? { mesh, corners, normal: faceNormal(corners), centre: average(corners) } : null);
  }
  return result;
}

/** Edge shading for every mesh (null for board edges and non-quad meshes). */
export function analyseSurfaces(meshes: Mesh[], thickness: number): (EdgeShading | null)[] {
  const quads = faces(meshes);
  const size = sceneSize(quads);
  // Inside faces sit one board in from the outside ones, so their shared
  // corners are up to ~1.5 boards apart.
  const tolerance = Math.max(thickness * 2.5, size * 1e-4);
  return quads.map(quad => {
    if (!quad) return null;
    const shading: EdgeShading = { occlusion: [0, 0, 0, 0], rounded: [0, 0, 0, 0], neighbourNormals: [[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]] };
    for (let edge = 0; edge < 4; edge++) {
      if (quad.mesh.creases?.includes(edge)) continue;
      const a = quad.corners[edge], b = quad.corners[(edge + 1) % 4];
      const neighbour = closestNeighbour(quad, a, b, quads, tolerance);
      if (!neighbour) continue;
      const along = normalize(sub(b, a));
      const middle = scale(add(a, b), 0.5);
      const away = (point: Vec3) => {
        const offset = sub(point, middle);
        return normalize(sub(offset, scale(along, dot(offset, along))));
      };
      const cosine = dot(away(quad.centre), away(neighbour.centre));
      if (cosine < -0.985) continue; // flat continuation
      if (dot(sub(neighbour.centre, middle), quad.normal) > 0) {
        // Neighbour in front of this face: an inside corner.
        shading.occlusion[edge] = clamp(0.62 * (1 + cosine), 0, 0.9);
      } else {
        shading.rounded[edge] = 1;
        shading.neighbourNormals[edge] = neighbour.normal;
      }
    }
    return shading;
  });
}

function closestNeighbour(quad: Quad, a: Vec3, b: Vec3, quads: (Quad | null)[], tolerance: number) {
  const length = Math.hypot(...sub(b, a));
  if (length < 1e-6) return null;
  const along = scale(sub(b, a), 1 / length);
  let best: Quad | null = null, bestDistance = Infinity;
  for (const other of quads) {
    if (!other || other === quad) continue;
    // A face's own inside/outside twin is parallel, never a neighbour.
    if (Math.abs(dot(other.normal, quad.normal)) > 0.985) continue;
    for (let edge = 0; edge < 4; edge++) {
      const p = other.corners[edge], q = other.corners[(edge + 1) % 4];
      const gap = Math.max(lineDistance(p, a, along), lineDistance(q, a, along));
      if (gap > tolerance) continue;
      // Prefer outside↔outside and inside↔inside neighbours over the other
      // side of the same fold, which sits about a board away.
      const distance = gap + (isInside(other.mesh) === isInside(quad.mesh) ? 0 : tolerance);
      if (distance >= bestDistance) continue;
      const t0 = dot(sub(p, a), along), t1 = dot(sub(q, a), along);
      const overlap = Math.min(length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1));
      if (overlap < length * 0.4) continue;
      best = other;
      bestDistance = distance;
    }
  }
  return best;
}

type Board = { id: string; outside: Quad; inside: Quad; inner: Vec3[] };

/** Marks a quad edge that continues into a bent crease. */
const BENT = {} as Board;

/**
 * Turn each panel's printed and inside faces into a solid piece of board:
 * at every crease the inside faces of the two panels are trimmed (or, on an
 * outward fold, extended) to meet exactly, the way the inside of bent card
 * closes up, and a cut board edge is drawn along every edge that is not a
 * crease. Template-drawn edge strips are replaced so every template behaves
 * the same; strips that end flush against another face are left out.
 */
export function solidify(meshes: Mesh[], thickness: number): Mesh[] {
  const quads = faces(meshes);
  const boards = pairBoards(quads);
  const size = sceneSize(quads);
  const tolerance = Math.max(size * 1e-5, 1e-4);
  const reach = thickness * 3;
  const creases = new Map<Board, (Board | null)[]>();
  for (const board of boards) {
    creases.set(board, [0, 1, 2, 3].map(edge => {
      // Edges that run into a bent crease are already joined by the bend.
      if (board.outside.mesh.creases?.includes(edge)) return BENT;
      const a = board.outside.corners[edge], b = board.outside.corners[(edge + 1) % 4];
      return boards.find(other => other !== board && sharesEdge(other.outside, a, b, tolerance)) ?? null;
    }));
  }
  const replaced = new Map<Mesh, Mesh>();
  for (const board of boards) {
    const inner = board.inner.map(point => [...point]);
    creases.get(board)!.forEach((neighbour, edge) => {
      if (!neighbour || neighbour === BENT) return;
      const normal = neighbour.inside.normal;
      if (Math.abs(dot(normal, board.inside.normal)) > 0.999) return;
      // Slide each end of this edge along its side of the quad until it
      // reaches the neighbour's inside surface.
      for (const [corner, along] of [[edge, (edge + 3) % 4], [(edge + 1) % 4, (edge + 2) % 4]]) {
        // Corners on two creases take both moves, one after the other.
        const from = inner[corner], direction = sub(inner[corner], inner[along]);
        const denominator = dot(direction, normal);
        if (Math.abs(denominator) < 1e-9) continue;
        const s = dot(sub(neighbour.inside.corners[0], from), normal) / denominator;
        const move = scale(direction, s);
        if (Math.hypot(...move) > reach) continue;
        inner[corner] = add(from, move);
      }
    });
    board.inner = inner;
  }
  // Butt joints: where a panel's cut edge runs into another panel that
  // covers it, it stops at that panel's inside surface instead of passing
  // through it.
  for (const board of boards) {
    const outer = board.outside.corners.map(point => [...point]);
    creases.get(board)!.forEach((neighbour, edge) => {
      if (neighbour) return;
      for (const cover of boards) {
        if (cover === board || layerOf(cover) <= layerOf(board) || creases.get(board)!.includes(cover)) continue;
        for (const [corner, along] of [[edge, (edge + 3) % 4], [(edge + 1) % 4, (edge + 2) % 4]]) {
          for (const surface of [outer, board.inner]) {
            if (!withinBoard(surface[corner], cover, thickness)) continue;
            const normal = cover.outside.normal;
            const direction = sub(surface[corner], surface[along]);
            const denominator = dot(direction, normal);
            if (Math.abs(denominator) < 1e-9) continue;
            const s = dot(sub(sub(cover.outside.corners[0], scale(normal, thickness)), surface[corner]), normal) / denominator;
            const move = scale(direction, s);
            if (s > 0 || Math.hypot(...move) > thickness * 2.5) continue;
            surface[corner] = add(surface[corner], move);
          }
        }
      }
    });
    if (outer.some((point, index) => Math.hypot(...sub(point, board.outside.corners[index])) > 1e-9)) {
      board.outside = { ...board.outside, corners: outer };
      replaced.set(board.outside.mesh, withCorners(board.outside.mesh, outer));
    }
    replaced.set(board.inside.mesh, withCorners(board.inside.mesh, [board.inner[3], board.inner[2], board.inner[1], board.inner[0]]));
  }
  const allFaces = boards.flatMap(board => [board.outside, { ...board.inside, corners: [board.inner[3], board.inner[2], board.inner[1], board.inner[0]] }]);
  const edges: Mesh[] = [];
  for (const board of boards) {
    creases.get(board)!.forEach((neighbour, edge) => {
      if (neighbour) return;
      const next = (edge + 1) % 4;
      const strip = [board.outside.corners[edge], board.outside.corners[next], board.inner[next], board.inner[edge]];
      if (Math.hypot(...sub(strip[0], strip[3])) < 1e-6 && Math.hypot(...sub(strip[1], strip[2])) < 1e-6) return;
      const middle = average(strip);
      if (allFaces.some(face => face !== board.outside && liesOn(middle, face, thickness * 0.6))) return;
      const mesh = quadFromCorners(strip, board.outside.mesh.color.map(value => value * 0.86) as [number, number, number]);
      mesh.doubleSided = true;
      edges.push(mesh);
    });
  }
  return [...meshes.filter(mesh => !isBoardEdge(mesh) || mesh.bend).map(mesh => replaced.get(mesh) ?? mesh), ...edges];
}

function layerOf(board: Board) {
  const mesh = board.outside.mesh;
  if (mesh.layer !== undefined) return mesh.layer;
  if (mesh.board || mesh.closureFlap) return 0;
  const name = mesh.panel ?? '';
  if (/^(Glue|Lid |.* Tab$)/.test(name)) return 0;
  if (/^(Top|Bottom)\b/.test(name)) return 2;
  return 1;
}

/** True when a point sits inside the thickness of another board's panel. */
function withinBoard(point: Vec3, board: Board, thickness: number) {
  const face = board.outside;
  const depth = dot(sub(point, face.corners[0]), face.normal);
  if (depth > thickness * 0.02 || depth < -thickness * 1.02) return false;
  const margin = thickness * 0.5;
  return face.corners.every((corner, index) => {
    const edge = sub(face.corners[(index + 1) % 4], corner);
    const inward = normalizeVec(cross(face.normal, edge));
    return dot(sub(point, corner), inward) > -margin;
  });
}

function normalizeVec(v: Vec3) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function pairBoards(quads: (Quad | null)[]): Board[] {
  const outside = new Map<string, Quad>(), inside = new Map<string, Quad>();
  for (const quad of quads) {
    if (!quad) continue;
    const { panel, board } = quad.mesh;
    if (board) (board.side === 'outside' ? outside : inside).set(board.id, quad);
    else if (panel?.startsWith('Interior ')) inside.set(panel.slice('Interior '.length), quad);
    else if (panel) outside.set(panel, quad);
  }
  const boards: Board[] = [];
  for (const [id, face] of outside) {
    const twin = inside.get(id);
    // Inside quads list the outside corners in reverse order.
    if (twin) boards.push({ id, outside: face, inside: twin, inner: [twin.corners[3], twin.corners[2], twin.corners[1], twin.corners[0]] });
  }
  return boards;
}

function withCorners(mesh: Mesh, corners: Vec3[]): Mesh {
  const vertices = new Float32Array(mesh.vertices);
  // Quad vertex order is a, b, c, a, c, d.
  [0, 1, 2, 0, 2, 3].forEach((corner, vertex) => vertices.set(corners[corner], vertex * 8));
  return { ...mesh, vertices };
}

function sharesEdge(other: Quad, a: Vec3, b: Vec3, tolerance: number) {
  const length = Math.hypot(...sub(b, a));
  const along = scale(sub(b, a), 1 / Math.max(length, 1e-9));
  return other.corners.some((p, index) => {
    const q = other.corners[(index + 1) % 4];
    if (lineDistance(p, a, along) > tolerance || lineDistance(q, a, along) > tolerance) return false;
    const t0 = dot(sub(p, a), along), t1 = dot(sub(q, a), along);
    return Math.min(length, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > length * 0.5;
  });
}

function liesOn(point: Vec3, face: Quad, tolerance: number) {
  if (Math.abs(dot(sub(point, face.corners[0]), face.normal)) > tolerance) return false;
  const sides = face.corners.map((corner, index) => dot(cross(sub(face.corners[(index + 1) % 4], corner), sub(point, corner)), face.normal));
  return sides.every(side => side > 0) || sides.every(side => side < 0);
}

function sceneSize(quads: (Quad | null)[]) {
  let size = 1;
  for (const quad of quads) for (const corner of quad?.corners ?? []) size = Math.max(size, Math.abs(corner[0]), Math.abs(corner[1]), Math.abs(corner[2]));
  return size * 2;
}

function lineDistance(point: Vec3, origin: Vec3, direction: Vec3) {
  const offset = sub(point, origin);
  return Math.hypot(...sub(offset, scale(direction, dot(offset, direction))));
}

const add = (a: Vec3, b: Vec3) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const average = (points: Vec3[]) => scale(points.reduce(add, [0, 0, 0]), 1 / points.length);
function normalize(v: Vec3) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
