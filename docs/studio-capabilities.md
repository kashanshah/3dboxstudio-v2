# Studio capabilities and imagery contract

The target is a full packaging studio, with Pacdora as a capability benchmark. This is a delivery requirement, not a claim that V2 already provides feature parity. The studio route is a CSS 3D design preview; the restored original homepage uses an illustrative opened-box concept. Product breadth must not be reduced to the closed cuboids used to explore the website UI.

## Capability matrix

| Area | Required coverage | Completion evidence |
| --- | --- | --- |
| Immersive 3D | Real geometry; orbit, pan, zoom, touch gestures, fullscreen, camera presets, reset and interior inspection | Inspect all sides and open interiors on desktop and mobile; artwork remains aligned through every view |
| Folding cartons | Straight/reverse tuck, bottom closures, sleeves, trays, window and display variants | Dimensions, panel artwork, thickness, creases and closure behavior validated on each shipped template |
| Corrugated packaging | Mailers, shipping cartons, inserts and supported standard structures | Correct flap pivots, assembly order and fold direction; no visible gaps or intersections at supported dimensions |
| Rigid/gift structures | Separate lid/base, hinged lids, magnetic closures and drawers | Separate moving parts; open, closed and intermediate positions; interior artwork and visible wall thickness |
| Bottles and jars | Glass/plastic families, caps, pumps and droppers; label and wrap mapping | Curved-surface UV placement, label seams and cap parts checked; transparent materials and contents behave consistently |
| Other packaging | Cans, tubes, pouches, bags, cups and containers | Dedicated geometry and artwork regions per family rather than stretching one box model |
| Structure controls | Dimensions, units, thickness, supported shape parameters and closure selection | Valid parameter ranges, stable resizing, preserved artwork and explicit unsupported configurations |
| Opening and folding | Scrubbable open/close state, unfold-to-fold assembly, direction and animation sequencing | Hinges/parts move coherently; label artwork follows panels; export reproduces motion |
| Artwork workflow | Upload, panel/label selection, crop, scale, rotation, alignment, wrap regions and interior artwork | Saved transforms reproduce in 2D view, 3D preview and export; resolution/bleed warnings where relevant |
| Materials and scene | Paper, kraft, corrugated, plastic, glass, metal; matte/gloss; lighting, shadows, background and multiple objects | Repeatable settings with acceptable visual quality and performance; transparent and reflective cases reviewed separately |
| Production structure | Template dielines; cut/crease/glue/bleed markings; dimension and thickness agreement | 2D dieline and assembled geometry derived from the same structure definition; printer validation before production claims |
| Dieline import | SVG/DXF cut-and-crease input, parsing diagnostics, fold assignment and structural review | Representative supported files assemble correctly; ambiguous or unsupported linework is rejected with useful feedback |
| Output and review | Still images, transparent background, turntable/opening video, shareable 3D review and saved projects | Output matches the saved scene; resolution, format and access permissions verified end to end |
| Editing reliability | Undo/redo, autosave, versioning, duplication and recovery | Reload/recovery preserves geometry, artwork, camera, scene and opening state |

These rows combine the user's requirements, verified public Pacdora feature descriptions and our own acceptance criteria. They are the baseline for the V2 product contract. A hands-on workflow audit and a template-level backlog must precede any parity claim.

## Pacdora-class premium parity backlog

Treat this as a tracked product requirement, not a marketing claim. V2 does not need to copy Pacdora's interface, but it must support the same class of professional packaging workflows before we describe it as feature-complete.

| Premium capability | V2 requirement |
| --- | --- |
| Large template catalog | Searchable, filterable, favoritable packaging library spanning cartons, corrugated, rigid, bottles/jars, cans, tubes, pouches/bags, cups/containers and additional validated structures. Catalog architecture must scale to thousands of versioned templates. |
| Real-time 2D + 3D workflow | A dieline/design view and immersive 3D preview must operate on the same project state, with artwork edits reflected immediately and reproducibly. |
| High-resolution rendering | Browser export presets for HD, 2K, 4K and 8K stills where device capability permits, with PNG/JPG, transparent background and scene-background variants. |
| Motion output | Turntable, opening/folding and camera-sequence MP4 export with deterministic timing and saved animation state. |
| Production dielines | Printable dieline export with cut, crease, glue and bleed semantics derived from the same structural definition as the 3D geometry. PDF/DXF/SVG support is evaluated per workflow. |
| Dieline-to-3D | SVG/DXF import, line classification, fold direction, hinge assignment, diagnostics, material choice and interactive folding preview. |
| Scene creator | Multiple packaging objects in one scene with transform, duplicate, grouping/layer ordering, lighting, floor/background, shadows and camera composition. |
| Materials and finishes | Paper/cardboard/kraft/corrugated/plastic/glass/metal plus matte, gloss, transparency, roughness, reflectivity and selected premium finish effects. |
| Sharing and review | Shareable 3D review links, permission-aware versions, comments/annotations, approval status and embeddable review where appropriate. |
| AI-assisted workflows | Optional, non-dominant AI entry points for structure discovery, artwork ideation, background/scene generation and packaging concept assistance. AI output must remain editable and tied to real project geometry. |
| Pro workflow reliability | Undo/redo, autosave, named versions, duplication, recovery, import diagnostics, explicit unsupported states and deterministic exports. |
| Responsive professional UX | Desktop-first precision tools, purposeful tablet drawers and a viewport-first mobile mode with task sheets rather than a collapsed desktop layout. |

