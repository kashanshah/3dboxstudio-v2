import type { Metadata } from 'next'; import './admin.css';
import { AdminShell } from '@/components/admin-shell';
import { AdminDeletionCleanup } from '@/components/admin/admin-deletion-cleanup';
import { isAdminAuthenticated } from '@/server/admin/auth';
export const metadata:Metadata={title:'Admin',robots:{index:false,follow:false}};
// The shell lives here, above every admin page, so it stays put while pages
// change and each page's loading state shows inside it at once.
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const authed=await isAdminAuthenticated();
  return <div className="admin-root">{authed?<AdminShell><AdminDeletionCleanup/>{children}</AdminShell>:children}</div>;
}
