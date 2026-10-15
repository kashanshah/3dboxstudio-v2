// How each template is shown in its card picture and hover clip: the
// opening mode, how far it is assembled (100 closed), the camera, and the
// colour printed on the outside, picked for what the box is used for (a
// teal cosmetics carton, a bakery-red gable box) so the cards don't all show
// white board. Corrugated boxes stay plain kraft, as they usually ship.
// Used by render-template-thumbnails.mjs and render-template-clips.mjs.
export const SHOTS = [
  { id: 'reverse-tuck-carton', mode: 'closed', progress: 86, yaw: 2.3, pitch: 0.7, outside: '#1f8a8f' },
  { id: 'base-box', mode: 'lid_from_back', progress: 80, yaw: -0.6, pitch: 0.35, zoom: 70, outside: '#e5673f' },
  { id: 'split-top-box', mode: 'top_split_meet_center', progress: 85, yaw: -0.6, pitch: 0.35, zoom: 75 },
  { id: 'pizza-box', mode: 'lid_from_back', progress: 85, yaw: -0.6, pitch: 0.35 },
  { id: 'sleeve-box', mode: 'closed', progress: 100, yaw: -0.6, pitch: 0.45, outside: '#e3a42b' },
  { id: 'mailer-box', mode: 'lid_from_back', progress: 80, yaw: -0.6, pitch: 0.4, outside: '#24477a' },
  { id: 'rigid-lid-base', mode: 'lid_from_back', progress: 85, yaw: -0.6, pitch: 0.45, outside: '#1f5a43' },
  { id: 'auto-lock-bottom-box', mode: 'closed', progress: 86, yaw: 2.3, pitch: 0.7, outside: '#2f5fb8' },
  { id: 'snap-lock-bottom-box', mode: 'closed', progress: 86, yaw: -0.8, pitch: 0.7, outside: '#6a4c9c' },
  { id: 'pillow-box', mode: 'closed', progress: 100, yaw: 0.75, pitch: 0.3, outside: '#e47fa0' },
  { id: 'gable-box', mode: 'closed', progress: 100, yaw: -0.6, pitch: 0.35, outside: '#c63d4a' },
];
