import type { Metadata } from 'next';
import { OriginalHome } from '@/components/original-home';
import './lovable-original.css';
export const metadata: Metadata = { title: '3D Box Studio — Packaging ideas, made tangible', description: 'The original Lovable design direction for 3D Box Studio V2. A visual prototype of the planned packaging workflow.' };
export default function Home() {return <OriginalHome/>;}
