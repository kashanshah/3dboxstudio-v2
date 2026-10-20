"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { FIT_PADDING, USES, WEIGHTS, boxSize, orient, suggestBoard, suggestStyles, type Fit, type Units, type Use, type Weight } from "@/lib/box-size";
import "./dieline-generator/dieline-generator.css";
import "./box-size-calculator.css";

/** A box template page the calculator can link to, with its generator style. */
export type CalculatorTarget = { slug: string; name: string; styleId: string };

/**
 * Product size in, box size out: the inside of the box with room round the
 * product, its outside, a board to start from and the styles that suit it,
 * each linking to its dieline generator with the sizes filled in.
 */
export function BoxSizeCalculator({ targets }: { targets: CalculatorTarget[] }) {
  const [units, setUnits] = useState<Units>("mm");
  const [text, setText] = useState({ length: "180", width: "120", depth: "60" });
  const [fit, setFit] = useState<Fit>("standard");
  const [weight, setWeight] = useState<Weight>("light");
  const [use, setUse] = useState<Use>("retail");

  const product = { length: Number(text.length), width: Number(text.width), depth: Number(text.depth) };
  const valid = Object.values(product).every(value => Number.isFinite(value) && value > 0);
  const board = suggestBoard(weight, use);
  const size = valid ? boxSize(orient(product), units, fit, board.thickness) : null;
  const styles = suggestStyles(weight, use).flatMap(item => {
    const target = targets.find(page => page.slug === item.slug);
    return target ? [{ ...item, target }] : [];
  });
  const show = (value: number) => `${value} ${units}`;
  const changeUnits = (next: Units) => {
    if (next === units) return;
    const factor = next === "in" ? 1 / 25.4 : 25.4;
    setText(current => Object.fromEntries(Object.entries(current).map(([key, value]) => {
      const number = Number(value);
      return [key, Number.isFinite(number) && value !== "" ? String(Math.round(number * factor * (next === "in" ? 100 : 10)) / (next === "in" ? 100 : 10)) : value];
    })) as typeof current);
    setUnits(next);
  };
  const generatorHref = (target: CalculatorTarget) => {
    if (!size) return `/box-templates/${target.slug}`;
    const query = new URLSearchParams({ style: target.styleId, l: String(size.inner.length), w: String(size.inner.width), d: String(size.inner.depth), u: units, mode: "inner", t: String(board.thickness) });
    return `/box-templates/${target.slug}?${query}`;
  };

  return <section className="dg bsc" aria-labelledby="bsc-title">
    <div className="dg-head">
      <h2 id="bsc-title" className="dg-title">Your product</h2>
      <p>Free · works in mm or inches</p>
    </div>
    <div className="dg-workspace bsc-workspace">
      <div className="dg-inspector">
        <section className="dg-panel">
          <div className="dg-panel-head">
            <h3>Product size</h3>
            <div className="dg-seg" role="group" aria-label="Units">
              {(["mm", "in"] as const).map(option => <button key={option} type="button" aria-pressed={units === option} onClick={() => changeUnits(option)}>{option}</button>)}
            </div>
          </div>
          <div className="dg-dims">
            {(["length", "width", "depth"] as const).map(key => <label key={key} className="dg-field">
              <span className="dg-scrub" aria-hidden="true">{key === "depth" ? "H" : key[0].toUpperCase()}</span>
              <span className="dg-sr">{key === "depth" ? "Height" : key === "length" ? "Length" : "Width"} in {units}</span>
              <input type="number" inputMode="decimal" min={0} step={units === "in" ? 0.05 : 1} value={text[key]} onChange={event => setText(current => ({ ...current, [key]: event.target.value }))} />
            </label>)}
          </div>
          <p className="dg-hint-text">Measure the product, or its inner packaging, at its widest points.</p>
        </section>
        <section className="dg-panel">
          <h3>Room round it</h3>
          <div className="dg-seg dg-seg-wide" role="radiogroup" aria-label="Fit">
            {(Object.keys(FIT_PADDING) as Fit[]).map(option => <button key={option} type="button" role="radio" aria-checked={fit === option} onClick={() => setFit(option)}>{FIT_PADDING[option].label}</button>)}
          </div>
          <p className="dg-hint-text">{FIT_PADDING[fit].hint}</p>
        </section>
        <section className="dg-panel">
          <h3>Weight</h3>
          <div className="dg-seg dg-seg-wide" role="radiogroup" aria-label="Weight">
            {(Object.keys(WEIGHTS) as Weight[]).map(option => <button key={option} type="button" role="radio" aria-checked={weight === option} onClick={() => setWeight(option)}>{WEIGHTS[option].label}</button>)}
          </div>
          <p className="dg-hint-text">{WEIGHTS[weight].hint}</p>
          <h3 className="bsc-subhead">Use</h3>
          <div className="bsc-uses" role="radiogroup" aria-label="Use">
            {(Object.keys(USES) as Use[]).map(option => <button key={option} type="button" role="radio" aria-checked={use === option} onClick={() => setUse(option)}>{USES[option]}</button>)}
          </div>
        </section>
      </div>

      <div className="bsc-results" aria-live="polite">
        {size ? <>
          <div className="bsc-sizes">
            <div><span>Inside the box</span><b>{show(size.inner.length)} × {show(size.inner.width)} × {show(size.inner.depth)}</b><small>Length × width × height. Type these into the generator as inside sizes.</small></div>
            <div><span>Outside, about</span><b>{show(size.outer.length)} × {show(size.outer.width)} × {show(size.outer.depth)}</b><small>A board thickness further on each side; the generator gives the exact outside for each style.</small></div>
            <div><span>Board to start from</span><b>{board.label}</b><small>{board.thickness} mm. Ask your printer for their equivalent.</small></div>
          </div>
          <h3>Styles that suit it</h3>
          <ul className="bsc-styles">
            {styles.map(({ target, why }) => <li key={target.slug}>
              <Link href={generatorHref(target)} onClick={() => trackEvent("box_size_calculator_style", { style: target.styleId, weight, use, fit })}>
                <b>{target.name}</b><span>{why}</span><i>Make this dieline <ArrowRight aria-hidden="true" /></i>
              </Link>
            </li>)}
          </ul>
        </> : <p className="dg-error" role="alert">Enter a length, width and height above zero.</p>}
      </div>
    </div>
  </section>;
}
