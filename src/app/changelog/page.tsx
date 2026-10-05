import { defaultOgImage } from '@/lib/site';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { changelogReleases } from '@/content/changelog';
import styles from './page.module.css';

const title = 'What’s new in 3DBoxStudio';
const description = 'Follow the latest 3DBoxStudio releases, major improvements, and new ways to design packaging, create dielines, and preview boxes in 3D.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/changelog' },
  openGraph: { images:[defaultOgImage], title, description, type: 'website', url: '/changelog' },
  twitter: { card: 'summary_large_image', title, description,images:[defaultOgImage.url]},
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

export default function ChangelogPage() {
  return <>
    <SiteHeader />
    <main id="main" className={styles.page}>
      <header className={styles.intro}>
        <span className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> Product updates</span>
        <h1>What’s new.</h1>
        <p>A growing record of the releases and improvements that help you bring packaging ideas to life. Newest first.</p>
      </header>
      <ol className={styles.timeline} aria-label="Product releases">
        {changelogReleases.map((release, index) => <li key={release.id} className={styles.entry}>
          <div className={styles.date}>
            <time dateTime={release.date}>{dateFormatter.format(new Date(`${release.date}T00:00:00Z`))}</time>
            {release.version ? <span className={styles.version}>{release.version}</span> : null}
          </div>
          <article id={release.id} className={styles.card} aria-labelledby={`${release.id}-title`}>
            <div className={styles.copy}>
              <div className={styles.tags}>{release.tags.map((tag) => <span key={tag} className={styles[tag.toLowerCase() as 'new' | 'improved' | 'fixed']}>{tag}</span>)}</div>
              <h2 id={`${release.id}-title`}><a href={`#${release.id}`}>{release.title}</a></h2>
              <p>{release.summary}</p>
              <ul className={styles.highlights}>{release.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
              {release.landingPage ? <Link className={styles.releaseLink} href={release.landingPage.href}>{release.landingPage.label}<ArrowRight size={17} aria-hidden="true" /></Link> : null}
            </div>
            {release.image ? <div className={styles.image}><Image {...release.image} priority={index === 0} sizes="(max-width: 760px) calc(100vw - 40px), (max-width: 1100px) 70vw, 800px" /></div> : null}
          </article>
        </li>)}
      </ol>
      <div className={styles.closing}><p>Your next packaging idea starts here.</p><Link href="/studio">Open Studio <ArrowRight size={17} aria-hidden="true" /></Link></div>
    </main>
    <SiteFooter />
  </>;
}
