// Two-finger pinch and pan on touch screens, built on pointer events.
//
// The first finger goes to the view as usual (rotate the box, drag artwork).
// When a second finger lands on the view, that one-finger gesture is cancelled
// with a pointercancel, and both fingers' events stop here until they lift:
// moving them apart or together zooms around the point between them, and
// moving them together pans.

export type PinchChange = {
  /** Ratio of the fingers' spread to the previous move's. */
  scale: number;
  /** The point between the fingers, in client coordinates. */
  x: number;
  y: number;
  /** How far that point moved since the previous move, in pixels. */
  dx: number;
  dy: number;
};

type PointerLike = Event & { pointerId: number; pointerType: string; clientX: number; clientY: number };

/** Marks the pointercancel this module sends, so it does not handle its own. */
const SYNTHETIC = Symbol('touch-pinch-cancel');

export function attachTouchPinch(
  element: EventTarget,
  options: { accepts: (target: EventTarget | null) => boolean; onPinch: (change: PinchChange) => void },
) {
  const touches = new Map<number, { x: number; y: number; target: EventTarget | null }>();
  // Fingers that took part in a pinch: theirs until they lift.
  const held = new Set<number>();
  let pinch: { distance: number; x: number; y: number } | null = null;

  const isTouch = (event: PointerLike) => event.pointerType === 'touch' && !(event as unknown as Record<symbol, boolean>)[SYNTHETIC];
  const spread = () => {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(b.x - a.x, b.y - a.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const swallow = (event: Event) => { event.stopPropagation(); if (event.cancelable) event.preventDefault(); };
  const cancelFirstFinger = (id: number, at: { x: number; y: number; target: EventTarget | null }) => {
    if (!at.target || typeof PointerEvent === 'undefined') return;
    const cancel = new PointerEvent('pointercancel', { bubbles: true, pointerId: id, pointerType: 'touch', clientX: at.x, clientY: at.y });
    (cancel as unknown as Record<symbol, boolean>)[SYNTHETIC] = true;
    at.target.dispatchEvent(cancel);
  };

  const down = (raw: Event) => {
    const event = raw as PointerLike;
    if (!isTouch(event)) return;
    if (!touches.size && !options.accepts(event.target)) return;
    if (touches.size >= 2) { held.add(event.pointerId); swallow(event); return; }
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY, target: event.target });
    if (touches.size < 2) return;
    // The second finger: this is a pinch.
    swallow(event);
    for (const [id, at] of touches) {
      held.add(id);
      if (id !== event.pointerId) cancelFirstFinger(id, at);
    }
    pinch = spread();
  };
  const move = (raw: Event) => {
    const event = raw as PointerLike;
    if (!isTouch(event)) return;
    const at = touches.get(event.pointerId);
    if (at) { at.x = event.clientX; at.y = event.clientY; }
    if (!held.has(event.pointerId)) return;
    swallow(event);
    if (!pinch || touches.size < 2) return;
    const next = spread();
    if (pinch.distance > 0 && next.distance > 0) {
      options.onPinch({ scale: next.distance / pinch.distance, x: next.x, y: next.y, dx: next.x - pinch.x, dy: next.y - pinch.y });
    }
    pinch = next;
  };
  const up = (raw: Event) => {
    const event = raw as PointerLike;
    if (!isTouch(event)) return;
    touches.delete(event.pointerId);
    if (touches.size < 2) pinch = null;
    if (held.delete(event.pointerId)) swallow(event);
  };

  const listen = { capture: true, passive: false } as const;
  element.addEventListener('pointerdown', down, listen);
  element.addEventListener('pointermove', move, listen);
  element.addEventListener('pointerup', up, listen);
  element.addEventListener('pointercancel', up, listen);
  return {
    /**
     * Whether fingers are on the view. iOS Safari also reports a touch pinch
     * as gesture events; callers that handle those for trackpads skip them
     * while this is true so a pinch does not zoom twice.
     */
    touching: () => touches.size > 0,
    detach: () => {
      element.removeEventListener('pointerdown', down, listen);
      element.removeEventListener('pointermove', move, listen);
      element.removeEventListener('pointerup', up, listen);
      element.removeEventListener('pointercancel', up, listen);
    },
  };
}
