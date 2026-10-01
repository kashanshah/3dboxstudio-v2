# Physical dieline PDF export

The Studio's PDF tab downloads a PDF directly in the browser. Geometry is converted from millimetres to points using `72 / 25.4`; it does not pass through CSS, screen zoom, pixels, a printer driver, or a browser print dialog. Inch inputs are already stored as millimetres by the editor.

## Contents and controls

- Outside or inside artwork, exported separately; inside is authored face-on, not automatically mirrored. Duplex imposition and registration must be agreed with the printer.
- Configurable 0–10 mm bleed, default 3 mm. Artwork continues beyond external cutting edges in its existing physical coordinates. Bleed never scales the design or enlarges its nominal panel dimensions, and does not repaint neighboring closure flaps. White or transparent artwork that stops at a cut is not automatically stretched or cloned into the bleed.
- Vector cut and crease paths in independent optional-content layers and named `CutContour` and `Crease` Separation spot colors. Tooling is set to overprint; the printer can select/hide the tooling layers. Both paths are continuous (different colors/layers distinguish their purpose).
- An optional exact 100 mm calibration ruler plus size and printing instructions outside the artwork. `PrintScaling /None` requests actual-size printing. The user must still disable printer/page fitting and measure the ruler after printing.
- TrimBox encloses the net's nominal bounding rectangle; BleedBox extends it by the selected bleed. The irregular vector cut contour defines the net itself. MediaBox includes space for instructions and calibration.

The PDF exporter is dynamically imported on demand. There is no new server endpoint or account/database/storage requirement.

## Template ownership and limitations

`TemplateRuntime.getExportGeometry` supplies a template-specific cutting adapter. The reverse-tuck adapter lives in `templates/reverse-tuck/export.ts` and adds a tapered glue flap, four tapered dust flaps and two tuck tongues. Top and bottom close from opposite hinges. Nominal front, back, side, top and bottom face dimensions match the existing Studio geometry.

The existing mockup is a simplified panel layout. Export does not alter saved designs or the 2D/3D runtime. Per-panel artwork is mapped from the existing layout onto the cutting layout at its physical dimensions. The bottom image is rotated 180 degrees when moved from the front to the opposite back hinge, preserving its folded face orientation. Added closure flaps have no authored imagery; custom base color can cover them. The download UI and PDF disclose these differences.

Base Box and Split Top use their own runtime geometry and are explicitly labelled **layout proofs**, with no claim that their closure details are manufacturing-ready. Future templates opt into cutting geometry through their own runtime; the generic Studio UI never branches on template IDs.

This is nominal structural geometry, not a validated factory die. Material caliper, fold/crease allowance, clearances, glue application, locking details, and tooling settings need the printer's approval and a physical sample. No automatic material compensation or PDF/X/CMYK artwork certification is claimed. The `production-export` capability is intentionally not advertised.

Artwork is rasterized panel by panel at up to 300 dpi, preserving layer order, visibility, opacity, transforms, legacy panel crops, and explicit panel artwork. Source resolution still limits image detail. Each raster is capped at 4,096 pixels per side and 16 million pixels; the PDF reports reduced raster DPI for larger nets. Cutting geometry remains vector at the exact physical scale. Images that fail to load/decode or cannot be embedded abort the download with an actionable error, rather than silently exporting missing artwork. Standard PDF page sizes above 5,080 mm are rejected explicitly.

## Verification

`npm test` includes `scripts/dieline-pdf.test.cjs`: checks exact serialized PDF tooling coordinates, page boxes, the 100 mm ruler, closed cut contour, separation of cut and crease paths, layers/spot colors, reverse-tuck topology, template isolation and invalid export inputs. Fixtures include millimetres, inch-converted sizes and a large net.

`BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:pdf-browser` checks artwork pixels, visibility/opacity, external bleed, bottom orientation, inside/outside scope, explicit artwork precedence, bounded raster size, failed-image handling and real direct downloads. It can write an inspection PDF to the temporary path in `PDF_AUDIT_OUTPUT`.
