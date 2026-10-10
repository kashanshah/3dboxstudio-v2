# Parametric template format (draft)

Status: draft, `parametric-template/1`. All four ready templates are built from it in the studio, the PDF export, layout migrations and the public template pages: the split top box, the straight tuck end (base box), the reverse tuck end and the pizza box. Each is proven equal to the hand-written version it replaced, and no hand-written template renderers remain.

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

Angles are in degrees, with 0 pointing right and 90 pointing down the sheet. The arc is drawn as `segments` short straight cuts (8 by default), using the same `arcPoints` helper as the hand-written dies. Lines in `cuts` and `slits` can be arcs too, for example the pizza box's finger hole.

### Model shapes and placement

- **`model`** on a panel gives the four corners the 3D model folds when they differ from the cut panel. The pizza box's roll strip is cut two boards wide but modelled three, as wide as its score bends. Only the model uses it; the cutting template keeps `outline` and `fold`.
- **`fold.matrix`** replaces `fold.offset` when the sheet must be turned, not just moved, before it is placed. It is a column-major 4×4 matrix of formulas. The pizza box is folded printed side down with the lid at the back.

### Repeats

Any list in a definition (panels, derived values, hinges, motions, cuts, slits, validations, notes) may hold a `repeat` block in place of near-identical items:

```ts
{
  repeat: [
    { wall: 'front', Wall: 'Front', x: 'xFront', width: 'long', fallback: { name: 'Bottom', uv: [0, 0.5, 1, 0.5] } },
    { wall: 'right', Wall: 'Right', x: 'xRight', width: 'end', fallback: null },
  ],
  each: [
    { id: '{{wall}}', kind: 'body', rect: ['{{x}}', 'top', '{{width}}', 'wallHeight'] },
    { id: 'bottom{{Wall}}', kind: 'flap', artworkFallback: '{{fallback}}', outline: [ … ] },
  ],
}
```

How it expands:

- `each` is expanded once per entry, in order, with every `{{key}}` replaced by that entry's value.
- A string that is only `{{key}}` takes the value itself, so numbers stay numbers and objects stay objects.
- As a property's whole value, `null` leaves the property out.
- Repeats can nest.
- A placeholder with no value is an error.

Expansion happens before the definition is checked or compiled. The split top box uses repeats for its four walls and their flaps, so its definition is plain data with no TypeScript helpers.

### Variants and motions

The opening mode or another option can change the box itself, not just its numbers:

- **Panel variants.** A panel may be listed more than once with the same id when every copy has a `when`, and at most one copy applies. Example: the tuck end's back wall, plain or with a thumb notch depending on which wall the lid hinges on.
- **Conditional hinges.** A hinge with `when` is used only in that variant, for example the lid hinged on whichever wall the opening mode picks. In every variant, each panel except the root must have exactly one hinge, onto a panel that is present.
- **Motions.** `fold.motions` are named values computed before the hinges, from the `formation` and `opening` sliders (0 to 1) and everything else in scope. A hinge can then give its angle directly in radians (`angle: 'turnTop'`) instead of `drive`, `from` and `to`. This covers folds that depend on other folds, such as a tuck tongue curling just enough to clear the opposite wall as its lid comes down, and door openings.

`definitions/tuck-end.ts` shows the pattern for a family of boxes: a function that writes the shared die as data, which each template completes with its own options and fold.

## Expressions

Formulas are strings in a small language evaluated without `eval`:

- numbers and named values (`depth`, `front.width`)
- `+ - * / %`, comparisons, `&& || !` and `a ? b : c`
- `min max abs sqrt floor ceil round clamp pow sin cos tan asin acos atan2`, `pi` and `sqrt1_2`
- `stage(value, start, end)`, an eased 0 → 1 as `value` runs from `start` to `end`, for fold timing
- `skirtCurl(fold, lid, depth, skirt, clearance)`: a lid skirt curling past square until it clears the wall it tucks behind. It's a step-by-step search, so a formula can't express it exactly.

