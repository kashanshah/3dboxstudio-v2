/** Proportional steps stay useful at any magnification, without product zoom limits. */
export function scaleStudioZoom(zoom: number, factor: number) {
  const next = zoom * factor;
  // Keep transforms valid only at JavaScript's numeric underflow/overflow boundary.
  return next > 0 && Number.isFinite(next) ? next : zoom;
}

export function wheelStudioZoom(zoom: number, deltaY: number, deltaMode = 0, pinch = false) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  return scaleStudioZoom(zoom, Math.exp(-pixels * (pinch ? 0.01 : 0.002)));
}
