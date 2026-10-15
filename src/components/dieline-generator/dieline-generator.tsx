"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Box, Check, Download, Link2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { dielineToSvg } from "@/lib/dieline/export/svg";
import { dielineToCricutSvg, CRICUT_STEPS } from "@/lib/dieline/export/cricut";
import { dielineToDxf } from "@/lib/dieline/export/dxf";
import type { DielineOutput, DielineStyle, DimensionMode, Units } from "@/lib/dieline/types";
import type { GeneratorSetup } from "@/lib/dieline/thumbnails";
import {
  CUSTOM_MATERIAL, MATERIALS, MM_PER_IN, convert, decodeState, defaultState, encodeState, hasState, exportName, roundTo, toPoints,
  type GeneratorState,
} from "@/lib/dieline/state";
import { studioTemplateHref } from "@/lib/studio-entry";
import { DielinePreview } from "./dieline-preview";
import "./dieline-generator.css";

// The free dieline generator: pick a style, type the box's size, and the
// flat dieline is drawn live, ready to download as SVG, PDF, DXF, PNG or a
// cutting-machine file. No account, no limits. Everything runs in the
// browser; the settings live in the URL so a link reopens the same box.

/** A common size for this style, as the page suggests it. */
export type GeneratorPreset = { label: string; note?: string; length: number; width: number; depth: number; units: Units };

const STORAGE_KEY = "dieline-generator:v1";
const MODE_LABELS: Record<DimensionMode, { label: string; hint: string }> = {
  inner: { label: "Inside", hint: "The space inside the box: what your product needs." },
  outer: { label: "Outside", hint: "The outside of the closed box, for shipping and shelf space." },
  manufacture: { label: "Manufacture", hint: "Crease to crease on the flat sheet, as a printer quotes it." },
};
const FIELDS = [
  { key: "length", label: "Length", hint: "the opening's long side" },
  { key: "width", label: "Width", hint: "the opening's short side" },
  { key: "depth", label: "Depth", hint: "the height" },
] as const;
type Field = (typeof FIELDS)[number]["key"];
type Text = Record<Field, string>;

