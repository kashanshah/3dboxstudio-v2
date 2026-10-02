import { AdminDeletionCleanup } from '@/components/admin/admin-deletion-cleanup';
import { notFound } from 'next/navigation'; import { AdminShell } from '@/components/admin-shell'; import { isAdminAuthenticated } from '@/server/admin/auth';
export default async function ProtectedAdminLayout({children}:{children:React.ReactNode}){if(!(await isAdminAuthenticated()))notFound();return <AdminShell><AdminDeletionCleanup />{children}</AdminShell>;}
