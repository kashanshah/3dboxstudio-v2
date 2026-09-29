import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { HomeExperience } from '@/components/home-experience';

export const metadata: Metadata = { title: '3D Box Studio — Packaging in a new dimension', description: 'Explore the next chapter of 3D Box Studio: a packaging-focused design preview with interactive artwork, finish, color, and camera controls.' };
export default function Home() {
  return <><SiteHeader /><main id="main"><HomeExperience /></main><SiteFooter /></>;
}