Unknown names, bad syntax and non-finite results are errors. What's in scope, by section:

| Section | Names available |
| --- | --- |
| Derived values, panels, slits, cuts, validations, notes | Dimensions, option values, earlier derived values |
| Motions, hinges, fold offset, panel layers | All of the above, plus `foldT` (the fold thickness) and each panel's box as `<id>.x`, `<id>.y`, `<id>.width`, `<id>.height`. Motions and hinges also get `formation` and `opening` (0 to 1) and the motions defined before them |

## Checked at compile time

A definition is rejected, naming the template, when:

- the format is unknown or a dimension parameter is missing
- a panel id is repeated or an outline has fewer than three corners
- a panel with arcs or more than four corners has no four-corner `fold` shape, or a `fold` shape doesn't have four corners
- a hinge names an unknown panel, the root hinges on something, a non-root panel has no hinge, or a panel has two hinges and they aren't all conditional
- in any variant: more than one copy of a panel applies, a panel has no hinge or two, a hinge holds onto a panel that's left out, or hinges form a loop
- any expression fails while building every option variant once at the fallback size: the dieline, the 3D model at mid-fold, and every validation and its message

## Files

| File | Purpose |
| --- | --- |
| `src/lib/packaging/parametric/format.ts` | The format's types |
| `src/lib/packaging/parametric/expression.ts` | Expression parser and evaluator |
| `src/lib/packaging/parametric/sheet.ts` | Definition checks, sizes, design grid and cutting template (no 3D code) |
| `src/lib/packaging/parametric/compile.ts` | The 3D fold, and the full `TemplateRuntime` |
| `src/lib/packaging/parametric/definitions/split-top.ts` | FEFCO 0201/0204 split top box |
| `src/lib/packaging/parametric/definitions/tuck-end.ts` | The die every tuck end carton shares, and the tongue-curl formula |
| `src/lib/packaging/parametric/definitions/base-box.ts` | ECMA A15.20 straight tuck end, with every opening mode (lid on any wall, doors) |
| `src/lib/packaging/parametric/definitions/reverse-tuck.ts` | ECMA A20.20 reverse tuck end |
| `src/lib/packaging/parametric/definitions/pizza-box.ts` | One-piece corrugated pizza box with a locking double front |
| `src/lib/packaging/templates/split-top/` | `runtime.ts` compiles the definition; `geometry.ts` gives the flat side to layout migrations and template pages; `sheet-v1.ts` stays frozen for migrations |
| `src/lib/packaging/templates/base-box/`, `reverse-tuck/`, `pizza-box/` | `runtime.ts` compiles the definition; `geometry.ts` / `export.ts` give the flat side to layout migrations and template pages |
| `scripts/reference/` | The hand-written versions, frozen, used only by the parity tests |
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

Done:
- all four ready templates run on their definitions
- outlines and cuts support arcs, with a separate four-corner fold shape and a model-only shape
- options can switch panels and hinges, and motions drive folds that depend on each other
- `repeat` blocks replace copy-pasted near-identical items

The parity tests cover:

| Template | Sizes | Coverage |
| --- | --- | --- |
| Tuck ends | 6 (0.3–2 mm board, plus one beyond the limits) | Every opening mode, 17 fold and opening stages |
| Pizza box | 4 (1–5 mm board) | 9 stages |

Next, roughly in order:

1. **Retire the frozen references** in `scripts/reference/` once each template has been stable in production.
2. **Template registry metadata.** Name, thumbnail, artwork regions and parameter UI currently live in `template-registry.ts`. They could move into the definition so one record describes a template completely.
3. **Storage and authoring.** Once definitions are stable, load them from the database and build an admin tool that previews the dieline and fold while someone edits the numbers. At that point adding a box shape is a content task, not an engineering one.

Out of scope for this format: bottles, cans, pouches and other curved or flexible packaging. Their geometry isn't folded from flat panels; they will need their own format family that shares only the parameter, option and expression layers.
