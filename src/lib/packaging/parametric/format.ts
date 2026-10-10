import type { Expr } from './expression';
import type { PackagingTemplateDefinition } from '../template-registry';

// The parametric template format: one plain-data description of a folded
// package from which the studio derives the design grid, the printable
// cutting template (cut, crease, slit) and the folding 3D model. Everything
// here is JSON-serialisable, so definitions can live in files, a database or
// an authoring tool; `compileParametricTemplate` turns one into the runtime the
// studio already uses. See docs/parametric-templates.md.

export const PARAMETRIC_TEMPLATE_FORMAT = 'parametric-template/1';

export type DimensionKey = 'width' | 'height' | 'depth' | 'thickness';

export type ParameterSpec = {
  /** Used when the value is missing or not a number. */
  fallback: number;
  min?: number;
  max?: number;
};

/**
 * A choice the user makes in the studio. Each choice sets named values that
 * the rest of the definition reads, so a variant is a few numbers rather than
 * a second template.
 */
export type OptionSpec = {
  /** The studio setting the choice comes from. */
  source: 'splitTopHingeSide' | 'openingMode';
  default: string;
  choices: Record<string, Record<string, number>>;
};

/**
 * One step along a cut outline: a corner, or a circular arc from one angle
 * to another (degrees, 0 pointing right, 90 down the sheet), drawn as short
 * straight cuts the way die makers approximate curves.
 */
export type OutlineEntry =
  | [Expr, Expr]
  | { arc: { center: [Expr, Expr]; radius: Expr; from: Expr; to: Expr; segments?: number } };

export type PanelSpec = {
  id: string;
  /** Shown on the design grid ("TOP FRONT"); the artwork name is derived from it. */
  label: string;
  kind: 'body' | 'flap' | 'glue';
  /** Artwork and picking name, when not the label in title case. */
  name?: string;
  /**
   * Leave the panel out of this variant. A panel may be listed more than once
   * with the same id (a wall with and without a thumb notch) when every copy
   * has a `when` and at most one applies.
   */
  when?: Expr;
  /** Draw order where panels overlap without a crease; higher covers lower. */
  layer?: Expr;
  artworkRotation?: 0 | 180;
  /** Unprinted closure flap (tuck tongue, dust flap). */
  closureFlap?: boolean;
  /**
   * Older designs' artwork for this panel, as a region of a panel that no
   * longer exists ("Bottom" before the bottom was split in two).
   */
  artworkFallback?: { name: string; uv: [number, number, number, number] };
  /**
   * The four corners the 3D model folds, when the cut outline has curves or
   * more corners (rounded tucks, a thumb notch, shouldered dust flaps).
   */
  fold?: [[Expr, Expr], [Expr, Expr], [Expr, Expr], [Expr, Expr]];
  /**
   * The four corners the 3D model folds when they differ from the cut panel
   * itself (a roll strip drawn as wide as its score bends). Only the model
   * uses them; the cutting template keeps `outline` and `fold`. Fold values
   * (`foldT`, panel boxes) are available.
   */
  model?: [[Expr, Expr], [Expr, Expr], [Expr, Expr], [Expr, Expr]];
} & (
  /** x, y, width, height on the sheet in millimetres, y down. */
  | { rect: [Expr, Expr, Expr, Expr] }
  /** Corners and arcs in order round the panel. */
  | { outline: OutlineEntry[] }
);

export type LineSpec = { when?: Expr } & (
  | { from: [Expr, Expr]; to: [Expr, Expr] }
  /** A circular arc cut as short straight lines (a finger hole), angles in degrees. */
  | { arc: { center: [Expr, Expr]; radius: Expr; from: Expr; to: Expr; segments?: number } }
);

export type HingeSpec = {
  child: string;
  parent: string;
  /**
   * Use this hinge only in this variant (a lid hinged on whichever wall the
   * opening mode picks). Each panel but the root needs exactly one hinge.
   */
  when?: Expr;
  /** Millimetres the crease sits inside the parent (see SheetHinge.setback). */
  setback?: Expr;
} & (
  | {
    /**
     * What moves the fold: forming the box from the flat sheet, or closing it
     * (the reverse of the studio's opening slider).
     */
    drive: 'formation' | 'closing';
    /** The fold runs over this part of its drive, 0 to 1, eased at both ends. */
    from: Expr;
    to: Expr;
    /** Fold angle at the end, in degrees. Defaults to 90. */
    degrees?: Expr;
  }
  /**
   * The fold angle in radians, for folds that depend on others (a tuck tongue
   * curling to clear the opposite wall as its lid comes down) or on the
   * opening slider (doors). Usually a name from `fold.motions`.
   */
  | { angle: Expr }
);

