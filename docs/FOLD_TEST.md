# Fold test: dieline generator

The unit tests (`scripts/dieline.test.cjs`) check the arithmetic: panel sizes in every mode, closed cut outlines, the fold plan and the exporters. They can't tell whether a box closes well in real board. Before a style goes live, and after any change to its template, print and fold one at the test size below, and tick every line.

## Setup

- Board: 300–350 gsm card (about 0.4–0.5 mm) for folding cartons; single-wall E-flute (about 1.5 mm) where noted. Type the caliper you actually use into the generator.
- Download the **PDF, tiled on A4 or Letter**, with size labels on. Print at **100% / actual size** (turn off "fit to page").
- Measure the 50 mm scale bar on every page. If it isn't 50 mm (±0.5), the print is scaled: fix the print settings before going on.
- Tape the pages together by the crosshair marks; the overlap is 10 mm.
- Cut on red (solid). Score blue (dashed) with a bone folder or a dry ball-point against a ruler. Ignore the green bleed and purple safe lines.
- Optional: cut a second sample from the Cricut SVG on a 12 × 24 in mat, and open the DXF in a CAD viewer to check its size.

## For every style

- [ ] The flat size printed in the PDF legend matches the size the generator shows.
- [ ] Every scored line folds cleanly; no panel needs a score that isn't drawn.
- [ ] Panels meet edge to edge: no gaps over 1 mm at corners, no overlaps that buckle a wall.
- [ ] Flaps, tucks and locks close without forcing and stay closed when the box is turned over.
- [ ] Inner mode: a block cut to the inside size fits with no more than about one board of play.
- [ ] Outer mode: measured with calipers across the closed box, within ±1 mm of the size asked for.
- [ ] Manufacture mode: crease to crease on the flat sheet matches the size asked for, within ±0.5 mm.
- [ ] "Open in 3D" folds the same way the paper box does (same panel order and tuck direction).

## Per style

| Style | Test size L × W × D (mm) | Board | Also check |
| --- | --- | --- | --- |
| Reverse tuck end (ECMA A20.20) | 60 × 30 × 90 | card | The top tuck goes in at the back and the bottom at the front; the tucks' slits hold them shut. |
| Straight tuck end (ECMA A15.20) | 50 × 50 × 80 | card | Both tucks close from the same side (the back). |
| Snap lock (1-2-3) bottom | 60 × 40 × 80 | card | The four bottom flaps interlock in order and hold a 200 g weight lifted by the top. |
| Auto lock (crash lock) bottom | 60 × 45 × 80 | card | Glue the bottom tabs; the box flattens, then the bottom pops into place when the walls are squared. |
| Mailer box (FEFCO 0427) | 150 × 100 × 50 | E-flute | Side walls roll over into double walls; the lid tuck slides behind the front; the ears lock the walls. |
| Shipping carton RSC (FEFCO 0201) | 150 × 100 × 100 | E-flute | Outer flaps meet in the middle; the glue flap sits inside; inner flaps don't overlap. |
| Pillow box | 120 × 70 × 30 (outer) | card | The curved ends fold in without cracking; the box is sized by its outside only. |
| Gable box | 80 × 50 × 70 | card | The roofs meet and the two handles line up so their holes match; the bottom locks. |
| Sleeve | 120 × 40 × 80 | card | Slides over a block of the inside size with light friction. |
| Pizza box | 200 × 200 × 40 | E-flute | Front roll locks, the tabs tuck into the side walls, the lid tuck closes. The template doesn't add board thickness, so check the fit. |
| Drawer box (tray and sleeve) | 100 × 60 × 30 | card | The tray slides into the sleeve from either end without catching; not loose enough to fall out when tilted. |
| Rigid lid and base | 120 × 80 × 40 | card (in place of greyboard) | The lid slips over the base; turn-ins sit flat inside the walls. In greyboard, the lid gap grows with the board: check it at 2 mm. |
| Four-corner tray | 120 × 80 × 40 | card | Each ear glues flat inside its side wall; the walls stand square without bowing. |
| Telescope box (tray with lid) | 120 × 80 × 50 | card | The lid slides over the base without forcing and doesn't drop off when the box is lifted by the lid; try the lid at full height too. |
| Cake box | 150 × 150 × 80 | card | The side walls fold double over the ears and their tabs lock into the base slots; the lid tuck and side flaps close. With a window (border 25 mm), the window is centred and leaves the lid stiff enough. |

## Record

Note the date, style, board and caliper, mode, and any line that failed, with a photo, in the PR that changes the style.
