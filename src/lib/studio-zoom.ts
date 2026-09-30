export const MIN_STUDIO_ZOOM = 5;

/** Keep proportional zoom free above a practical 5% minimum. */
export function scaleStudioZoom(zoom: number, factor: number) {
  const next = zoom * factor;
  if (!Number.isFinite(next)) return zoom;
  return Math.max(MIN_STUDIO_ZOOM, next);
}

export function wheelStudioZoom(zoom: number, deltaY: number, deltaMode = 0, pinch = false) {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  return scaleStudioZoom(zoom, Math.exp(-pixels * (pinch ? 0.01 : 0.002)));
}


export type StudioPan={x:number;y:number};

/**
 * Keep a screen-space point fixed while zoom changes.
 * Point and pan are measured in CSS pixels from the viewport center.
 * Button zoom deliberately does not call this helper, so buttons remain
 * center-anchored while wheel/pinch gestures behave like Figma.
 */
export function panForAnchoredZoom(
  pan:StudioPan,
  oldZoom:number,
  newZoom:number,
  point:StudioPan,
):StudioPan{
  if(!(oldZoom>0) || !(newZoom>0) || !Number.isFinite(oldZoom) || !Number.isFinite(newZoom))return pan;
  const ratio=newZoom/oldZoom;
  return {
    x:point.x-(point.x-pan.x)*ratio,
    y:point.y-(point.y-pan.y)*ratio,
  };
}
