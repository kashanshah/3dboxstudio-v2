"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { FIT_PADDING, type Fit } from "@/lib/box-size";
import { BOX_SIZE_GROUPS, bothUnits, boxesThatFit, chartBoxHref } from "@/lib/standard-box-sizes";
import "./dieline-generator/dieline-generator.css";
import "./box-size-calculator.css";

type FinderUnits = "in" | "cm";

/**
 * Product size in, the standard boxes it fits out, least empty space first,
 * each linking to its dieline in that size, and a custom size made to measure.
 * `slugs` are the box template pages this deployment serves.
 */
export function BoxSizeFinder({ slugs }: { slugs: string[] }) {
  const [units, setUnits] = useState<FinderUnits>("in");
  const [text, setText] = useState({ length: "7", width: "5", depth: "3" });
  const [fit, setFit] = useState<Fit>("cushioned");

  const factor = units === "in" ? 25.4 : 10;
  const product = { length: Number(text.length) * factor, width: Number(text.width) * factor, depth: Number(text.depth) * factor };
  const valid = Object.values(product).every(value => Number.isFinite(value) && value > 0);
  const groups = BOX_SIZE_GROUPS.map(group => ({ ...group, boxes: group.boxes.filter(box => slugs.includes(box.template.slug)) }));
  const results = valid ? boxesThatFit(product, FIT_PADDING[fit].mm, groups) : [];
  const custom = valid ? (() => {
    const padding = FIT_PADDING[fit].mm;
    const size = [product.length, product.width, product.depth].map(value => value + 2 * padding);
    const show = units === "in" ? size.map(value => Math.round(value / 25.4 * 100) / 100) : size.map(value => Math.round(value));
    const query = new URLSearchParams({ l: String(show[0]), w: String(show[1]), d: String(show[2]), u: units === "in" ? "in" : "mm", mode: "inner" });
    return { label: `${show.join(" × ")} ${units === "in" ? "in" : "mm"}`, href: `/box-dieline-generator?${query}` };
  })() : null;
  const changeUnits = (next: FinderUnits) => {
    if (next === units) return;
    const scale = next === "in" ? 1 / 2.54 : 2.54;
    setText(current => Object.fromEntries(Object.entries(current).map(([key, value]) => {
      const number = Number(value);
      return [key, Number.isFinite(number) && value !== "" ? String(Math.round(number * scale * 10) / 10) : value];
    })) as typeof current);
    setUnits(next);
  };

  return <section className="dg bsc" aria-labelledby="bsf-title">
    <div className="dg-head">
      <h2 id="bsf-title" className="dg-title">Find a standard box that fits</h2>
      <p>Free · inches or cm</p>
    </div>
    <div className="dg-workspace bsc-workspace">
      <div className="dg-inspector">
        <section className="dg-panel">
          <div className="dg-panel-head">
            <h3>Product size</h3>
            <div className="dg-seg" role="group" aria-label="Units">
              {(["in", "cm"] as const).map(option => <button key={option} type="button" aria-pressed={units === option} onClick={() => changeUnits(option)}>{option}</button>)}
            </div>
          </div>
          <div className="dg-dims">
            {(["length", "width", "depth"] as const).map(key => <label key={key} className="dg-field">
              <span className="dg-scrub" aria-hidden="true">{key === "depth" ? "H" : key[0].toUpperCase()}</span>
              <span className="dg-sr">{key === "depth" ? "Height" : key === "length" ? "Length" : "Width"} in {units}</span>
              <input type="number" inputMode="decimal" min={0} step={units === "in" ? 0.25 : 0.5} value={text[key]} onChange={event => setText(current => ({ ...current, [key]: event.target.value }))} />
            </label>)}
          </div>
          <p className="dg-hint-text">Measure the product at its widest points. It may turn any way in the box.</p>
        </section>
        <section className="dg-panel">
          <h3>Room round it</h3>
          <div className="dg-seg dg-seg-wide" role="radiogroup" aria-label="Fit">
            {(Object.keys(FIT_PADDING) as Fit[]).map(option => <button key={option} type="button" role="radio" aria-checked={fit === option} onClick={() => setFit(option)}>{FIT_PADDING[option].label}</button>)}
          </div>
          <p className="dg-hint-text">{FIT_PADDING[fit].hint}</p>
        </section>
      </div>

      <div className="bsc-results" aria-live="polite">
        {valid ? <>
          <h3>Standard boxes it fits</h3>
          {results.length ? <ul className="bsc-styles">
            {results.map(({ box, emptyShare }) => {
              const sizes = bothUnits(box);
              return <li key={`${box.template.slug}-${box.name}`}>
                <Link href={chartBoxHref(box)} onClick={() => trackEvent("box_sizes_finder_pick", { box: box.name, fit })}>
                  <b>{box.name}</b>
                  <span>{sizes.in} in · {sizes.cm} cm{box.measure === "outer" ? " outside" : ""} · {Math.round(emptyShare * 100)}% empty space</span>
                  <i>Make this box <ArrowRight aria-hidden="true" /></i>
                </Link>
              </li>;
            })}
          </ul> : <p className="dg-hint-text">None of the standard sizes below holds it with that much room. Make a box in its own size instead.</p>}
          {custom ? <div className="bsc-sizes">
            <div>
              <span>Or a box made to measure</span>
              <b>{custom.label}</b>
              <small>Inside size, with the room you chose on each side. A custom size cuts empty space, filler and dimensional-weight shipping. <Link href={custom.href} onClick={() => trackEvent("box_sizes_finder_custom", { fit })}>Make the dieline in this size</Link>.</small>
            </div>
          </div> : null}
        </> : <p className="dg-error" role="alert">Enter a length, width and height above zero.</p>}
      </div>
    </div>
  </section>;
}
