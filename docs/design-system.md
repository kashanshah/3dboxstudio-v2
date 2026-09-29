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

Manrope Variable, self-hosted through `@fontsource-variable/manrope`, with Avenir Next and system fallbacks. No Google Fonts request or font download is required at build time. Headings use clear sans-serif emphasis; avoid mixing editorial serif typography into the interface. The fictitious sample packaging brand retains its separate artwork typography.

## Interaction and layout

- Blue communicates action or selection; neutral surfaces keep artwork prominent.
- Focus rings use primary blue with visible offset.
- Buttons darken on hover; existing reduced-motion support removes transitions.
- Panel corners: 12px. Buttons: 8px. Use restrained shadows for floating/preview surfaces.
- Maintain readable mobile headlines and simplify compact navigation on narrow screens.

Expand this foundation with reusable page sections and component variants while migrating website pages. The initial colors are a direction, not a substitute for device, contrast, and accessibility review of each new component.
