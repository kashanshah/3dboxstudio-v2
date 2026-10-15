"use client";

import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { LINE_NAMES, LINE_STYLES } from "@/lib/dieline/export/svg";
import type { DielineOutput, LineType } from "@/lib/dieline/types";

// The flat dieline, drawn live as SVG: every line type in its colour, panel
// names, and the overall sizes. Zoom with the buttons or ctrl/⌘ + wheel
// (a trackpad pinch); drag to move round a zoomed sheet.

const ORDER: LineType[] = ["bleed", "safe", "glue", "perforation", "crease", "cut"];
const MAX_ZOOM = 12;

type View = { zoom: number; x: number; y: number };

export function DielinePreview({ output, label, showLabels, showSizes, format }: {
  output: DielineOutput;
  label: string;
  showLabels: boolean;
  showSizes: boolean;
  /** A length in mm as the user reads it ("120 mm", "4.72 in"). */
  format: (mm: number) => string;
}) {
  const { width, height } = output.bounds;
  const pad = Math.max(width, height) * 0.06 + 8;
  const full = { x: -pad, y: -pad, w: width + 2 * pad, h: height + 2 * pad };
  // A view belongs to one sheet size; a new size starts fitted.
  const sizeKey = `${Math.round(width)}x${Math.round(height)}`;
  const fitted: View = { zoom: 1, x: 0.5, y: 0.5 };
  const [kept, setKept] = useState<{ key: string; view: View }>({ key: sizeKey, view: fitted });
  const view = kept.key === sizeKey ? kept.view : fitted;
  const setView = (next: View | ((current: View) => View)) => setKept(was => {
    const base = was.key === sizeKey ? was.view : fitted;
    return { key: sizeKey, view: typeof next === "function" ? next(base) : next };
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; view: View } | null>(null);

  const w = full.w / view.zoom, h = full.h / view.zoom;
  // The view's centre as a fraction of the sheet, kept so the sheet stays in view.
  const clampCentre = (value: number, zoom: number) => Math.min(1 - 0.5 / zoom, Math.max(0.5 / zoom, value));
  const cx = clampCentre(view.x, view.zoom), cy = clampCentre(view.y, view.zoom);
  const viewBox = `${full.x + cx * full.w - w / 2} ${full.y + cy * full.h - h / 2} ${w} ${h}`;

  const zoomBy = (factor: number, at?: { x: number; y: number }) => setView(current => {
    const zoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom * factor));
    if (!at) return { ...current, zoom };
    // Keep the point under the cursor where it is.
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

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (view.zoom <= 1 || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view: { zoom: view.zoom, x: cx, y: cy } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setView({ zoom: start.view.zoom, x: start.view.x - (event.clientX - start.x) / rect.width / start.view.zoom, y: start.view.y - (event.clientY - start.y) / rect.height / start.view.zoom });
  };
  const endDrag = () => { drag.current = null; };

  const stroke = Math.max(width, height) / 600 / Math.sqrt(view.zoom);
  const font = Math.max(width, height) / 70;
  const types = ORDER.filter(type => output.paths.some(path => path.type === type && path.d));
  const labelled = output.panels.map(panel => {
    const xs = panel.polygon.map(point => point[0]), ys = panel.polygon.map(point => point[1]);
    const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    return { panel, box, size: Math.min(font, box.w / Math.max(4, panel.label.length) * 1.6, box.h * 0.35) };
  }).filter(item => item.size > font * 0.35);

  return <figure className="dg-preview">
    <div className="dg-zoom" role="group" aria-label="Zoom">
      <button type="button" onClick={() => zoomBy(1.5)} disabled={view.zoom >= MAX_ZOOM} aria-label="Zoom in"><Plus aria-hidden="true" /></button>
      <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={view.zoom <= 1} aria-label="Zoom out"><Minus aria-hidden="true" /></button>
      <button type="button" onClick={() => setView({ zoom: 1, x: 0.5, y: 0.5 })} disabled={view.zoom <= 1} aria-label="Fit the sheet"><Maximize aria-hidden="true" /></button>
    </div>
    <svg ref={svgRef} className={view.zoom > 1 ? "is-zoomed" : undefined} viewBox={viewBox} role="img" aria-label={label}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {output.panels.map(panel => <polygon key={panel.id} className="dg-panel" points={panel.polygon.map(point => point.join(",")).join(" ")} />)}
      {types.map(type => {
        const style = LINE_STYLES[type];
        return <g key={type} fill={type === "glue" ? style.color : "none"} fillOpacity={type === "glue" ? 0.12 : undefined} stroke={style.color} strokeWidth={stroke * (type === "cut" ? 1.4 : 1)}
          strokeDasharray={style.dash ? style.dash.split(" ").map(value => Number(value) * stroke * 3).join(" ") : undefined} strokeLinejoin="round">
          {output.paths.filter(path => path.type === type).map((path, index) => <path key={index} d={path.d} />)}
        </g>;
      })}
      {showLabels ? <g className="dg-labels">
        {labelled.map(({ panel, box, size }) => <text key={panel.id} x={box.x + box.w / 2} y={box.y + box.h / 2} fontSize={size} textAnchor="middle" dominantBaseline="middle">{panel.label}</text>)}
      </g> : null}
      {showSizes ? <g className="dg-sizes" strokeWidth={stroke * 0.8} fontSize={font}>
        <line x1={0} y1={-pad * 0.55} x2={width} y2={-pad * 0.55} />
        <line x1={0} y1={-pad * 0.75} x2={0} y2={-pad * 0.35} /><line x1={width} y1={-pad * 0.75} x2={width} y2={-pad * 0.35} />
        <text x={width / 2} y={-pad * 0.55 - font * 0.4} textAnchor="middle">{format(width)}</text>
        <line x1={-pad * 0.55} y1={0} x2={-pad * 0.55} y2={height} />
        <line x1={-pad * 0.75} y1={0} x2={-pad * 0.35} y2={0} /><line x1={-pad * 0.75} y1={height} x2={-pad * 0.35} y2={height} />
        <text x={-pad * 0.55 - font * 0.4} y={height / 2} textAnchor="middle" transform={`rotate(-90 ${-pad * 0.55 - font * 0.4} ${height / 2})`}>{format(height)}</text>
      </g> : null}
    </svg>
    <figcaption className="dg-legend">
      {types.map(type => <span key={type}><svg viewBox="0 0 24 6" aria-hidden="true"><line x1="1" y1="3" x2="23" y2="3" stroke={LINE_STYLES[type].color} strokeWidth="2" strokeDasharray={LINE_STYLES[type].dash ? "4 2.5" : undefined} /></svg>{LINE_NAMES[type]}</span>)}
    </figcaption>
  </figure>;
}
