"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { Box, Check, Download, Link2 } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { dielineToSvg } from "@/lib/dieline/export/svg";
import { dielineToCricutSvg, CRICUT_STEPS } from "@/lib/dieline/export/cricut";
import { dielineToDxf } from "@/lib/dieline/export/dxf";
import type { DielineOutput, DielineStyle, Units } from "@/lib/dieline/types";
import type { GeneratorSetup } from "@/lib/dieline/thumbnails";
import {
  CUSTOM_MATERIAL, MATERIALS, MM_PER_IN, convert, decodeState, defaultState, encodeState, hasState, exportName, roundTo, toPoints,
  type GeneratorState,
} from "@/lib/dieline/state";
import { studioTemplateHref } from "@/lib/studio-entry";
import { DielinePreview, type Axis, type ResizeHandle } from "./dieline-preview";
import { GENERATOR_COPY, type GeneratorCopy, type GeneratorExportId, type GeneratorLocale } from "./copy";
import "./dieline-generator.css";

// The free dieline generator: pick a style, type the box's size, and the
// flat dieline is drawn live, ready to download as SVG, PDF, DXF, PNG or a
// cutting-machine file. No account, no limits. Everything runs in the
// browser; the settings live in the URL so a link reopens the same box.

/** A common size for this style, as the page suggests it. */
export type GeneratorPreset = { label: string; note?: string; length: number; width: number; depth: number; units: Units };

