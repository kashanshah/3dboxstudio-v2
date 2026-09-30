import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Brand } from '@/components/site-shell';

export const metadata:Metadata={
  title:{absolute:'Scene Studio — Coming Soon | 3D Box Studio'},
  description:'Scene Studio is coming after the V2 Box Studio launch.',
  robots:{index:false,follow:false},
};

export default function SceneStudioPage(){
  return <main className="scene-coming-page">
    <header className="scene-coming-header"><Brand/><Link href="/studio"><ArrowLeft size={17}/> Back to Studio</Link></header>
    <section className="scene-coming-content">
      <span className="scene-coming-icon"><Sparkles size={30}/></span>
      <p className="scene-coming-eyebrow">Coming soon</p>
      <h1>Scene Studio is next.</h1>
      <p>V2 is launching first with the complete Box Studio workflow. Product photography scenes, multi-box compositions, backgrounds, lighting, shadows and camera controls will follow in a later release.</p>
      <Link className="button" href="/studio">Continue to Box Studio</Link>
    </section>
  </main>;
}
