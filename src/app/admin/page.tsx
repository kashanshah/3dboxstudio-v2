import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin-login-form';
import { AdminShell } from '@/components/admin-shell';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getContactSubmissionStats } from '@/server/contact-submissions';
import { isAdminAuthenticated } from '@/server/admin/auth';

type Props={searchParams:Promise<{login?:string}>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{const p=await searchParams;return {title:p.login==='true'?'Admin sign in':'Admin dashboard'};}
export default async function AdminPage({searchParams}:Props){
  const p=await searchParams; const authed=await isAdminAuthenticated();
  if(authed){if(p.login==='true')redirect('/admin');const stats=await getContactSubmissionStats();return <AdminShell><AdminPageHeader title="Dashboard" description="V2 operational overview."/><div className="admin-stat-grid"><div className="admin-stat"><span>Contact submissions</span><strong>{stats.total}</strong></div><div className="admin-stat"><span>New</span><strong>{stats.newCount}</strong></div><div className="admin-stat"><span>Last 7 days</span><strong>{stats.last7Days}</strong></div></div></AdminShell>;}
  if(p.login!=='true')notFound();
  return <div className="admin-login"><div className="admin-login-card"><h1>Admin sign in</h1><p>Enter the ADMIN_PASSWORD to continue.</p><AdminLoginForm/></div></div>;
}