### First production vertical slice

The first engine milestone is deliberately narrow but must be real end-to-end:

1. Choose a validated folding-carton template.
2. Set width, height, depth, units and supported board thickness.
3. Switch between shared-source dieline and 3D preview.
4. Upload artwork and assign it to a panel.
5. Crop, scale, rotate, align and choose fit/fill behavior.
6. Orbit, pan, zoom, reset and inspect the package in real 3D.
7. Change board material/finish and basic studio lighting/background.
8. Scrub the opening state on a physically coherent hinged closure.
9. Export a deterministic PNG from the saved camera/scene state.
10. Reload the serialized fixture and reproduce the same visual result.

The next architecture-proof slice adds one curved package (bottle or jar) and one multi-part articulated package (rigid lid/drawer or hinged gift structure). This prevents the engine from becoming box-specific before the data model stabilizes.

## Artwork library and full-dieline implementation

The detailed engineering specification for reusable media assets, full-dieline artwork mapping, panel overrides, storage deduplication, entitlements and rollout phases lives in [Artwork Library and Full-Dieline Artwork](artwork-library-full-dieline.md). Treat that document as the implementation contract for the artwork-library milestone.

## Engine foundation

Use versioned packaging definitions with a family, structure identifier, parameter bounds, artwork regions/UVs, material slots, moving parts, pivots, fold sequence and supported outputs. Separate template geometry, project state and renderer state. Persist template version and all user settings so saved projects and marketing scenes remain reproducible.

Foldable box geometry must share its structural source with dielines. Bottles and flexible packaging need distinct geometry strategies; generic cuboid dimensions cannot substitute for those families. Model readiness includes artwork mapping, openings, interior surfaces, materials and output support, not just a thumbnail.

## Image policy

- The homepage has returned to the original Lovable composition and original still-life. Its illustrative editor window and opened-box geometry describe the planned workflow.
- The later generated packaging collection is no longer the active homepage. Original concept images remain design references, not evidence of supported closure mechanics or export fidelity.
- Every future product image must identify a shipped template, template version, project fixture, artwork, material, lighting, camera and opening state internally. A user should be able to reproduce it in the studio.
- Feature pages for bottles, drawers, folding, transparent glass or animated openings require that exact workflow to be shipped and reviewed first. Until then, any exploration is labeled planned/concept.
- Replace generated marketing studies with actual engine renders as families ship. Keep desktop, mobile, preview and export comparisons to catch differences in seams, proportions, color, finish, transparency, interior geometry and motion.

## Delivery gates

1. Finish the website design system and reviewed content migration.
2. Build one real carton from dimensions and artwork to immersive preview and PNG export; establish shared geometry/project definitions.
3. Add a bottle and a box with an articulated opening early to prove the architecture supports curved and moving geometry.
4. Expand family by family using the capability matrix; ship validated template sets, not an untested catalog of thumbnails.
5. Add dieline assembly/import, scene composition, animation output and review workflows with end-to-end acceptance checks.

## Benchmark sources

Reviewed 2026-09-29. Public documentation is a benchmark input; marketing descriptions alone do not verify implementation limits.

- [Pacdora 3D packaging software](https://www.pacdora.com/tools/3d-packaging-software): packaging families, artwork/material/lighting controls, dimensions and image/video output.
- [Pacdora structural packaging design](https://www.pacdora.com/tools/ai-structural-packaging-design): structure library, folding/opening and dielines.
- [Pacdora dieline-to-3D](https://www.pacdora.com/tools/dieline-to-3d-mockup): SVG/DXF input and fold configuration.
- [Pacdora scene creator](https://www.pacdora.com/3d-creator): multiple objects, scene layout and output.
