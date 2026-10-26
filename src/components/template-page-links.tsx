import { BOX_TEMPLATE_PAGES } from "@/content/box-template-pages";
import { studioTemplateHref } from "@/lib/studio-entry";
import { templateSearchText } from "@/lib/template-search";
import { listedTemplates } from "@/lib/packaging/template-catalog";
import { getTemplateCatalog } from "@/server/templates";
import { TemplateCards, type TemplateCard } from "./template-cards";

const formatMm = (value: number) => String(Math.round(value * 10) / 10);
const sizeText = (size: { width: number; height: number; depth: number }) => `${formatMm(size.width)} × ${formatMm(size.height)} × ${formatMm(size.depth)} mm`;

/**
 * The listed templates as cards (Admin → Templates decides which, in what
 * order and with what names): picture, size, a link to the template page and
 * one straight into the Studio. Templates an admin added have no page of
 * their own; their card links to the generator with their defaults instead.
 */
export async function TemplatePageLinks({ title = "Ready-to-use box templates", filters = false }: { title?: string; filters?: boolean }) {
  const pages = new Map<string, (typeof BOX_TEMPLATE_PAGES)[number]>(BOX_TEMPLATE_PAGES.map(page => [page.templateId, page]));
  // Built-ins keep the gallery's page order unless an admin set one.
  const pageOrder = new Map(BOX_TEMPLATE_PAGES.map((page, index) => [page.templateId as string, (index + 1) * 10]));
  const listed = listedTemplates(await getTemplateCatalog())
    .map(entry => ({ entry, order: entry.source === 'built-in' && !entry.orderSet ? pageOrder.get(entry.id) ?? entry.order : entry.order }))
    .sort((a, b) => a.order - b.order)
    .map(item => item.entry);
  const cards: TemplateCard[] = listed.flatMap((entry): TemplateCard[] => {
    const size = entry.defaultDimensions ?? { width: 0, height: 0, depth: 0 };
    const studioHref = studioTemplateHref(entry.id, size, "mm");
    const own = entry.thumbnail?.startsWith("/api/") ? entry.thumbnail : undefined;
    if (entry.source === "built-in") {
      const page = pages.get(entry.id);
      if (!page) return [];
      const name = entry.customCopy?.name ?? page.name;
      const description = entry.customCopy?.description ?? page.description;
      const tags = entry.customCopy?.category ? [entry.customCopy.category, ...page.tags] : page.tags;
      return [{
        slug: page.slug, pageHref: `/box-templates/${page.slug}`, name, description, tags,
        image: own ?? `/images/templates/${page.templateId}.webp`,
        ...(own ? {} : { video: `/videos/templates/${page.templateId}.mp4` }),
        size: sizeText(size), studioHref,
        searchText: templateSearchText([name, page.h1, description, ...tags, ...page.presets.flatMap(preset => [preset.label, preset.note]), ...page.sections.map(section => section.title), page.geometryNote]),
      }];
    }
    return [{
      slug: entry.id, name: entry.name, description: entry.description, tags: [entry.category, ...entry.tags],
      image: entry.thumbnail ?? null,
      size: sizeText(size), studioHref,
      generatorHref: `/box-dieline-generator?style=${encodeURIComponent(entry.id)}`,
      searchText: templateSearchText([entry.name, entry.description, entry.category, ...entry.tags]),
    }];
  });
  return <section className="template-page-links" aria-labelledby="template-page-links-title">
    <h2 id="template-page-links-title">{title}</h2>
    <p>Pick a template, enter your size and see the dieline redraw, or open it straight in the Studio.</p>
    <TemplateCards cards={cards} filters={filters} />
  </section>;
}
