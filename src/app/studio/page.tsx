import type { Metadata } from 'next';
import { Brand } from '@/components/site-shell';
import { PackagingPreview } from '@/components/packaging-preview';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'V2 Studio Preview' };
export default function Studio() {
  return <><a className="skip-link" href="#main">Skip to preview</a><header className="studio-header"><Brand /><span className="development-badge">V2 · Design preview</span><Link className="text-link" href="/"><ArrowLeft size={16} /> Website</Link></header><main id="main" className="studio-foundation"><div className="studio-intro"><span className="eyebrow">A NEW SPACE TO CREATE</span><h1>Meet your future studio.</h1><p>Explore the color and perspective of this sample box. The full editor, artwork uploads, saving, sharing, and exports are coming in later milestones.</p></div><PackagingPreview large /></main></>;
}