/** A definition with every `repeat` block expanded: what the compiler works on. */
export type ExpandedTemplate = {
  format: typeof PARAMETRIC_TEMPLATE_FORMAT;
  templateId: string;
  structureKey: string;
  rendererKey: string;
  /** Explains the structure to whoever edits the definition next. */
  description?: string;
  parameters: Record<DimensionKey, ParameterSpec>;
  options?: OptionSpec[];
  /**
   * Named values computed in order; each may use the dimensions, option
   * values and anything defined above it.
   */
  derived: [name: string, value: Expr][];
  panels: PanelSpec[];
  /** Cuts along a crease (tuck slit locks) and cuts inside panels (slots). */
  slits?: LineSpec[];
  cuts?: LineSpec[];
  /** Checked before the cutting template is exported; `{expr}` fills in values. */
  validations?: { require: Expr; message: string }[];
  /** Printed on the cutting template. */
  notes: { text: string; when?: Expr }[];
  fold: {
    /** Panel that stays still while the others fold around it. */
    root: string;
    /** Board thickness for the 3D model, available to hinges as `foldT`. */
    thickness: Expr;
    /**
     * Moves the flat sheet (x right, y up) so the folded box sits centred.
     * Panel boxes are available as `front.x`, `front.width` and so on.
     */
    offset?: [Expr, Expr, Expr];
    /**
     * Instead of `offset`, the whole placement as a column-major 4×4 matrix,
     * for a sheet folded printed side down or turned before it is placed.
     */
    matrix?: Expr[];
    /**
     * Named values computed in order before the hinges, usually fold angles
     * in radians. Besides everything above they can use `formation` and
     * `opening`, the studio's two sliders, each 0 to 1.
     */
    motions?: [name: string, value: Expr][];
    hinges: HingeSpec[];
  };
  assembly: {
    control: 'none' | 'opening-mechanism' | 'split-direction';
    defaultOpeningMode: string;
    /**
     * Whether the box has an open stage after forming: always, never, in
     * these opening modes, or in every mode except these.
     */
    openingStage: 'always' | 'never' | string[] | { except: string[] };
    legacyOpeningAsFormation?: boolean;
  };
  export: {
    kind: 'cutting-template' | 'layout-proof';
    summary?: string;
    artworkNote?: string;
  };
  /**
   * How the template appears in the studio and on the site: names, card
   * image, size controls and artwork regions. The template registry lists
   * every template with a catalog entry as ready.
   */
  catalog?: TemplateCatalog;
};

/** A template's catalog entry: its registry record without what the definition already says. */
export type TemplateCatalog = Omit<PackagingTemplateDefinition, 'id' | 'rendererKey' | 'structureKey' | 'status'>;

// `repeat` blocks (see repeat.ts): any list in an authored definition may hold
// { repeat: [entries], each: [items using {{key}}] } among its items.
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
/** Values for one repetition. A property whose whole value is a placeholder for `null` is left out. */
export type RepeatEntry = Record<string, Json>;
/** An item inside `each`: any value may instead be a `{{key}}` placeholder string. */
export type Templated<T> = string | (T extends object ? { [K in keyof T]: Templated<T[K]> } : T);
export type Repeat<T> = { repeat: RepeatEntry[]; each: Repeatable<Templated<T>> };
export type Repeatable<T> = (T | Repeat<T>)[];

type Lists = 'derived' | 'panels' | 'slits' | 'cuts' | 'validations' | 'notes' | 'fold';
type Item<T> = T extends (infer U)[] ? U : never;

/** A parametric template as authored: plain data, whose lists may repeat items. */
export type ParametricTemplate = Omit<ExpandedTemplate, Lists> & {
  derived: Repeatable<Item<ExpandedTemplate['derived']>>;
  panels: Repeatable<PanelSpec>;
  slits?: Repeatable<LineSpec>;
  cuts?: Repeatable<LineSpec>;
  validations?: Repeatable<Item<NonNullable<ExpandedTemplate['validations']>>>;
  notes: Repeatable<Item<ExpandedTemplate['notes']>>;
  fold: Omit<ExpandedTemplate['fold'], 'hinges' | 'motions'> & {
    hinges: Repeatable<HingeSpec>;
    motions?: Repeatable<Item<NonNullable<ExpandedTemplate['fold']['motions']>>>;
  };
};
