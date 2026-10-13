import { notFound } from 'next/navigation'; import { isAdminAuthenticated } from '@/server/admin/auth';
export default async function ProtectedAdminLayout({children}:{children:React.ReactNode}){if(!(await isAdminAuthenticated()))notFound();return children;}
