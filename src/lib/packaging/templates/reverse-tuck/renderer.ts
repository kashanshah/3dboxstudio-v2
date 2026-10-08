import { reverseTuckFoldState, reverseTuckPanels, sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { faceNormal, quadFromCorners, type Mesh, type TemplateMeshBuilder } from '@/lib/packaging/template-mesh';

export const buildReverseTuckTemplateMeshes:TemplateMeshBuilder=({dimensions,formation,color,interiorColor})=>
  buildReverseTuckMeshes(dimensions,formation,color,interiorColor);

function buildReverseTuckMeshes(
  dimensions: CartonDimensions,
  opening: number,
  color: [number, number, number],
  interiorColor: [number, number, number],
): Mesh[] {
  dimensions=sanitizeCartonDimensions(dimensions);
  const { width: w, height: h, depth: d } = dimensions;
  const footprint=reverseTuckPanels(dimensions);
  const t = clamp(dimensions.thickness, 0.3, Math.min(w, d) * 0.08);
  const fold = reverseTuckFoldState(opening);
  const wallAngle = fold.walls * Math.PI / 2;
  const backAngle = fold.back * Math.PI / 2;
  const topAngle = fold.top * Math.PI / 2;
  const bottomAngle = fold.bottom * Math.PI / 2;

  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  const zFront = d / 2;

  // Exterior faces intentionally share the exact same base color. The default
  // studio view is a color-proofing view, not a photographic render: rotating
  // the carton must not make one printed face appear darker or lighter simply
  // because its normal points away from a virtual key light.
  const interior: [number, number, number] = interiorColor;

  const frontCorners = [
    [x0, y0, zFront],
    [x1, y0, zFront],
    [x1, y1, zFront],
    [x0, y1, zFront],
  ];

  const leftOuterX = x0 - d * Math.cos(wallAngle);
  const leftOuterZ = zFront - d * Math.sin(wallAngle);
  const leftCorners = [
    [leftOuterX, y0, leftOuterZ],
    [x0, y0, zFront],
    [x0, y1, zFront],
    [leftOuterX, y1, leftOuterZ],
  ];

  const rightOuterX = x1 + d * Math.cos(wallAngle);
  const rightOuterZ = zFront - d * Math.sin(wallAngle);
  const rightCorners = [
    [x1, y0, zFront],
    [rightOuterX, y0, rightOuterZ],
    [rightOuterX, y1, rightOuterZ],
    [x1, y1, zFront],
  ];

  const backDirectionAngle = wallAngle + backAngle;
  const backDx = Math.cos(backDirectionAngle);
  const backDz = -Math.sin(backDirectionAngle);
  const backFarX = rightOuterX + w * backDx;
  const backFarZ = rightOuterZ + w * backDz;
  const backCorners = [
    [rightOuterX, y0, rightOuterZ],
    [backFarX, y0, backFarZ],
    [backFarX, y1, backFarZ],
    [rightOuterX, y1, rightOuterZ],
  ];

  const topOuterY = y1 + d * Math.cos(topAngle);
  const topOuterZ = zFront - d * Math.sin(topAngle);
  const topCorners = [
    [x0, y1, zFront],
    [x1, y1, zFront],
    [x1, topOuterY, topOuterZ],
    [x0, topOuterY, topOuterZ],
  ];

  const bottomOuterY = y0 - d * Math.cos(bottomAngle);
  const bottomOuterZ = zFront - d * Math.sin(bottomAngle);
  const bottomCorners = [
    [x0, bottomOuterY, bottomOuterZ],
    [x1, bottomOuterY, bottomOuterZ],
    [x1, y0, zFront],
    [x0, y0, zFront],
  ];

  const glueWidth=footprint.find(item=>item.id==='glue')!.width;
  // The glue strip is physically attached to the free edge of the Left panel.
  // It must first follow the Left wall around the Front/Left crease, then make
  // its own second hinge rotation around the Left/Glue crease toward the Back.
  // Computing those as two rigid rotations keeps the fold direction correct
  // at every intermediate percentage instead of deriving one combined angle.
  const rotateYPoint=(p:number[],pivot:number[],theta:number)=>{
    const x=p[0]-pivot[0],z=p[2]-pivot[2],c=Math.cos(theta),si=Math.sin(theta);
    return [pivot[0]+x*c+z*si,p[1],pivot[2]-x*si+z*c];
  };
  const frontLeftHinge=[x0,0,zFront];
  const glueHingeFlat=[x0-d,0,zFront];
  const glueFarFlat=[x0-d-glueWidth,0,zFront];
  const glueHingeAfterWall=rotateYPoint(glueHingeFlat,frontLeftHinge,-wallAngle);
  const glueFarAfterWall=rotateYPoint(glueFarFlat,frontLeftHinge,-wallAngle);
  const glueFarAfterGlueFold=rotateYPoint(glueFarAfterWall,glueHingeAfterWall,-backAngle);
  const glueCorners=[
    [glueFarAfterGlueFold[0],y0,glueFarAfterGlueFold[2]],
    [glueHingeAfterWall[0],y0,glueHingeAfterWall[2]],
    [glueHingeAfterWall[0],y1,glueHingeAfterWall[2]],
    [glueFarAfterGlueFold[0],y1,glueFarAfterGlueFold[2]],
  ];

  const panels: Array<{
    name: string;
    corners: number[][];
    surfaceColor: [number, number, number];
    aspect: number;
    /** Edge indices (corner i → i+1) that are folds onto another panel, not cut edges. */
    creases: number[];
  }> = [
    // Once the back wall reaches its final fold, it covers the glue flap.
    // Keeping both surfaces coplanar makes the depth buffer alternate between
    // the unprinted flap and the printed back artwork (a visible grey strip).
    ...(fold.back < 0.999 ? [{ name: 'Glue', corners: glueCorners, surfaceColor: color, aspect: glueWidth/h, creases: [1] }] : []),
    { name: 'Front', corners: frontCorners, surfaceColor: color, aspect: w / h, creases: [0, 1, 2, 3] },
    { name: 'Left', corners: leftCorners, surfaceColor: color, aspect: d / h, creases: [1, 3] },
    { name: 'Right', corners: rightCorners, surfaceColor: color, aspect: d / h, creases: [1, 3] },
    { name: 'Back', corners: backCorners, surfaceColor: color, aspect: w / h, creases: [3] },
    { name: 'Top', corners: topCorners, surfaceColor: color, aspect: w / d, creases: [0] },
    { name: 'Bottom', corners: bottomCorners, surfaceColor: color, aspect: w / d, creases: [2] },
  ];

  const exteriorMeshes: Mesh[] = [];
  const interiorMeshes: Mesh[] = [];
  const edgeMeshes: Mesh[] = [];
  // At a fully closed fold the exterior panels meet each other and cover the
  // board thickness. Drawing a thickness wall around every panel in that state
  // stacks tiny perpendicular strips at each carton corner, which shows up as
  // the dark/hatched seams seen on closed previews. Keep thickness geometry for
  // open/intermediate folds, where a cut board edge is genuinely exposed.
  const showExposedBoardEdges = opening < 99.5;
  const edgeGeometryKeys=new Set<string>();

  const edgeGeometryKey=(corners:number[][])=>corners
    .map(point=>point.map(value=>Math.round(value*1e6)/1e6).join(','))
    .sort()
    .join('|');

  for (const panel of panels) {
    const exterior = quadFromCorners(panel.corners, panel.surfaceColor, true, panel.name);
    const netPanel=footprint.find(item=>item.label.toLowerCase()===panel.name.toLowerCase())!;
    exterior.faceAspect = netPanel.width/netPanel.height;
    exteriorMeshes.push(exterior);

    const normal = faceNormal(panel.corners);
    const insideCorners = panel.corners.map(point => [
      point[0] - normal[0] * t,
      point[1] - normal[1] * t,
      point[2] - normal[2] * t,
    ]);
    const reversed = [insideCorners[3], insideCorners[2], insideCorners[1], insideCorners[0]];
    const inside = quadFromCorners(reversed, interior, true, `Interior ${panel.name}`);
    inside.faceAspect = exterior.faceAspect;
    interiorMeshes.push(inside);

    const edgeColor: [number, number, number] = [
      Math.max(0, Math.min(1, panel.surfaceColor[0] * 0.72)),
      Math.max(0, Math.min(1, panel.surfaceColor[1] * 0.72)),
      Math.max(0, Math.min(1, panel.surfaceColor[2] * 0.72)),
    ];

    if (!showExposedBoardEdges) continue;

    for (let index = 0; index < 4; index += 1) {
      // A crease is where this board bends into its neighbour, so no cut edge
      // is exposed there. Drawing one puts a board-thick strip in the same
      // plane as the neighbour's printed face, and the two flicker against
      // each other (striped seams that grow with board thickness).
      if (panel.creases.includes(index)) continue;
      const nextIndex = (index + 1) % 4;
      const edgeCorners = [
        panel.corners[index],
        panel.corners[nextIndex],
        insideCorners[nextIndex],
        insideCorners[index],
      ];

      // A board edge is one physical surface. Rendering a second reversed
      // quad in exactly the same plane causes depth-buffer contention and
      // flickering/fuzzy seams. Draw one mesh with culling disabled instead.
      const geometryKey=edgeGeometryKey(edgeCorners);
      if(!edgeGeometryKeys.has(geometryKey)){
        edgeGeometryKeys.add(geometryKey);
        const edgeMesh=quadFromCorners(edgeCorners, edgeColor, false);
        edgeMesh.doubleSided=true;
        edgeMeshes.push(edgeMesh);
      }
    }
  }

  // Free edges can also end flush against another panel's printed face (the
  // back's end against the left wall, closed flaps against the back). Those
  // strips are hidden in a real carton and flicker when drawn, so drop them.
  const visibleEdges = edgeMeshes.filter(edge => !exteriorMeshes.some(face => overlapsCoplanar(edge, face)));
  return [...exteriorMeshes, ...interiorMeshes, ...visibleEdges];
}

const corners = (mesh: Mesh) => [0, 1, 2, 5].map(index => Array.from(mesh.vertices.slice(index * 8, index * 8 + 3)));
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** True when the edge strip lies in the face's plane with its centre inside the face. */
function overlapsCoplanar(edge: Mesh, face: Mesh) {
  const quad = corners(face), strip = corners(edge);
  const normal = faceNormal(quad), stripNormal = faceNormal(strip);
  if (Math.abs(Math.abs(dot(normal, stripNormal)) - 1) > 1e-4) return false;
  const centre = [0, 1, 2].map(axis => strip.reduce((sum, point) => sum + point[axis], 0) / 4);
  if (Math.abs(dot(sub(centre, quad[0]), normal)) > 1e-3) return false;
  const sides = quad.map((point, index) => dot(cross(sub(quad[(index + 1) % 4], point), sub(centre, point)), normal));
  return sides.every(side => side > 0) || sides.every(side => side < 0);
}



function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}
