import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import styles from "./faq-section.module.css";

export type FaqSectionItem = { question: string; answer: string };
type FaqSectionLink = { href: string; label: string };

/** Shared marketing FAQ layout; pass each page's own copy and questions. */
export function FaqSection({
  items,
  title = "Answers before you open the Studio.",
  description,
  links = [],
  id,
  eyebrow = "Frequently asked questions",
  className,
}: {
  items: readonly FaqSectionItem[];
  title?: string;
  description?: ReactNode;
  links?: readonly FaqSectionLink[];
  id?: string;
  /** Also the section's accessible name; pass a translation on localized pages. */
  eyebrow?: string;
  /** Extra class on the section, so a page can align the heading with its own type scale. */
  className?: string;
}) {
  return (
    <section id={id} className={className ? `${styles.section} ${className}` : styles.section} aria-label={eyebrow}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
        {description ? <p className={styles.description}>{description}</p> : null}
        {links.length > 0 ? (
          <div className={styles.links}>
            {links.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}<ArrowRight aria-hidden="true" /></Link>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.accordion}>
        {items.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary><span>{item.question}</span><i aria-hidden="true">+</i></summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
