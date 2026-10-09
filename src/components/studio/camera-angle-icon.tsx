import { cameraForPreset } from './carton-scene';

// A small box drawn from the preset's own camera, so each tile shows the view
// it gives. The front face is shaded so you can tell which side faces you.

const BOX = { x: 0.5, y: 0.62, z: 0.32 };
const FACES: { normal: [number, number, number]; corners: [number, number, number][]; front?: boolean }[] = [
  { normal: [0, 0, 1], front: true, corners: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
  { normal: [0, 0, -1], corners: [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]] },
  { normal: [1, 0, 0], corners: [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]] },
  { normal: [-1, 0, 0], corners: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]] },
  { normal: [0, 1, 0], corners: [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]] },
  { normal: [0, -1, 0], corners: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]] },
];

export function CameraAngleIcon({ preset }: { preset: string }) {
  const { yaw, pitch } = cameraForPreset(preset);
  const view = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const project = ([x, y, z]: [number, number, number]) => {
    const p = [x * BOX.x, y * BOX.y, z * BOX.z];
    return [24 + dot(p, right) * 26, 22 - dot(p, up) * 26];
  };
  const visible = FACES.filter(face => dot(face.normal, view) > 1e-3);
  return <svg className="pro-camera-angle-icon" viewBox="0 0 48 44" width="48" height="44" aria-hidden="true">
    {visible.map((face, index) => <polygon
      key={index}
      points={face.corners.map(corner => project(corner).map(value => value.toFixed(1)).join(',')).join(' ')}
      fill="currentColor"
      fillOpacity={face.front ? 0.28 : 0.08}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />)}
  </svg>;
}
