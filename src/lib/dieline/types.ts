// The dieline generator's public model: what a style takes in and what it
// gives back, independent of the Studio and of any UI. All geometry is in
// millimetres; units are converted at the edges.

export type Units = 'mm' | 'in';
/**
 * How the three sizes are measured:
 * - inner: the space inside the box (what the product needs);
 * - outer: the outside of the box's walls, crease to crease plus one board;
 * - manufacture: crease to crease on the flat dieline, as a printer quotes it.
 */
export type DimensionMode = 'inner' | 'outer' | 'manufacture';
export type LineType = 'cut' | 'crease' | 'perforation' | 'bleed' | 'safe' | 'glue';

export interface DielineInput {
  styleId: string;
  /** Length, width and depth: the opening's long side, its short side, and the height. */
  length: number;
  width: number;
  depth: number;
  units: Units;
  dimensionMode: DimensionMode;
  /** Board caliper, in `units`. */
  thickness: number;
  /** Style-specific sizes (glue flap, tuck, dust flaps…) in `units`, keyed as the style's `params` lists them; and choices. */
  options?: Record<string, number | boolean | string>;
}

/** One kind of line, as SVG path data in millimetres. */
export interface DielinePath {
  type: LineType;
  d: string;
}

export interface Panel {
  id: string;
  label: string;
  /** The panel's outline on the flat sheet, in mm, y down. */
  polygon: [number, number][];
  /** The panel it folds on; absent for the panel that stays still. */
  foldParent?: string;
  /** The crease it folds about, on the sheet. */
  foldAxis?: [[number, number], [number, number]];
  /** Degrees it turns through to close the box, positive inwards. */
  foldAngle?: number;
}

export interface DielineOutput {
  paths: DielinePath[];
  panels: Panel[];
  /** Flat size of the sheet, in mm. */
  bounds: { width: number; height: number };
  /** The inside size the box was drawn for, in mm, whatever the dimension mode. */
  inner: { length: number; width: number; depth: number };
  /** Plain-language problems: sizes the box can't be made at, or modes a style can't honour exactly. */
  warnings: string[];
}

/** A style-specific size the user may change. */
export interface StyleParam {
  key: string;
  label: string;
  /** Lengths are in the input's units; everything else is a choice. */
  kind: 'length' | 'choice';
  choices?: { value: string; label: string }[];
}

export interface DielineStyle {
  /** Stable id used in URLs and the API, e.g. 'reverse-tuck-end'. */
  id: string;
  name: string;
  category: 'Folding carton' | 'Corrugated' | 'Rigid';
  /** FEFCO or ECMA code, where the style has a standard one. */
  code?: string;
  /** The Studio template this style is drawn and folded with. */
  templateId: string;
  /** Default size in mm, as length, width and depth. */
  defaults: { length: number; width: number; depth: number; thickness: number };
  /** Modes the style can be sized in exactly; others are approximated with a warning. */
  modes: DimensionMode[];
  params: StyleParam[];
  generate(input: DielineInput): DielineOutput;
}
