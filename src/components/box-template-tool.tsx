"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { templatePreviewGeometry, type PreviewTemplateId } from "@/lib/packaging/template-preview";
import { studioTemplateHref } from "@/lib/studio-entry";
import type { BoxTemplatePreset } from "@/content/box-template-pages";

type Unit = "mm" | "in";
const MM_PER_IN = 25.4;
const toMm = (value: number, unit: Unit) => unit === "in" ? value * MM_PER_IN : value;
const fromMm = (value: number, unit: Unit) => unit === "in" ? Math.round(value / MM_PER_IN * 100) / 100 : Math.round(value * 10) / 10;
const format = (mm: number, unit: Unit) => unit === "in" ? `${(mm / MM_PER_IN).toFixed(2)} in` : `${Math.round(mm)} mm`;

/** Size picker plus a live flat dieline drawn from the Studio's own template geometry. */
export function BoxTemplateTool({ templateId, name, fields, presets, thickness, geometryNote }: {
  templateId: PreviewTemplateId;
  name: string;
  fields: { width: string; height: string; depth: string };
  presets: BoxTemplatePreset[];
  thickness: number;
  geometryNote: string;
}) {
  const first = presets[0];
  const [unit, setUnit] = useState<Unit>(first.unit);
  const [values, setValues] = useState({ width: String(first.width), height: String(first.height), depth: String(first.depth) });
  const [presetIndex, setPresetIndex] = useState<number | null>(0);

  const mm = useMemo(() => ({
    width: toMm(Number(values.width), unit),
    height: toMm(Number(values.height), unit),
    depth: toMm(Number(values.depth), unit),
  }), [values, unit]);
  const valid = Object.values(mm).every(value => Number.isFinite(value) && value >= 1 && value <= 3000);

  const result = useMemo(() => {
    if (!valid) return { error: "Enter sizes between 1 mm and 3000 mm." } as const;
    try {
      return { geometry: templatePreviewGeometry(templateId, { ...mm, thickness }) } as const;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "These dimensions can’t be drawn." } as const;
    }
  }, [templateId, mm, thickness, valid]);

  const choosePreset = (index: number) => {
    const preset = presets[index];
    setUnit(preset.unit);
    setValues({ width: String(preset.width), height: String(preset.height), depth: String(preset.depth) });
    setPresetIndex(index);
  };
  const changeUnit = (next: Unit) => {
    if (next === unit) return;
    setValues(current => ({
      width: valid ? String(fromMm(mm.width, next)) : current.width,
      height: valid ? String(fromMm(mm.height, next)) : current.height,
      depth: valid ? String(fromMm(mm.depth, next)) : current.depth,
    }));
    setUnit(next);
  };
  const changeValue = (key: keyof typeof values, value: string) => {
    setValues(current => ({ ...current, [key]: value }));
    setPresetIndex(null);
  };

  const geometry = "geometry" in result ? result.geometry : null;
  const pad = geometry ? Math.max(geometry.bounds.width, geometry.bounds.height) * 0.04 : 0;
  const stroke = geometry ? Math.max(geometry.bounds.width, geometry.bounds.height) / 450 : 1;
  const href = studioTemplateHref(templateId, valid ? mm : presetMm(first), unit);

  return <section className="btt" aria-labelledby="btt-title">
    <div className="btt-controls">
      <h2 id="btt-title">Set your box size</h2>
      <div className="btt-presets" role="group" aria-label="Common sizes">
        {presets.map((preset, index) => <button key={preset.label} type="button" aria-pressed={presetIndex === index} onClick={() => choosePreset(index)}>
          <b>{preset.label}</b><small>{preset.note}</small>
        </button>)}
      </div>
      <div className="btt-unit" role="group" aria-label="Unit">
        {(["mm", "in"] as const).map(option => <button key={option} type="button" aria-pressed={unit === option} onClick={() => changeUnit(option)}>{option === "mm" ? "Millimetres" : "Inches"}</button>)}
      </div>
      <div className="btt-fields">
        {(["width", "height", "depth"] as const).map(key => <label key={key}>
          <span>{fields[key]}</span>
          <span className="btt-input"><input type="number" inputMode="decimal" min={unit === "in" ? 0.1 : 1} step={unit === "in" ? 0.05 : 1} value={values[key]} onChange={event => changeValue(key, event.target.value)} /><i>{unit}</i></span>
        </label>)}
      </div>
      {geometry ? <dl className="btt-stats">
        <div><dt>Flat sheet</dt><dd>{format(geometry.bounds.width, unit)} × {format(geometry.bounds.height, unit)}</dd></div>
        <div><dt>Panels</dt><dd>{geometry.panels.length}</dd></div>
      </dl> : null}
      <Link className="btt-cta" href={href} onClick={() => trackEvent("template_page_cta_clicked", { template_id: templateId, unit, preset: presetIndex === null ? "custom" : presets[presetIndex].label })}>
        Design this {name.toLowerCase()} in 3D <ArrowRight />
      </Link>
      <small className="btt-cta-note">Opens the Studio with this size. Free account · Google or email.</small>
    </div>
    <figure className="btt-preview">
      {geometry ? <svg viewBox={`${-pad} ${-pad} ${geometry.bounds.width + pad * 2} ${geometry.bounds.height + pad * 2}`} role="img" aria-label={`Flat dieline of a ${name.toLowerCase()} measuring ${format(mm.width, unit)} by ${format(mm.height, unit)} by ${format(mm.depth, unit)}`}>
        {geometry.panels.map(panel => <polygon key={panel.id} className={`btt-panel is-${panel.kind}`} points={panel.outline.map(point => `${point.x},${point.y}`).join(" ")} />)}
        {geometry.crease.map((line, index) => <line key={`c${index}`} className="btt-crease" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} strokeWidth={stroke} strokeDasharray={`${stroke * 5} ${stroke * 3}`} />)}
        {geometry.cut.map((line, index) => <line key={`k${index}`} className="btt-cut" x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} strokeWidth={stroke * 1.4} />)}
        {geometry.panels.filter(panel => panel.kind === "body" && panel.width > geometry.bounds.width * 0.08 && panel.height > geometry.bounds.height * 0.06).map(panel => <text key={`t${panel.id}`} className="btt-label" x={panel.x + panel.width / 2} y={panel.y + panel.height / 2} fontSize={Math.min(panel.width, panel.height) * 0.16} textAnchor="middle" dominantBaseline="middle">{panel.label}</text>)}
      </svg> : <p className="btt-error" role="alert">{"error" in result ? result.error : null}</p>}
      <figcaption>
        <span><i className="btt-key-cut" /> Cut</span><span><i className="btt-key-crease" /> Crease</span>
        <p>{geometryNote}</p>
      </figcaption>
    </figure>
  </section>;
}

function presetMm(preset: BoxTemplatePreset) {
  return { width: toMm(preset.width, preset.unit), height: toMm(preset.height, preset.unit), depth: toMm(preset.depth, preset.unit) };
}