const STORAGE_KEY = "dieline-generator:v1";
const FIELDS = ["length", "width", "depth"] as const;
type Field = (typeof FIELDS)[number];
type ExportFormat = GeneratorExportId;
const EXPORT_FORMATS: ExportFormat[] = ["pdf", "pdf_a4", "pdf_letter", "svg", "dxf", "png", "cricut"];
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
function generate(style: DielineStyle, state: GeneratorState, text: Text, copy: GeneratorCopy): { output: DielineOutput } | { error: string } {
  for (const field of FIELDS) {
    const value = Number(text[field]);
    if (!text[field].trim() || !Number.isFinite(value) || value <= 0) return { error: copy.enterAbove(copy.fields[field].label) };
    if (value * (state.units === "in" ? MM_PER_IN : 1) > 3000) return { error: copy.overThreeMetres(copy.fields[field].label) };
  }
  if (!(state.thickness >= 0.1 && state.thickness <= 10)) return { error: copy.thicknessRange };
  try {
    return { output: style.generate({
      styleId: style.id, length: state.length, width: state.width, depth: state.depth, units: state.units,
      dimensionMode: state.mode, thickness: state.units === "in" ? state.thickness / MM_PER_IN : state.thickness, options: state.options,
    }) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : copy.cantDraw };
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

/** Where the tool sits, for analytics: GA4 reports page_slug, page_type and box_type. */
export type GeneratorPage = { type: "template_page"; slug: string; templateId: string } | { type: "dieline_generator"; slug: string };

export function DielineGenerator({ setup, presets = [], title = "Make your dieline", className, page, locale = "en", defaultExport = "pdf" }: {
  /** The picker and the first box, drawn on the server (lib/dieline/thumbnails.ts). */
  setup: GeneratorSetup;
  presets?: GeneratorPreset[];
  title?: string;
  /** Sizing from the page: the tool fills its container. */
  className?: string;
  page?: GeneratorPage;
  /** The language of the tool's own words (copy.ts). */
  locale?: GeneratorLocale;
  /** The file type the Export section starts on (a Cricut page starts on the Cricut file). */
  defaultExport?: GeneratorExportId;
}) {
  const id = useId();
  const copy = GENERATOR_COPY[locale];
  const styleName = (thumb: { id: string; name: string }) => copy.styleNames[thumb.id] ?? thumb.name;
  const pageSlug = page?.slug, pageType = page?.type;
  const pageParams = page ? { page_slug: page.slug, page_type: page.type } : {};
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
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExport);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const tracked = useRef(new Set<string>());
  // Keep the chosen style's card in view in the picker strip, without scrolling the page.
  const strip = useRef<HTMLDivElement>(null);
  const chosen = current.state.style;
  useEffect(() => {
    const row = strip.current;
    const card = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !card) return;
    const left = card.offsetLeft - row.offsetLeft, right = left + card.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, left - 8);
  }, [chosen]);

  const meta = thumbs.find(thumb => thumb.id === state.style) ?? thumbs[0];
  const style = loaded?.getDielineStyle(state.style) ?? null;
  const unit = state.units;
  const format = (mm: number) => (unit === "in" ? `${(mm / MM_PER_IN).toFixed(2)} in` : `${Math.round(mm * 10) / 10} mm`);

  const apply = (next: GeneratorState) => setEdit(editOf(next));
  const update = (change: (value: Edit) => Edit) => setEdit(change(current));

  // Before the engine arrives the only box there can be is the server's.
  const result = style ? generate(style, state, text, copy) : { output: setup.output };
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
      trackEvent("dieline_generate", { ...(pageSlug ? { page_slug: pageSlug, page_type: pageType } : {}), box_type: state.style, style: state.style, unit: state.units, mode: state.mode, material: state.material });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [edited, drawn, query, state.style, state.units, state.mode, state.material, pageSlug, pageType]);

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

  const download = async (format: ExportFormat) => {
    if (!output) return;
    setBusy(format);
    try {
      const name = `${styleName(meta)} ${sizeText(state)}`;
      if (format === "svg") save(exportName(state, "svg"), dielineToSvg(output, { title: name, annotations: showSizes }), "image/svg+xml");
      if (format === "cricut") save(exportName(state, "svg", "-cricut"), dielineToCricutSvg(output, name), "image/svg+xml");
      if (format === "dxf") save(exportName(state, "dxf"), dielineToDxf(output), "application/dxf");
      if (format === "pdf" || format === "pdf_a4" || format === "pdf_letter") {
        const { dielineToPdf } = await import("@/lib/dieline/export/pdf");
        const tile = format === "pdf_a4" ? "a4" : format === "pdf_letter" ? "letter" : undefined;
        const bytes = await dielineToPdf(output, { title: name, annotations: true, ...(tile ? { tile } : {}) });
        save(exportName(state, "pdf", tile ? `-${tile}` : ""), bytes as BlobPart, "application/pdf");
      }
      if (format === "png") {
        const { dielineToPng } = await import("@/lib/dieline/export/png");
        save(exportName(state, "png"), await dielineToPng(output, 300, { title: name, annotations: showSizes }), "image/png");
      }
      trackEvent("dieline_export", { ...pageParams, box_type: state.style, format, style: state.style, unit, mode: state.mode });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : copy.fileFailed);
    } finally {
      setBusy(null);
    }
  };

  // The button that takes a template page's visitor into the Studio: the
  // template pages' main call to action, so it keeps its own event too.
  const openIn3d = () => {
    trackEvent("dieline_open_3d", { ...pageParams, box_type: state.style, style: state.style, unit });
    if (page?.type === "template_page") trackEvent("template_page_cta_clicked", { ...pageParams, box_type: state.style, template_id: page.templateId, unit });
  };

  const share = async () => {
    const link = `${window.location.origin}${window.location.pathname}?${query}`;
    try { await navigator.clipboard.writeText(link); } catch { window.prompt(copy.copyPrompt, link); }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    trackEvent("dieline_share", { ...pageParams, box_type: state.style, style: state.style, method: "copy_link" });
  };

  // The Studio takes the template's inside size: width across the front, height, depth front to back.
  const studioHref = output ? studioTemplateHref(meta.templateId, {
    width: output.inner.length, height: output.inner.depth, depth: output.inner.width, thickness: state.thickness,
    adjustments: Object.fromEntries(Object.entries(state.options).map(([key, value]) => [key, unit === "in" ? value * MM_PER_IN : value])),
  }, unit) : null;

  const sheet = output ? `${format(output.bounds.width)} × ${format(output.bounds.height)}` : null;
  const inner = output ? `${format(output.inner.length)} × ${format(output.inner.width)} × ${format(output.inner.depth)}` : null;
  const cricutFits = output ? Math.min(output.bounds.width, output.bounds.height) <= 292 && Math.max(output.bounds.width, output.bounds.height) <= 597 : false;

  const step = unit === "in" ? 0.05 : 1;
  const mmPerUnit = unit === "in" ? MM_PER_IN : 1;
  const handles: ResizeHandle[] = meta.measure ? FIELDS.map(field => ({ axis: field, label: copy.fields[field].label, panel: meta.measure![field][0], side: meta.measure![field][1] })) : [];
  const resize = (axis: Axis, value: number) => { void loadEngine(); setSize(axis, String(value)); };

  return <section className={`dg${className ? ` ${className}` : ""}`} aria-labelledby={`${id}-title`} onPointerDownCapture={() => void loadEngine()} onFocusCapture={() => void loadEngine()}>
    <div className="dg-head">
      <h2 id={`${id}-title`} className="dg-title">{title}</h2>
      <p>{copy.tagline}</p>
    </div>

    <div ref={strip} className="dg-styles" role="radiogroup" aria-label={copy.styleGroup}>
      {thumbs.map(thumb => <button key={thumb.id} type="button" role="radio" aria-checked={thumb.id === state.style} onClick={() => void chooseStyle(thumb.id)}>
        <svg viewBox={thumb.viewBox} aria-hidden="true"><path d={thumb.d} /></svg>
        <span>{styleName(thumb)}</span>
        {thumb.code ? <small>{thumb.code}</small> : null}
      </button>)}
    </div>

    {presets.length ? <div className="dg-presets" role="group" aria-label={copy.commonSizes}>
      <span>{copy.commonSizes}</span>
      {presets.map(preset => <button key={preset.label} type="button" onClick={() => choosePreset(preset)} title={preset.note}
        aria-pressed={preset.units === unit && preset.length === state.length && preset.width === state.width && preset.depth === state.depth}>{preset.label}</button>)}
    </div> : null}

    <div className="dg-workspace">
      <div className="dg-stage">
        {output
          ? <DielinePreview output={output} showLabels={showLabels} showSizes={showSizes} format={format}
            handles={handles} values={{ length: state.length, width: state.width, depth: state.depth }} step={step} mmPerUnit={mmPerUnit} unitLabel={unit} onResize={resize}
            label={copy.dielineLabel(styleName(meta), `${state.length} × ${state.width} × ${state.depth} ${unit}`, copy.modes[state.mode].label, sheet)} copy={copy.preview}
            toolbar={<div className="dg-view-toggles" role="group" aria-label={copy.show}>
              <button type="button" aria-pressed={showLabels} onClick={() => setShowLabels(value => !value)}>{copy.names}</button>
              <button type="button" aria-pressed={showSizes} onClick={() => setShowSizes(value => !value)}>{copy.sizes}</button>
            </div>} />
          : <div className="dg-preview dg-error" role="alert">{"error" in result ? result.error : null}</div>}
      </div>

      <aside className="dg-inspector" aria-label={copy.settings}>
        <section className="dg-panel">
          <div className="dg-panel-head">
            <h3>{copy.size}</h3>
            <div className="dg-seg" role="group" aria-label={copy.units}>
              {(["mm", "in"] as const).map(option => <button key={option} type="button" aria-pressed={unit === option} onClick={() => changeUnit(option)}>{option}</button>)}
            </div>
          </div>
          <div className="dg-dims">
            {FIELDS.map(field => <ScrubField key={field} letter={copy.fields[field].letter} label={copy.fieldLabel(copy.fields[field].label, unit, copy.fields[field].hint)} value={text[field]} step={step} drag={copy.drag}
              onChange={value => setSize(field, value)} />)}
          </div>
          <div className="dg-seg dg-seg-wide" role="radiogroup" aria-label={copy.measuredAs}>
            {(["inner", "outer", "manufacture"] as const).map(mode => <button key={mode} type="button" role="radio" aria-checked={state.mode === mode} disabled={!meta.modes.includes(mode)}
              onClick={() => apply({ ...state, mode })} title={copy.modes[mode].hint}>{copy.modes[mode].label}</button>)}
          </div>
          <p className="dg-hint-text">{copy.modes[state.mode].hint}</p>
        </section>

        <section className="dg-panel">
          <h3>{copy.board}</h3>
          <div className="dg-board">
            <label className="dg-select"><span className="dg-sr">{copy.material}</span>
              <select value={state.material} onChange={event => changeMaterial(event.target.value)}>
                {MATERIALS.map(material => <option key={material.id} value={material.id}>{copy.materials[material.id] ?? material.label}</option>)}
                <option value={CUSTOM_MATERIAL}>{copy.custom}</option>
              </select>
            </label>
            <ScrubField letter="T" label={copy.thickness(toPoints(state.thickness))} value={thicknessText} unit="mm" step={0.01} min={0.1} drag={copy.drag} onChange={setThickness} />
          </div>
        </section>

        {hasWindow ? <section className="dg-panel">
          <div className="dg-panel-head">
            <h3>{copy.window}</h3>
            <label className="dg-switch"><input type="checkbox" checked={windowOn} onChange={event => setOption("window", event.target.checked ? String(unit === "in" ? 1 : 30) : "0")} /> <span>{copy.windowToggle}</span></label>
          </div>
          {windowOn ? <ScrubField letter="B" label={copy.windowBorder} value={optionText.window ?? ""} unit={unit} step={step} min={0} drag={copy.drag} onChange={value => setOption("window", value)} /> : null}
        </section> : null}

        {lengthSizes.length ? <details className="dg-panel dg-advanced">
          <summary><h3>{copy.flaps}</h3></summary>
          <p className="dg-hint-text">{copy.flapsHint}</p>
          {lengthSizes.map(size => <ScrubField key={size.key} label={copy.flapRange(size.label, inUnits(size.min), inUnits(size.max), unit)} text={size.label} value={optionText[size.key] ?? ""}
            placeholder={String(inUnits(size.value))} unit={unit} step={unit === "in" ? 0.01 : 0.5} min={0} drag={copy.drag} onChange={value => setOption(size.key, value)} />)}
        </details> : null}

        {output ? <dl className="dg-panel dg-summary">
          <div><dt>{copy.flatSheet}</dt><dd>{sheet}</dd></div>
          <div><dt>{copy.inside}</dt><dd>{inner}</dd></div>
          <div><dt>{copy.cricutMat}</dt><dd>{cricutFits ? copy.cricutFits : copy.tooLarge}</dd></div>
        </dl> : null}
        {output?.warnings.length ? <ul className="dg-warnings" role="status">{output.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}

        <section className="dg-panel dg-export">
          <h3>{copy.exportTitle}</h3>
          <div className="dg-export-row">
            <label className="dg-select"><span className="dg-sr">{copy.fileType}</span>
              <select value={exportFormat} onChange={event => setExportFormat(event.target.value as ExportFormat)}>
                {EXPORT_FORMATS.map(item => <option key={item} value={item}>{copy.exports[item].label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="dg-download" onClick={() => void download(exportFormat)} disabled={!output || busy !== null}>
            <Download aria-hidden="true" /> {busy ? copy.making : copy.download(copy.exports[exportFormat].short)}
          </button>
          <p className="dg-hint-text">{copy.exports[exportFormat].hint} {copy.noAccount}</p>
          {exportFormat === "cricut" ? <details className="dg-cricut"><summary>{copy.howToCut}</summary><ol>{(copy.cricutSteps ?? CRICUT_STEPS).map(stepText => <li key={stepText}>{stepText}</li>)}</ol></details> : null}
          {studioHref ? <Link className="dg-primary" href={studioHref} onClick={openIn3d}><Box aria-hidden="true" /> {copy.open3d}</Link> : null}
          <button type="button" className="dg-secondary" onClick={share} disabled={!output}>{copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />} {copied ? copy.linkCopied : copy.copyLink}</button>
          <p className="dg-note">{copy.note}</p>
        </section>
      </aside>
    </div>
  </section>;
}

/**
 * A compact number field, like a design tool's: drag sideways on its letter
 * to scrub the value (shift for ten steps at a time), or type into it.
 */
function ScrubField({ letter, text, label, value, unit, step, min = 0, placeholder, drag, onChange }: {
  letter?: string; text?: string; label: string; value: string; unit?: string; step: number; min?: number; placeholder?: string; drag: string; onChange: (value: string) => void;
}) {
  const scrub = useRef<{ id: number; x: number; from: number } | null>(null);
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  const onDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    const from = Number(value || placeholder || 0);
    if (!Number.isFinite(from)) return;
    scrub.current = { id: event.pointerId, x: event.clientX, from };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const onMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const start = scrub.current;
    if (!start || start.id !== event.pointerId) return;
    const steps = Math.round((event.clientX - start.x) / 3) * (event.shiftKey ? 10 : 1);
    onChange(String(Number(Math.max(min, start.from + steps * step).toFixed(decimals))));
  };
  const onUp = () => { scrub.current = null; };
  return <label className={`dg-field${text ? " has-text" : ""}`}>
    <span className="dg-scrub" title={drag} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden="true">{letter ?? text}</span>
    <span className="dg-sr">{label}</span>
    <input type="number" inputMode="decimal" min={min} step={step} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
    {unit ? <i>{unit}</i> : null}
  </label>;
}

function sizeText(state: GeneratorState) {
  return `${state.length} x ${state.width} x ${state.depth} ${state.units}`;
}
