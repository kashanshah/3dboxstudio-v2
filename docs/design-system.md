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

Match the original Lovable prototype's effective typography from commit `f4c3c7d52aec7b7bc171173a94b7d497d75b2649`. That prototype declares `Manrope, Avenir Next, sans-serif` but does not load Manrope, so on macOS it resolves to Avenir Next. V2 therefore prefers `Avenir Next` for visual parity and self-hosts standard static `Manrope` through `@fontsource/manrope` as the cross-platform fallback. Do not use `Manrope Variable` here.

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

## Homepage composition — original variant restored

The complete first Lovable variant from commit `f4c3c7d52aec7b7bc171173a94b7d497d75b2649` is authoritative. Port its actual source rather than reinterpret its visual direction: original navigation, “Design. Preview. Share.” headline, opened SIGNAL OBJECTS box, mini artwork inspector, floating material/review notes, dark workflow section, still-life showcase, closing section and footer.

`original-home.tsx`, `original-package-box.tsx`, `original-brand-mark.tsx` and `original-button.tsx` adapt only framework imports and Tailwind utility equivalents for Next.js. `src/app/lovable-original.css` preserves the original marketing rules and OKLCH palette, scoped to avoid changing unrelated routes. The original still-life image is used rather than the later packaging collection. The “Watch the flow” action scrolls to the original workflow section.

This is a visual concept of the planned product. The illustrative editor window, saved state, sharing and collaboration notes are not implemented studio services. The linked studio route continues to identify the development preview. Use this full composition as the baseline for future page migrations; do not replace it with centered hero, sample gallery or a new composition unless explicitly requested.

## Interaction and layout

- Blue communicates action or selection; neutral surfaces keep artwork prominent.
- Focus rings use primary blue with visible offset.
- Buttons darken on hover; existing reduced-motion support removes transitions.
- Panel corners: 12px. Buttons: 8px. Use restrained shadows for floating/preview surfaces.
- Maintain readable mobile headlines and simplify compact navigation on narrow screens.

Expand this foundation with reusable page sections and component variants while migrating website pages. The initial colors are a direction, not a substitute for device, contrast, and accessibility review of each new component.

## Imagery and studio fidelity

See [studio capabilities](studio-capabilities.md). The restored hero and still-life are the original visual concept. As the real engine ships, replace concept imagery with reproducible studio renders using versioned templates, artwork, materials, lighting and camera presets while preserving the chosen composition. Review product copy against shipped capabilities before launch.
