"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { LINE_NAMES, LINE_STYLES } from "@/lib/dieline/export/svg";
import type { DielineOutput, LineType } from "@/lib/dieline/types";
import { GENERATOR_COPY, type PreviewCopy } from "./copy";

// The flat dieline on a canvas, drawn live: every line type in its colour,
// panel names and the overall sizes. Like a design tool, the box is resized
// on the canvas itself: a handle sits on the edge of the panel each size is
// measured on, and dragging it (or focusing it and pressing the arrow keys)
// changes that size, with the new value shown beside the pointer. The view
// holds still while a handle is dragged and fits the sheet again after.
// Zoom with the buttons or ctrl/⌘ + wheel (a trackpad pinch); drag the
// canvas to move round a zoomed sheet.

const ORDER: LineType[] = ["bleed", "safe", "glue", "perforation", "crease", "cut"];
const MAX_ZOOM = 12;

export type Axis = "length" | "width" | "depth";
export type ResizeHandle = { axis: Axis; label: string; panel: string; side: "width" | "height" };

type View = { zoom: number; x: number; y: number };
type Frame = { x: number; y: number; w: number; h: number };

export function DielinePreview({ output, label, showLabels, showSizes, format, handles = [], values, step, mmPerUnit, unitLabel, onResize, onResizeEnd, toolbar, copy = GENERATOR_COPY.en.preview }: {
  output: DielineOutput;
  copy?: PreviewCopy;
  label: string;
  showLabels: boolean;
  showSizes: boolean;
  /** A length in mm as the user reads it ("120 mm", "4.72 in"). */
  format: (mm: number) => string;
  handles?: ResizeHandle[];
  /** The sizes as typed, in the user's units, and how finely a drag sets them. */
  values: Record<Axis, number>;
  step: number;
  /** Millimetres per user unit (1, or 25.4 for inches), and the unit's name. */
  mmPerUnit: number;
  unitLabel: string;
  /** A new size for an axis, in the user's units. */
  onResize?: (axis: Axis, value: number) => void;
  onResizeEnd?: (axis: Axis) => void;
  toolbar?: ReactNode;
}) {
  const { width, height } = output.bounds;
  const pad = Math.max(width, height) * 0.08 + 10;
  const fit: Frame = { x: -pad, y: -pad, w: width + 2 * pad, h: height + 2 * pad };
  const fitted: View = { zoom: 1, x: 0.5, y: 0.5 };
  // A view belongs to one sheet size; a new size starts fitted, except while a
  // handle is dragged, when the frame the drag started in holds.
  const sizeKey = `${Math.round(width)}x${Math.round(height)}`;
  const [kept, setKept] = useState<{ key: string; view: View }>({ key: sizeKey, view: fitted });
  const [held, setHeld] = useState<Frame | null>(null);
  const view = kept.key === sizeKey ? kept.view : fitted;
  const setView = (next: View | ((current: View) => View)) => setKept(was => {
    const base = was.key === sizeKey ? was.view : fitted;
    return { key: sizeKey, view: typeof next === "function" ? next(base) : next };
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const pan = useRef<{ id: number; x: number; y: number; view: View } | null>(null);
  const [drag, setDrag] = useState<{ id: number; axis: Axis; start: number; from: number; dir: "x" | "y"; unitsPerPx: number; at: { x: number; y: number } } | null>(null);
  const [hover, setHover] = useState<Axis | null>(null);

  const clampCentre = (value: number, zoom: number) => Math.min(1 - 0.5 / zoom, Math.max(0.5 / zoom, value));
  const cx = clampCentre(view.x, view.zoom), cy = clampCentre(view.y, view.zoom);
  const frame: Frame = held ?? { x: fit.x + cx * fit.w - fit.w / view.zoom / 2, y: fit.y + cy * fit.h - fit.h / view.zoom / 2, w: fit.w / view.zoom, h: fit.h / view.zoom };

  // Screen pixels to sheet millimetres, so handles keep their size on screen.
  const [pixels, setPixels] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => setPixels({ w: entry.contentRect.width || 800, h: entry.contentRect.height || 600 }));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  // preserveAspectRatio meet: the frame is scaled by the tighter of the two sides.
  const unit = Math.max(frame.w / pixels.w, frame.h / pixels.h);

  const zoomBy = (factor: number, at?: { x: number; y: number }) => setView(current => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom * factor));
    if (!at) return { ...current, zoom };
    const ratio = 1 - current.zoom / zoom;
    return { zoom, x: current.x + (at.x - 0.5) * ratio / current.zoom, y: current.y + (at.y - 0.5) * ratio / current.zoom };
  });
  const onWheel = useEffectEvent((event: WheelEvent, rect: DOMRect) => {
    zoomBy(Math.exp(-event.deltaY * 0.01), { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  });
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheel = (event: WheelEvent) => {
      // Plain wheel scrolls the page; ctrl/⌘ (and trackpad pinch) zooms.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      onWheel(event, svg.getBoundingClientRect());
    };
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, []);

  // Where each handle sits: the middle of the far edge of its panel.
  const boxes = new Map(output.panels.map(panel => {
    const xs = panel.polygon.map(point => point[0]), ys = panel.polygon.map(point => point[1]);
    return [panel.id, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }];
  }));
  const placed = handles.flatMap(handle => {
    const box = boxes.get(handle.panel);
    if (!box) return [];
    const dir = handle.side === "width" ? "x" as const : "y" as const;
    return [{ ...handle, box, dir, x: dir === "x" ? box.x + box.w : box.x + box.w / 2, y: dir === "x" ? box.y + box.h / 2 : box.y + box.h }];
  });

  // The pointer relative to the canvas, for the size badge.
  const canvasPoint = (event: ReactPointerEvent<SVGGElement>) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    return { x: event.clientX - (rect?.left ?? 0), y: event.clientY - (rect?.top ?? 0) };
  };
  const startResize = (event: ReactPointerEvent<SVGGElement>, axis: Axis, dir: "x" | "y") => {
    if (event.button !== 0 || !onResize) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHeld(frame);
    setDrag({ id: event.pointerId, axis, start: dir === "x" ? event.clientX : event.clientY, from: values[axis], dir, unitsPerPx: unit, at: canvasPoint(event) });
  };
  const moveResize = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag || drag.id !== event.pointerId || !onResize) return;
    const pixelsMoved = (drag.dir === "x" ? event.clientX : event.clientY) - drag.start;
    const mm = pixelsMoved * drag.unitsPerPx;
    const next = Math.max(step, Math.round((drag.from + mm / mmPerUnit) / step) * step);
    onResize(drag.axis, Number(next.toFixed(3)));
    setDrag({ ...drag, at: canvasPoint(event) });
  };
  const endResize = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag || drag.id !== event.pointerId) return;
    onResizeEnd?.(drag.axis);
    setDrag(null);
    setHeld(null);
    setView(fitted);
  };
  // Arrow keys grow the size the way its handle drags: right or down grows; shift for ten steps.
  const keyResize = (event: ReactKeyboardEvent<SVGGElement>, axis: Axis) => {
    const sign = { ArrowRight: 1, ArrowDown: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!onResize || !sign) return;
    event.preventDefault();
    onResize(axis, Number(Math.max(step, values[axis] + sign * (event.shiftKey ? 10 : 1) * step).toFixed(3)));
  };

  const onPanDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (view.zoom <= 1 || event.button !== 0 || drag) return;
    pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { zoom: view.zoom, x: cx, y: cy } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPanMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = pan.current;
    if (!start || start.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setView({ zoom: start.view.zoom, x: start.view.x - (event.clientX - start.x) / rect.width / start.view.zoom, y: start.view.y - (event.clientY - start.y) / rect.height / start.view.zoom });
  };
  const endPan = () => { pan.current = null; };

  const stroke = unit * 1.1;
  const font = Math.max(width, height) / 70;
  const types = ORDER.filter(type => output.paths.some(path => path.type === type && path.d));
  const labelled = output.panels.map(panel => {
    const box = boxes.get(panel.id)!;
    return { panel, box, size: Math.min(font, box.w / Math.max(4, panel.label.length) * 1.6, box.h * 0.35) };
  }).filter(item => item.size > font * 0.35);
  const active = drag?.axis ?? hover;
  const activeHandle = placed.find(handle => handle.axis === active);

  return <figure className="dg-preview">
    <div className="dg-canvas-bar">
      {toolbar}
      <div className="dg-zoom" role="group" aria-label={copy.zoom}>
        <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={view.zoom <= 1 || !!held} aria-label={copy.zoomOut}><Minus aria-hidden="true" /></button>
        <button type="button" className="dg-zoom-level" onClick={() => setView(fitted)} disabled={!!held} aria-label={copy.zoomLevel(Math.round(view.zoom * 100))}>{Math.round(view.zoom * 100)}%</button>
        <button type="button" onClick={() => zoomBy(1.5)} disabled={view.zoom >= MAX_ZOOM || !!held} aria-label={copy.zoomIn}><Plus aria-hidden="true" /></button>
        <button type="button" onClick={() => setView(fitted)} disabled={view.zoom <= 1 || !!held} aria-label={copy.fit}><Maximize aria-hidden="true" /></button>
      </div>
    </div>
    <div className="dg-canvas">
      <svg ref={svgRef} className={view.zoom > 1 ? "is-zoomed" : undefined} viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} role="group" aria-label={label}
        onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={endPan} onPointerCancel={endPan}>
        <title>{label}</title>
        {output.panels.map(panel => <polygon key={panel.id} className="dg-panel-shape" points={panel.polygon.map(point => point.join(",")).join(" ")} />)}
        {activeHandle ? <rect className="dg-measured" x={activeHandle.box.x} y={activeHandle.box.y} width={activeHandle.box.w} height={activeHandle.box.h} strokeWidth={unit * 1.5} /> : null}
        {types.map(type => {
          const style = LINE_STYLES[type];
          return <g key={type} fill={type === "glue" ? style.color : "none"} fillOpacity={type === "glue" ? 0.12 : undefined} stroke={style.color} strokeWidth={stroke * (type === "cut" ? 1.4 : 1)}
            strokeDasharray={style.dash ? style.dash.split(" ").map(value => Number(value) * unit * 2.4).join(" ") : undefined} strokeLinejoin="round">
            {output.paths.filter(path => path.type === type).map((path, index) => <path key={index} d={path.d} />)}
          </g>;
        })}
        {showLabels ? <g className="dg-labels">
          {labelled.map(({ panel, box, size }) => <text key={panel.id} x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={size} textAnchor="middle" dominantBaseline="middle">{panel.label}</text>)}
        </g> : null}
        {showSizes ? <g className="dg-sizes" strokeWidth={unit} fontSize={unit * 12}>
          <line x1={0} y1={-pad * 0.5} x2={width} y2={-pad * 0.5} />
          <line x1={0} y1={-pad * 0.5 - unit * 6} x2={0} y2={-pad * 0.5 + unit * 6} /><line x1={width} y1={-pad * 0.5 - unit * 6} x2={width} y2={-pad * 0.5 + unit * 6} />
          <text x={width / 2} y={-pad * 0.5 - unit * 6} textAnchor="middle">{format(width)}</text>
          <line x1={-pad * 0.5} y1={0} x2={-pad * 0.5} y2={height} />
          <line x1={-pad * 0.5 - unit * 6} y1={0} x2={-pad * 0.5 + unit * 6} y2={0} /><line x1={-pad * 0.5 - unit * 6} y1={height} x2={-pad * 0.5 + unit * 6} y2={height} />
          <text x={-pad * 0.5 - unit * 6} y={height / 2} textAnchor="middle" transform={`rotate(-90 ${-pad * 0.5 - unit * 6} ${height / 2})`}>{format(height)}</text>
        </g> : null}
        {onResize ? placed.map(handle => {
          const [hw, hh] = handle.dir === "x" ? [unit * 9, unit * 30] : [unit * 30, unit * 9];
          return <g key={handle.axis} className={`dg-handle${active === handle.axis ? " is-active" : ""}`} tabIndex={0} role="slider"
            aria-label={copy.handle(handle.label)} aria-valuenow={values[handle.axis]} aria-valuemin={step} aria-orientation={handle.dir === "x" ? "horizontal" : "vertical"}
            style={{ cursor: handle.dir === "x" ? "ew-resize" : "ns-resize" }}
            onPointerDown={event => startResize(event, handle.axis, handle.dir)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
            onPointerEnter={() => setHover(handle.axis)} onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(handle.axis)} onBlur={() => setHover(null)} onKeyDown={event => keyResize(event, handle.axis)}>
            <rect className="dg-handle-hit" x={handle.x - unit * 16} y={handle.y - unit * 22} width={unit * 32} height={unit * 44} />
            {handle.dir === "y" ? <rect className="dg-handle-hit" x={handle.x - unit * 22} y={handle.y - unit * 16} width={unit * 44} height={unit * 32} /> : null}
            <rect className="dg-handle-grip" x={handle.x - hw / 2} y={handle.y - hh / 2} width={hw} height={hh} rx={unit * 4.5} strokeWidth={unit * 1.5} />
          </g>;
        }) : null}
      </svg>
      {drag ? <div className="dg-badge" style={{ left: drag.at.x + 16, top: drag.at.y + 16 }}>
        {placed.find(handle => handle.axis === drag.axis)?.label} <b>{values[drag.axis]} {unitLabel}</b>
      </div> : null}
      {onResize && placed.length ? <p className="dg-hint" aria-hidden="true">{copy.dragHint}</p> : null}
    </div>
    <figcaption className="dg-legend">
      {types.map(type => <span key={type}><svg viewBox="0 0 24 6" aria-hidden="true"><line x1="1" y1="3" x2="23" y2="3" stroke={LINE_STYLES[type].color} strokeWidth="2" strokeDasharray={LINE_STYLES[type].dash ? "4 2.5" : undefined} /></svg>{copy.lineNames?.[type] ?? LINE_NAMES[type]}</span>)}
    </figcaption>
  </figure>;
}
