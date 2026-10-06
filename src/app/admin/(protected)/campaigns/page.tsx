import type { Metadata } from 'next';
import { AdminCampaigns } from '@/components/admin/admin-campaigns';
import './campaigns.css';
export const metadata: Metadata = {title:'Admin — Email campaigns'};
export default function CampaignsPage() { return <AdminCampaigns/>; }
