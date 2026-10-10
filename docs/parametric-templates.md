# Parametric template format (draft)

Status: draft, `parametric-template/1`. One template (the split top box) is written in it and proven equal to its hand-written version. Nothing in the studio uses it yet.

## Why

Each template today is four hand-written modules: geometry, renderer, runtime and a frozen layout sheet, about 300 lines in all. The template catalog is what we compete on, and at that rate it can't grow far. Most of that code repeats the same work: place rectangles, list hinges, time the folds, check sizes. What differs between boxes is a set of numbers and formulas, and those can be written as data.

A parametric definition is one plain-data object (JSON-serialisable) that describes:

- **Parameters**: width, height, depth and board thickness, with clamping and fallbacks.
- **Options**: studio choices such as the split direction. Each choice only sets named numbers.
- **Derived values**: industry allowances written as formulas, e.g. `long = width + t` or `slot = corrugated ? max(6, 2 * t) : max(3, t + 1)`.
- **Panels**: rectangles or straight-edged outlines on the sheet, with kind (body/flap/glue), draw layer, artwork rotation and legacy artwork fallbacks.
- **Slits and cuts** that the shared-edge rule can't infer.
- **Validations**: size checks with messages, e.g. `"Use a depth of at least {joint + 5} mm"`.
- **Notes** printed on the cutting template.
- **Fold**: the root panel, fold thickness, centring offset and a tree of hinges. Each hinge says what drives it (forming or closing), when it moves (0–1), its angle and its crease setback.
- **Assembly and export** metadata the studio already reads.

`compileParametricTemplate(definition)` turns a definition into the existing `TemplateRuntime` interface (`src/lib/packaging/template-runtime.ts`), so the studio, PDF export and full-dieline artwork code don't change. The compiler reuses the existing engine:

- `finishExportGeometry` for cut and crease lines: shared panel edges become creases, every other edge is a cut.
- `foldSheet` for the 3D model.

So a definition produces the dieline and the folded box from one source, as the current templates already do.

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
- a hinge names an unknown panel, the root hinges on something, a panel hinges on two parents, a non-root panel has no hinge, or hinges form a loop
- any expression fails while building every option variant once at the fallback size: the dieline, the 3D model at mid-fold, and every validation and its message

## Files

| File | Purpose |
| --- | --- |
| `src/lib/packaging/parametric/format.ts` | The format's types |
| `src/lib/packaging/parametric/expression.ts` | Expression parser and evaluator |
| `src/lib/packaging/parametric/compile.ts` | Definition → `TemplateRuntime`, plus definition checks |
| `src/lib/packaging/parametric/definitions/split-top.ts` | FEFCO 0201/0204 split top box (about 125 lines, mostly data) |
| `scripts/parametric-templates.test.cjs` | Proves the definition reproduces `templates/split-top` exactly |

The parity test compares the hand-written and parametric split top box for four sizes (0.5–7 mm board) and both split directions:

- size clean-up
- design grid panels and bounds
- cutting template: outlines, cut and crease lines, notes
- undersized-box errors and their messages
- every vertex of the 3D model at seven fold and opening stages
- assembly settings
- that the definition gives the same result after a JSON round trip

## Not covered yet

These are the next steps, roughly in order:

1. **Switch the split top over.** Replace `splitTopRuntime` in `templates/index.ts` with `compileParametricTemplate(splitTopDefinition)`. The parity test already shows the output is identical. Keep `sheet-v1.ts` because layout migrations depend on it.
2. **Curved cut edges.** Add an `arc` outline segment (the existing `arcPoints` helper does the work) plus a separate four-corner fold outline, which the tuck end and pizza box need for rounded tucks and thumb notches.
3. **Repetition.** Allow a `repeat` over a list of walls, to remove the copy-paste of four near-identical walls and their flaps.
4. **Port the other three templates** (base box, reverse tuck, pizza box), each with its own parity test, then delete the hand-written renderers.
5. **Template registry metadata.** Name, thumbnail, artwork regions and parameter UI currently live in `template-registry.ts`. They could move into the definition so one record describes a template completely.
6. **Storage and authoring.** Once definitions are stable, load them from the database and build an admin tool that previews the dieline and fold while someone edits the numbers. At that point adding a box shape is a content task, not an engineering one.

Out of scope for this format: bottles, cans, pouches and other curved or flexible packaging. Their geometry isn't folded from flat panels; they will need their own format family that shares only the parameter, option and expression layers.
