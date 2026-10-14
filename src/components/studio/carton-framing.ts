import type { Mesh } from '@/lib/packaging/template-mesh';
import { buildMeshes, studioFitScale, type Scene } from './carton-scene';

// Camera zoom that frames the whole box in a rendered video or image, however
// the Studio's own view happens to be zoomed or panned.

/** The closest the camera comes: the finished box filling the frame. */
export const CLOSE_ZOOM = 100;
/** The zoom at which a fit scale of 1 just frames the box (the Studio's default). */
export const DEFAULT_ZOOM = 82;

/** The zoom that fits something of screen `reach` into a frame of `aspect`. */
export function zoomForReach(scene: Scene, reach: number, aspect: number) {
  const maxDimension = Math.max(scene.dimensions.width, scene.dimensions.height, scene.dimensions.depth);
  if (!(maxDimension > 0) || !(reach > 0)) return CLOSE_ZOOM;
  return Math.min(CLOSE_ZOOM, DEFAULT_ZOOM * studioFitScale(maxDimension, reach, aspect));
}

/** The box's meshes at this formation and opening. */
export function framingMeshes(scene: Scene, formation: number, opening: number) {
  return buildMeshes(scene.dimensions, opening, [1, 1, 1], [1, 1, 1], { templateId: scene.templateId, formation, openingMode: scene.openingMode, splitTopHingeSide: scene.splitTopHingeSide });
}

/** The zoom that frames the box as the scene shows it, seen from `pitch` above. */
export function fitZoom(scene: Scene, pitch: number, aspect: number) {
  try {
    return zoomForReach(scene, screenReach(framingMeshes(scene, scene.formation, scene.opening), pitch, aspect), aspect);
  } catch {
    return CLOSE_ZOOM;
  }
}

/**
 * The radius a sphere would need to fill the frame like these meshes do,
 * seen from `pitch` above at any turn: a flat sheet is wide but low, so it
 * can be framed much closer than its farthest corner suggests.
 */
export function screenReach(meshes: Mesh[], pitch: number, aspect: number) {
  let across = 0, up = 0;
  const sin = Math.abs(Math.sin(pitch)), cos = Math.abs(Math.cos(pitch));
  for (const mesh of meshes) {
    const v = mesh.vertices, m = mesh.model;
    for (let i = 0; i < v.length; i += 8) {
      const [x, y, z] = m
        ? [m[0]*v[i]+m[4]*v[i+1]+m[8]*v[i+2]+m[12], m[1]*v[i]+m[5]*v[i+1]+m[9]*v[i+2]+m[13], m[2]*v[i]+m[6]*v[i+1]+m[10]*v[i+2]+m[14]]
        : [v[i], v[i+1], v[i+2]];
      const flat = Math.hypot(x, z);
      across = Math.max(across, flat);
      up = Math.max(up, Math.abs(y) * cos + flat * sin);
    }
  }
  return Math.max(up, across / Math.max(1, aspect));
}
