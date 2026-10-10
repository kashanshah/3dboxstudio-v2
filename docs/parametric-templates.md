# Parametric template format (draft)

Status: draft, `parametric-template/1`. The split top box is built from it in the studio, the PDF export and the public template pages. Its output is proven equal to the hand-written version it replaced.

## Why

Each template today is four hand-written modules: geometry, renderer, runtime and a frozen layout sheet, about 300 lines in all. The template catalog is what we compete on, and at that rate it can't grow far. Most of that code repeats the same work: place rectangles, list hinges, time the folds, check sizes. What differs between boxes is a set of numbers and formulas, and those can be written as data.

A parametric definition is one plain-data object (JSON-serialisable) that describes:

- **Parameters**: width, height, depth and board thickness, with clamping and fallbacks.
- **Options**: studio choices such as the split direction. Each choice only sets named numbers.
- **Derived values**: industry allowances written as formulas, e.g. `long = width + t` or `slot = corrugated ? max(6, 2 * t) : max(3, t + 1)`.
- **Panels**: rectangles, or outlines made of corners and circular arcs, with kind (body/flap/glue), draw layer, artwork rotation and legacy artwork fallbacks. A panel whose cut outline is curved or has more than four corners also gives the four-corner `fold` shape the 3D model folds, like the hand-written tuck end die does for rounded tucks and the thumb notch.
- **Slits and cuts** that the shared-edge rule can't infer.
- **Validations**: size checks with messages, e.g. `"Use a depth of at least {joint + 5} mm"`.
- **Notes** printed on the cutting template.
- **Fold**: the root panel, fold thickness, centring offset and a tree of hinges. Each hinge says what drives it (forming or closing), when it moves (0–1), its angle and its crease setback.
- **Assembly and export** metadata the studio already reads.

`compileParametricTemplate(definition)` turns a definition into the existing `TemplateRuntime` interface (`src/lib/packaging/template-runtime.ts`), so the studio, PDF export and full-dieline artwork code don't change. The compiler reuses the existing engine:

- `finishExportGeometry` for cut and crease lines: shared panel edges become creases, every other edge is a cut.
- `foldSheet` for the 3D model.

So a definition produces the dieline and the folded box from one source, as the current templates already do.

Pages that only show a dieline (the public template pages) use `compileParametricSheet` from `parametric/sheet.ts` instead. It gives the sizes, design grid and cutting template without loading the 3D code.

### Arcs

An outline entry is either a corner `[x, y]` or an arc:

```ts
{ arc: { center: ['l + radius', 'tip + radius'], radius: 'radius', from: -90, to: -180 } }
```

Angles are in degrees, with 0 pointing right and 90 pointing down the sheet. The arc is drawn as `segments` short straight cuts (8 by default), using the same `arcPoints` helper as the hand-written dies.

## Expressions

Formulas are strings in a small language evaluated without `eval`:

- numbers and named values (`depth`, `front.width`)
- `+ - * / %`, comparisons, `&& || !` and `a ? b : c`
- `min max abs sqrt floor ceil round clamp sin cos tan atan2` and `pi`

Unknown names, bad syntax and non-finite results are errors. What's in scope, by section:

| Section | Names available |
| --- | --- |
| Derived values, panels, slits, cuts, validations, notes | Dimensions, option values, earlier derived values |
| Hinges, fold offset, panel layers | All of the above, plus `foldT` (the fold thickness) and each panel's box as `<id>.x`, `<id>.y`, `<id>.width`, `<id>.height` |

## Checked at compile time

A definition is rejected, naming the template, when:

- the format is unknown or a dimension parameter is missing
- a panel id is repeated or an outline has fewer than three corners
- a panel with arcs or more than four corners has no four-corner `fold` shape, or a `fold` shape doesn't have four corners
- a hinge names an unknown panel, the root hinges on something, a panel hinges on two parents, a non-root panel has no hinge, or hinges form a loop
- any expression fails while building every option variant once at the fallback size: the dieline, the 3D model at mid-fold, and every validation and its message

## Files

| File | Purpose |
| --- | --- |
| `src/lib/packaging/parametric/format.ts` | The format's types |
| `src/lib/packaging/parametric/expression.ts` | Expression parser and evaluator |
| `src/lib/packaging/parametric/sheet.ts` | Definition checks, sizes, design grid and cutting template (no 3D code) |
| `src/lib/packaging/parametric/compile.ts` | The 3D fold, and the full `TemplateRuntime` |
| `src/lib/packaging/parametric/definitions/split-top.ts` | FEFCO 0201/0204 split top box |
| `src/lib/packaging/templates/split-top/` | `runtime.ts` compiles the definition; `geometry.ts` gives the flat side to layout migrations and template pages; `sheet-v1.ts` stays frozen for migrations |
| `scripts/reference/split-top-handwritten.ts` | The hand-written split top, frozen, used only by the parity test |
| `scripts/parametric-templates.test.cjs` | Parity, arcs, live wiring and definition-check tests |

The parity test compares the definition with the frozen hand-written split top box for four sizes (0.5–7 mm board) and both split directions:

- size clean-up
- design grid panels and bounds
- cutting template: outlines, cut and crease lines, notes
- undersized-box errors and their messages
- every vertex of the 3D model at seven fold and opening stages
- assembly settings

It also checks:

- that the studio's registered runtime and the template-page geometry both come from the definition
- that a definition gives the same result after a JSON round trip
- that arcs and fold shapes reproduce the straight tuck end die's thumb-notched back and rounded top tuck exactly, at three sizes

## Not covered yet

Done: the split top box runs on its definition, and outlines support arcs with a separate four-corner fold shape. Next, roughly in order:

1. **Port the tuck end boxes** (base box, then reverse tuck). Their dies can already be drawn. The folding needs three additions:
   - hinge parents and panel positions chosen by an option (the lid hinges on whichever wall the opening mode picks)
   - hinge angles that depend on other hinges (the tuck tongue curls just enough to clear the opposite wall as the lid comes down, which needs `asin`)
   - door openings driven by the opening slider
2. **Repetition.** Allow a `repeat` over a list of walls, to remove the copy-paste of four near-identical walls and their flaps.
3. **Port the pizza box**, then delete the remaining hand-written renderers and each frozen reference once its template has been stable in production.
4. **Template registry metadata.** Name, thumbnail, artwork regions and parameter UI currently live in `template-registry.ts`. They could move into the definition so one record describes a template completely.
5. **Storage and authoring.** Once definitions are stable, load them from the database and build an admin tool that previews the dieline and fold while someone edits the numbers. At that point adding a box shape is a content task, not an engineering one.

Out of scope for this format: bottles, cans, pouches and other curved or flexible packaging. Their geometry isn't folded from flat panels; they will need their own format family that shares only the parameter, option and expression layers.
