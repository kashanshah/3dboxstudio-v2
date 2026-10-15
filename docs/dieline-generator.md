# Dieline generator

The free generator on `/box-dieline-generator` and every `/box-templates/[slug]` page: pick a box style, type its size, download the dieline. No account, watermark or limit. Opening the box in the Studio still needs a free account.

## Pieces

| Where | What |
| --- | --- |
| `src/lib/dieline/styles.ts` | The 15 styles, each drawn by a Studio parametric template, so the flat file and the 3D box come from one source. `generate(input)` takes length, width and depth in mm or inches as inside, outside or crease-to-crease (manufacture) sizes, plus board thickness and style sizes. |
| `src/lib/dieline/export/` | SVG (layered), Cricut/Silhouette SVG (inches; cut and score only), DXF R12, PDF (one page or tiled on A4/Letter) and PNG. PDF and PNG are imported only when downloaded. |
| `src/lib/dieline/state.ts` | Settings, board presets, and their URL form. |
| `src/lib/dieline/thumbnails.ts` | Server side: the style picker's cards and the first box, drawn into the page. |
| `src/components/dieline-generator/` | The tool and its preview (zoom with the buttons or ctrl/⌘ + wheel; drag when zoomed). |
| `scripts/dieline.test.cjs` | Engine, exporters and URL state. `docs/FOLD_TEST.md` is the paper check. |

## Loading

The page arrives with the first dieline already drawn, so it shows without JavaScript and costs nothing to hydrate. The engine, with every box template, is a separate chunk: it loads when the visitor first touches or focuses the tool, or at once when there are settings to restore (a link with settings, or saved settings for this style). `compileParametricTemplate` skips its build-every-variant check in production for the same reason; tests still run it.

## URL and saved settings

`?style=mailer-box&l=220&w=160&d=80&u=mm&mode=inner&t=1.5&o_ear=30`

- `l`, `w`, `d`: length (the opening's long side), width (its short side), depth (the height), in `u` (`mm` or `in`).
- `mode`: `inner`, `outer` (crease to crease plus a board) or `manufacture` (crease to crease).
- `t`: board caliper in mm, whatever the units; `mat` only when the material isn't the preset with that caliper.
- `o_<key>`: a style size in `u` (glue flap, tuck, lid height…); `o_window` is the cake box's window border, 0 for none.

The URL updates once the visitor changes something. The last box is kept in `localStorage` (`dieline-generator:v1`) and restored on that style's page when the URL carries no settings. Bad or missing values fall back to the page's defaults.

"Open in 3D Box Studio" passes the inside size, the board (`t`) and the style sizes (`a=key:mm;…`) to `/studio/editor` (`src/lib/studio-entry.ts`). The Studio keeps the sizes its template knows and clamps them to its limits.

## Analytics

Through `trackEvent`, with no personal data:

- `dieline_generate`: once per box the visitor settles on (1.5 s after the last change), with style, unit, mode and material.
- `dieline_export`: format (`svg`, `pdf`, `pdf_a4`, `pdf_letter`, `dxf`, `png`, `cricut`), style, unit and mode.
- `dieline_open_3d`: style and unit.
- `dieline_share`: style; the link is copied to the clipboard.
- `dieline_quote_click`: to come with "Get this box printed".
