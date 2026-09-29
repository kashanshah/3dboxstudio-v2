# V2 design foundation

Direction: the blue palette and Manrope typography explored in the Lovable Box Studio Design prototype. Apply one interface language to marketing, journal, and studio. The packaging artwork can have its own brand colors.

## Shared tokens

Defined centrally in `src/app/globals.css`:

| Role | Value | Usage |
| --- | --- | --- |
| Primary blue | `#0075c4` | Buttons, links, selected controls, headline emphasis |
| Bright blue | `#0088e5` | Optional decorative accents and large graphics |
| Hover blue | `#005b9a` | Hover states and text on pale blue |
| Pale blue | `#e4f3ff` | Highlighted sections, selection backgrounds |
| Ink | `#101720` | Primary text, logo tile |
| Muted slate | `#5f6c7e` | Secondary text |
| Page | `#f8fafc` | Marketing and product page background |
| Surface | `#ffffff` | Panels and floating controls |
| Canvas | `#e8edf3` | Neutral packaging preview backdrop |
| Border | `#dce3eb` | Subtle structural separators |

The primary action shade is slightly darker than the prototype's bright blue to support readable white text at normal button sizes. Bright blue is reserved for contexts that do not depend on small text contrast. Keep green for actual success feedback, not the general brand accent.

## Typography

Manrope Variable, self-hosted through `@fontsource-variable/manrope`, with Avenir Next and system fallbacks. No Google Fonts request or font download is required at build time. Preserve the original Lovable prototype's typography from commit `f4c3c7d52aec7b7bc171173a94b7d497d75b2649` rather than inventing a replacement. The user explicitly preferred that typography before the subsequent homepage exploration.

| Token | Original reference |
| --- | --- |
| Display scale | `clamp(62px, 7vw, 108px)` |
| Display weight | `650` |
| Display line height | `.89` |
| Display tracking | `-.065em` |
| Lead paragraph | `17px / 1.7` |
| Navigation | `13px`, weight `600` |
| Section heading | Up to `64px`, line height `1`, tracking `-.05em` |

These values are shared CSS tokens. Scale the display to 40–58px on narrow screens, with tracking `-.055em` and line height `.98` for readable wrapping. Keep supporting copy quiet. The fictitious sample packaging brands retain separate artwork typography.

## Homepage composition

Large original Lovable display typography anchors the original side-by-side hero: left-aligned copy and a live packaging showcase, followed by the interactive workspace. Sample artwork selection changes the box design and proportions. Color, finish, rotation, and camera controls update the visible result. Packaging gallery cards load their sample into the workspace; FAQ disclosure and mobile navigation work with the keyboard.

Use packaging examples and visual artwork-to-box comparisons in place of generic feature-card walls or decorative rings. The homepage's reusable styles are scoped in `home-experience.module.css`; renderer sample geometry and artwork are in `box-study.tsx`. This is CSS 3D illustrative geometry, not production WebGL, output rendering, or printable dielines. Keep that distinction clear without filling the product experience with implementation details.

Visual exploration used the Lovable prototype, a Canva website concept, Floot's design principles, and original Higgsfield packaging imagery. Pacdora's homepage was inspected for hierarchy and product discovery; no Pacdora code or imagery was copied. The Canva concept remains a separate exploration, not the production implementation.

## Interaction and layout

- Blue communicates action or selection; neutral surfaces keep artwork prominent.
- Focus rings use primary blue with visible offset.
- Buttons darken on hover; existing reduced-motion support removes transitions.
- Panel corners: 12px. Buttons: 8px. Use restrained shadows for floating/preview surfaces.
- Maintain readable mobile headlines and simplify compact navigation on narrow screens.

Expand this foundation with reusable page sections and component variants while migrating website pages. The initial colors are a direction, not a substitute for device, contrast, and accessibility review of each new component.

## Imagery and studio fidelity

See [studio capabilities](studio-capabilities.md). Hero and example cards use the same sample renderer as the workspace. The generated collection is labeled as a design target, not a studio export. As the real engine ships, replace marketing concept imagery with actual reproducible studio renders using versioned templates, artwork, materials, lighting, and camera presets. Do not advertise bottles, openings, or export quality before their end-to-end workflows ship.
