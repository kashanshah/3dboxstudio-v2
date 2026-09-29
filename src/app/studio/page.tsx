import type { Metadata } from 'next';
import { StudioShell } from '@/components/studio/studio-shell';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'A production-focused packaging design workspace for structures, artwork, materials, openings, scenes and export.',
};

export default function Studio() {
  return <StudioShell />;
}