const textOf = (state: GeneratorState): Text => ({ length: String(state.length), width: String(state.width), depth: String(state.depth) });
const readStorage = (): GeneratorState | null => {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) as GeneratorState : null; } catch { return null; }
};
const writeStorage = (state: GeneratorState) => { try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Private mode: settings just aren't remembered. */ } };

type Edit = { state: GeneratorState; text: Text; thicknessText: string; optionText: Record<string, string> };
const editOf = (state: GeneratorState): Edit => ({
  state, text: textOf(state), thicknessText: String(state.thickness),
  optionText: Object.fromEntries(Object.entries(state.options).map(([key, value]) => [key, String(value)])),
});

// The engine (every box template) loads when the visitor first reaches for
// the tool, or at once to restore a shared link or saved settings; until
// then the page shows the box the server drew.
type Engine = typeof import("@/lib/dieline/styles");
let engine: Engine | null = null;
let loading: Promise<Engine> | null = null;
const engineListeners = new Set<() => void>();
function loadEngine() {
  loading ??= import("@/lib/dieline/styles").then(module => {
    engine = module;
    engineListeners.forEach(listener => listener());
    return module;
  });
  return loading;
}
const subscribeEngine = (listener: () => void) => { engineListeners.add(listener); return () => { engineListeners.delete(listener); }; };

const restoredCache = new Map<string, GeneratorState | null>();
function restoredState(loaded: Engine, initial: GeneratorState) {
  const key = `${window.location.search}|${JSON.stringify(initial)}`;
  if (!restoredCache.has(key)) {
    const fromUrl = decodeState(new URLSearchParams(window.location.search), loaded.DIELINE_STYLES, initial);
    const saved = fromUrl ? null : readStorage();
    const fromStorage = saved?.style === initial.style ? decodeState(encodeState(saved), loaded.DIELINE_STYLES, initial) : null;
    restoredCache.set(key, fromUrl ?? fromStorage);
  }
  return restoredCache.get(key)!;
}

/** The dieline for the settings, or what is wrong with them, in plain words. */
function generate(style: DielineStyle, state: GeneratorState, text: Text): { output: DielineOutput } | { error: string } {
  for (const field of FIELDS) {
    const value = Number(text[field.key]);
    if (!text[field.key].trim() || !Number.isFinite(value) || value <= 0) return { error: `Enter a ${field.label.toLowerCase()} above zero.` };
    if (value * (state.units === "in" ? MM_PER_IN : 1) > 3000) return { error: `The ${field.label.toLowerCase()} is over 3 metres. Check the units.` };
  }
  if (!(state.thickness >= 0.1 && state.thickness <= 10)) return { error: "Enter a board thickness between 0.1 and 10 mm." };
  try {
    return { output: style.generate({
      styleId: style.id, length: state.length, width: state.width, depth: state.depth, units: state.units,
      dimensionMode: state.mode, thickness: state.units === "in" ? state.thickness / MM_PER_IN : state.thickness, options: state.options,
    }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "This box can't be drawn at these sizes." };
  }
}

function save(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DielineGenerator({ setup, presets = [], title = "Make your dieline" }: {
  /** The picker and the first box, drawn on the server (lib/dieline/thumbnails.ts). */
  setup: GeneratorSetup;
  presets?: GeneratorPreset[];
  title?: string;
}) {
  const id = useId();
  const { styles: thumbs, initial } = setup;
  const loaded = useSyncExternalStore(subscribeEngine, () => engine, () => null);
  // A shared link's settings, else this visitor's last box of this style:
  // read once in the browser; the server drew the page's defaults.
  const restored = loaded ? restoredState(loaded, initial) : null;
  useEffect(() => {
    if (hasState(new URLSearchParams(window.location.search)) || readStorage()?.style === initial.style) void loadEngine();
  }, [initial]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const current = edit ?? editOf(restored ?? initial);
  const { state, text, thicknessText, optionText } = current;
  const [showLabels, setShowLabels] = useState(true);
  const [showSizes, setShowSizes] = useState(true);
  const [tile, setTile] = useState<"a4" | "letter">("a4");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tracked = useRef(new Set<string>());

  const meta = thumbs.find(thumb => thumb.id === state.style) ?? thumbs[0];
  const style = loaded?.getDielineStyle(state.style) ?? null;
  const unit = state.units;
  const format = (mm: number) => (unit === "in" ? `${(mm / MM_PER_IN).toFixed(2)} in` : `${Math.round(mm * 10) / 10} mm`);

  const apply = (next: GeneratorState) => setEdit(editOf(next));
  const update = (change: (value: Edit) => Edit) => setEdit(change(current));

  // Before the engine arrives the only box there can be is the server's.
  const result = style ? generate(style, state, text) : { output: setup.output };
  const output = "output" in result ? result.output : null;

  // Keep the URL and the remembered settings in step once the visitor changes something.
  const query = encodeState(state).toString();
  const edited = edit !== null;
  useEffect(() => {
    if (!edited) return;
    const timer = window.setTimeout(() => {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${query}${window.location.hash}`);
      writeStorage(state);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [edited, query, state]);

  // One generate event per box the visitor settles on.
  const drawn = output !== null;
  useEffect(() => {
    if (!edited || !drawn || tracked.current.has(query)) return;
    const timer = window.setTimeout(() => {
      tracked.current.add(query);
      trackEvent("dieline_generate", { style: state.style, unit: state.units, mode: state.mode, material: state.material });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [edited, drawn, query, state.style, state.units, state.mode, state.material]);

  const chooseStyle = async (styleId: string) => {
    if (styleId === state.style) return;
    const next = (await loadEngine()).getDielineStyle(styleId);
    if (!next) return;
    const fresh = defaultState(next, unit);
    apply({ ...fresh, mode: next.modes.includes(state.mode) ? state.mode : fresh.mode });
  };
  const setSize = (key: Field, value: string) => update(was => {
    const number = Number(value);
    const valid = value.trim() !== "" && Number.isFinite(number) && number > 0;
    return { ...was, text: { ...was.text, [key]: value }, state: valid ? { ...was.state, [key]: number } : was.state };
  });
  const changeUnit = (next: Units) => {
    if (next === unit) return;
    apply({
      ...state, units: next,
      length: convert(state.length, unit, next), width: convert(state.width, unit, next), depth: convert(state.depth, unit, next),
      options: Object.fromEntries(Object.entries(state.options).map(([key, value]) => [key, convert(value, unit, next)])),
    });
  };
  const changeMaterial = (material: string) => {
    const preset = MATERIALS.find(item => item.id === material);
    apply({ ...state, material, thickness: preset ? preset.thickness : state.thickness });
  };
  const setThickness = (value: string) => update(was => {
    const number = Number(value);
    const valid = Number.isFinite(number) && number > 0;
    return { ...was, thicknessText: value, state: valid ? { ...was.state, thickness: number, material: CUSTOM_MATERIAL } : was.state };
  });
  const setOption = (key: string, value: string) => update(was => {
    const number = Number(value);
    const options = { ...was.state.options };
    if (value.trim() && Number.isFinite(number) && number >= 0) options[key] = number; else delete options[key];
    return { ...was, optionText: { ...was.optionText, [key]: value }, state: { ...was.state, options } };
  });
  const choosePreset = (preset: GeneratorPreset) => apply({ ...state, units: preset.units, length: preset.length, width: preset.width, depth: preset.depth, options: {} });

  const inUnits = (mm: number) => roundTo(unit === "in" ? mm / MM_PER_IN : mm, unit);
  const sizes = output?.sizes ?? [];
  const hasWindow = sizes.some(size => size.key === "window");
  const windowOn = (state.options.window ?? 0) > 0;
  const lengthSizes = sizes.filter(size => size.key !== "window");

  const download = async (format: "svg" | "pdf" | "pdf-tiled" | "dxf" | "png" | "cricut") => {
    if (!output) return;
    setBusy(format);
    try {
      const name = `${meta.name} ${sizeText(state)}`;
      if (format === "svg") save(exportName(state, "svg"), dielineToSvg(output, { title: name, annotations: showSizes }), "image/svg+xml");
      if (format === "cricut") save(exportName(state, "svg", "-cricut"), dielineToCricutSvg(output, name), "image/svg+xml");
      if (format === "dxf") save(exportName(state, "dxf"), dielineToDxf(output), "application/dxf");
      if (format === "pdf" || format === "pdf-tiled") {
        const { dielineToPdf } = await import("@/lib/dieline/export/pdf");
        const bytes = await dielineToPdf(output, { title: name, annotations: true, ...(format === "pdf-tiled" ? { tile } : {}) });
        save(exportName(state, "pdf", format === "pdf-tiled" ? `-${tile}` : ""), bytes as BlobPart, "application/pdf");
      }
      if (format === "png") {
        const { dielineToPng } = await import("@/lib/dieline/export/png");
        save(exportName(state, "png"), await dielineToPng(output, 300, { title: name, annotations: showSizes }), "image/png");
      }
      trackEvent("dieline_export", { format: format === "pdf-tiled" ? `pdf_${tile}` : format, style: state.style, unit, mode: state.mode });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The file couldn't be made.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    const link = `${window.location.origin}${window.location.pathname}?${query}`;
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy this link:", link); }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    trackEvent("dieline_share", { style: state.style, method: "copy_link" });
  };

  // The Studio takes the template's inside size: width across the front, height, depth front to back.
  const studioHref = output ? studioTemplateHref(meta.templateId, {
    width: output.inner.length, height: output.inner.depth, depth: output.inner.width, thickness: state.thickness,
    adjustments: Object.fromEntries(Object.entries(state.options).map(([key, value]) => [key, unit === "in" ? value * MM_PER_IN : value])),
  }, unit) : null;

  const sheet = output ? `${format(output.bounds.width)} × ${format(output.bounds.height)}` : null;
  const inner = output ? `${format(output.inner.length)} × ${format(output.inner.width)} × ${format(output.inner.depth)}` : null;
  const cricutFits = output ? Math.min(output.bounds.width, output.bounds.height) <= 292 && Math.max(output.bounds.width, output.bounds.height) <= 597 : false;

  return <section className="dg" aria-labelledby={`${id}-title`} onPointerDownCapture={() => void loadEngine()} onFocusCapture={() => void loadEngine()}>
    <h2 id={`${id}-title`} className="dg-title">{title}</h2>

    <div className="dg-styles" role="radiogroup" aria-label="Box style">
      {thumbs.map(thumb => <button key={thumb.id} type="button" role="radio" aria-checked={thumb.id === state.style} onClick={() => void chooseStyle(thumb.id)}>
        <svg viewBox={thumb.viewBox} aria-hidden="true"><path d={thumb.d} /></svg>
        <span>{thumb.name}</span>
        {thumb.code ? <small>{thumb.code}</small> : null}
      </button>)}
    </div>

    <div className="dg-body">
      <div className="dg-controls">
        {presets.length ? <div className="dg-presets" role="group" aria-label="Common sizes">
          {presets.map(preset => <button key={preset.label} type="button" onClick={() => choosePreset(preset)}
            aria-pressed={preset.units === unit && preset.length === state.length && preset.width === state.width && preset.depth === state.depth}>
            <b>{preset.label}</b>{preset.note ? <small>{preset.note}</small> : null}
          </button>)}
        </div> : null}

        <fieldset className="dg-group">
          <legend>Size</legend>
          <div className="dg-segmented" role="group" aria-label="Units">
            {(["mm", "in"] as const).map(option => <button key={option} type="button" aria-pressed={unit === option} onClick={() => changeUnit(option)}>{option === "mm" ? "Millimetres" : "Inches"}</button>)}
          </div>
          <div className="dg-fields">
            {FIELDS.map(field => <label key={field.key}>
              <span>{field.label} <small>{field.hint}</small></span>
              <span className="dg-input"><input type="number" inputMode="decimal" min={0} step={unit === "in" ? 0.05 : 1} value={text[field.key]} onChange={event => setSize(field.key, event.target.value)} /><i>{unit}</i></span>
            </label>)}
          </div>
          <label className="dg-select">
            <span>Measured as</span>
            <select value={state.mode} onChange={event => apply({ ...state, mode: event.target.value as DimensionMode })}>
              {(["inner", "outer", "manufacture"] as const).map(mode => <option key={mode} value={mode} disabled={!meta.modes.includes(mode)}>
                {MODE_LABELS[mode].label}{meta.modes.includes(mode) ? "" : " (not for this style)"}
              </option>)}
            </select>
            <small>{MODE_LABELS[state.mode].hint}</small>
          </label>
        </fieldset>

        <fieldset className="dg-group">
          <legend>Board</legend>
          <label className="dg-select">
            <span>Material</span>
            <select value={state.material} onChange={event => changeMaterial(event.target.value)}>
              {MATERIALS.map(material => <option key={material.id} value={material.id}>{material.label} ({material.thickness} mm)</option>)}
              <option value={CUSTOM_MATERIAL}>Custom thickness</option>
            </select>
          </label>
          <label className="dg-thickness">
            <span>Thickness <small>{toPoints(state.thickness)} pt</small></span>
            <span className="dg-input"><input type="number" inputMode="decimal" min={0.1} max={10} step={0.01} value={thicknessText} onChange={event => setThickness(event.target.value)} /><i>mm</i></span>
          </label>
        </fieldset>

        {hasWindow ? <fieldset className="dg-group">
          <legend>Window</legend>
          <label className="dg-check"><input type="checkbox" checked={windowOn} onChange={event => setOption("window", event.target.checked ? String(unit === "in" ? 1 : 30) : "0")} /> Cut a window in the lid</label>
          {windowOn ? <label>
            <span>Border round the window</span>
            <span className="dg-input"><input type="number" inputMode="decimal" min={0} step={unit === "in" ? 0.05 : 1} value={optionText.window ?? ""} onChange={event => setOption("window", event.target.value)} /><i>{unit}</i></span>
          </label> : null}
        </fieldset> : null}

        {lengthSizes.length ? <details className="dg-group dg-advanced">
          <summary>Flaps and allowances</summary>
          <p>Leave blank for the style&apos;s own size, worked out from your box.</p>
          {lengthSizes.map(size => <label key={size.key}>
            <span>{size.label} <small>{inUnits(size.min)}–{inUnits(size.max)} {unit}</small></span>
            <span className="dg-input"><input type="number" inputMode="decimal" min={0} step={unit === "in" ? 0.01 : 0.5} placeholder={String(inUnits(size.value))} value={optionText[size.key] ?? ""} onChange={event => setOption(size.key, event.target.value)} /><i>{unit}</i></span>
          </label>)}
        </details> : null}
      </div>

      <div className="dg-main">
        <div className="dg-toolbar">
          <label className="dg-check"><input type="checkbox" checked={showLabels} onChange={event => setShowLabels(event.target.checked)} /> Panel names</label>
          <label className="dg-check"><input type="checkbox" checked={showSizes} onChange={event => setShowSizes(event.target.checked)} /> Sizes</label>
        </div>
        {output
          ? <DielinePreview output={output} showLabels={showLabels} showSizes={showSizes} format={format}
            label={`Flat dieline of a ${meta.name.toLowerCase()}, ${state.length} × ${state.width} × ${state.depth} ${unit} (${MODE_LABELS[state.mode].label.toLowerCase()}); the flat sheet is ${sheet}.`} />
          : <div className="dg-preview dg-error" role="alert">{"error" in result ? result.error : null}</div>}

        {output ? <dl className="dg-summary">
          <div><dt>Flat sheet</dt><dd>{sheet}</dd></div>
          <div><dt>Inside</dt><dd>{inner}</dd></div>
          <div><dt>Panels</dt><dd>{output.panels.length}</dd></div>
        </dl> : null}
        {output?.warnings.length ? <ul className="dg-warnings" role="status">{output.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}

        <div className="dg-actions">
          <h3>Download <small>Free, no account, no watermark</small></h3>
          <div className="dg-downloads">
            <button type="button" onClick={() => download("svg")} disabled={!output || busy !== null}><Download aria-hidden="true" /> SVG <small>Illustrator, Inkscape</small></button>
            <button type="button" onClick={() => download("pdf")} disabled={!output || busy !== null}><Download aria-hidden="true" /> PDF <small>{busy === "pdf" ? "Making…" : "At 100%, one page"}</small></button>
            <button type="button" onClick={() => download("dxf")} disabled={!output || busy !== null}><Download aria-hidden="true" /> DXF <small>CAD, cutting tables</small></button>
            <button type="button" onClick={() => download("png")} disabled={!output || busy !== null}><Download aria-hidden="true" /> PNG <small>{busy === "png" ? "Making…" : "300 dpi preview"}</small></button>
            <button type="button" onClick={() => download("cricut")} disabled={!output || busy !== null}><Download aria-hidden="true" /> Cricut / Silhouette <small>Cut and score SVG</small></button>
            <span className="dg-tiled">
              <button type="button" onClick={() => download("pdf-tiled")} disabled={!output || busy !== null}><Download aria-hidden="true" /> Print at home <small>{busy === "pdf-tiled" ? "Making…" : "Tiled PDF"}</small></button>
              <select aria-label="Paper size" value={tile} onChange={event => setTile(event.target.value as "a4" | "letter")}><option value="a4">A4</option><option value="letter">Letter</option></select>
            </span>
          </div>
          <details className="dg-cricut">
            <summary>Using a Cricut or Silhouette{output ? (cricutFits ? ": fits a 12 × 24 in mat" : ": larger than a 12 × 24 in mat") : ""}</summary>
            <ol>{CRICUT_STEPS.map(step => <li key={step}>{step}</li>)}</ol>
          </details>
          <div className="dg-more">
            {studioHref ? <Link className="dg-primary" href={studioHref} onClick={() => trackEvent("dieline_open_3d", { style: state.style, unit })}><Box aria-hidden="true" /> Open in 3D Box Studio</Link> : null}
            <button type="button" className="dg-secondary" onClick={share} disabled={!output}>{copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />} {copied ? "Link copied" : "Copy link to this box"}</button>
          </div>
          <p className="dg-note">3D Box Studio folds this box in 3D with your artwork; it needs a free account. Check the board, allowances and bleed with your printer before production.</p>
        </div>
      </div>
    </div>
  </section>;
}

function sizeText(state: GeneratorState) {
  return `${state.length} x ${state.width} x ${state.depth} ${state.units}`;
}
