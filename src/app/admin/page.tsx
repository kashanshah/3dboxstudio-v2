import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminShell } from '@/components/admin-shell';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getDashboard, parseDashboardPeriod } from '@/server/admin/dashboard';
import { AdminDashboard } from '@/components/admin-dashboard';
import { isAdminAuthenticated } from '@/server/admin/auth';

type Props={searchParams:Promise<{login?:string;period?:string;includeBlank?:string}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{const p=await searchParams;return {title:p.login==='true'?'Admin sign in':'Admin dashboard'};}
export default async function AdminPage({searchParams}:Props){
  const p=await searchParams; const authed=await isAdminAuthenticated();
  if(authed){if(p.login==='true')redirect('/admin');const period=parseDashboardPeriod(p.period),includeBlank=p.includeBlank==='true';const data=await getDashboard(period,includeBlank);return <AdminShell><AdminPageHeader title="Dashboard" description="Signups, designs, artwork, storage, and migration activity."/><AdminDashboard data={data} period={period} includeBlank={includeBlank}/></AdminShell>;}
  if(p.login!=='true')notFound();
  return <div className="admin-login"><div className="admin-login-card"><h1>Admin sign in</h1><p>Enter the ADMIN_PASSWORD to continue.</p><AdminLoginForm/></div></div>;
}
