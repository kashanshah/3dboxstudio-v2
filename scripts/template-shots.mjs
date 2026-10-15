// How each template is shown in its card picture and hover clip: the
// opening mode, how far it is assembled (100 closed) and the camera.
// Used by render-template-thumbnails.mjs and render-template-clips.mjs.
export const SHOTS = [
  { id: 'reverse-tuck-carton', mode: 'closed', progress: 86, yaw: 2.3, pitch: 0.7 },
  { id: 'base-box', mode: 'lid_from_back', progress: 80, yaw: -0.6, pitch: 0.35, zoom: 70 },
  { id: 'split-top-box', mode: 'top_split_meet_center', progress: 85, yaw: -0.6, pitch: 0.35, zoom: 75 },
  { id: 'pizza-box', mode: 'lid_from_back', progress: 85, yaw: -0.6, pitch: 0.35 },
  { id: 'sleeve-box', mode: 'closed', progress: 100, yaw: -0.6, pitch: 0.45 },
  { id: 'mailer-box', mode: 'lid_from_back', progress: 80, yaw: -0.6, pitch: 0.4 },
  { id: 'rigid-lid-base', mode: 'lid_from_back', progress: 85, yaw: -0.6, pitch: 0.45 },
  { id: 'auto-lock-bottom-box', mode: 'closed', progress: 86, yaw: 2.3, pitch: 0.7 },
  { id: 'snap-lock-bottom-box', mode: 'closed', progress: 86, yaw: -0.8, pitch: 0.7 },
  { id: 'pillow-box', mode: 'closed', progress: 100, yaw: 0.75, pitch: 0.3 },
  { id: 'gable-box', mode: 'closed', progress: 100, yaw: -0.6, pitch: 0.35 },
];
