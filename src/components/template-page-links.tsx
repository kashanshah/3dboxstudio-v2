import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BOX_TEMPLATE_PAGES } from "@/content/box-template-pages";

/** Cards linking to each ready template's page, with its live dieline and size picker. */
export function TemplatePageLinks({ title = "Ready-to-use box templates" }: { title?: string }) {
  return <section className="template-page-links" aria-labelledby="template-page-links-title">
    <h2 id="template-page-links-title">{title}</h2>
    <p>Pick a template, enter your size and see the dieline redraw, then open it in the Studio.</p>
    <div>{BOX_TEMPLATE_PAGES.map(page => <Link key={page.slug} href={`/box-templates/${page.slug}`}>
      <b>{page.name}</b><span>{page.description}</span><i>Open template <ArrowRight /></i>
    </Link>)}</div>
  </section>;
}
