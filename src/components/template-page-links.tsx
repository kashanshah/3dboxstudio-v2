import { BOX_TEMPLATE_PAGES } from "@/content/box-template-pages";
import { getPackagingTemplate } from "@/lib/packaging/template-registry";
import { studioTemplateHref } from "@/lib/studio-entry";
import { templateSearchText } from "@/lib/template-search";
import { TemplateCards, type TemplateCard } from "./template-cards";

const formatMm = (value: number) => String(Math.round(value * 10) / 10);

/** The ready templates as cards: picture, size, a link to the template page and one straight into the Studio. */
export function TemplatePageLinks({ title = "Ready-to-use box templates", filters = false }: { title?: string; filters?: boolean }) {
  const cards: TemplateCard[] = BOX_TEMPLATE_PAGES.map(page => {
    const size = getPackagingTemplate(page.templateId)?.defaultDimensions ?? { width: 0, height: 0, depth: 0 };
    return {
      slug: page.slug,
      name: page.name,
      description: page.description,
      tags: page.tags,
      image: `/images/templates/${page.templateId}.webp`,
      video: `/videos/templates/${page.templateId}.mp4`,
      size: `${formatMm(size.width)} × ${formatMm(size.height)} × ${formatMm(size.depth)} mm`,
      studioHref: studioTemplateHref(page.templateId, size, "mm"),
      searchText: templateSearchText([page.name, page.h1, page.description, ...page.tags, ...page.presets.flatMap(preset => [preset.label, preset.note]), ...page.sections.map(section => section.title), page.geometryNote]),
    };
  });
  return <section className="template-page-links" aria-labelledby="template-page-links-title">
    <h2 id="template-page-links-title">{title}</h2>
    <p>Pick a template, enter your size and see the dieline redraw, or open it straight in the Studio.</p>
    <TemplateCards cards={cards} filters={filters} />
  </section>;
}
