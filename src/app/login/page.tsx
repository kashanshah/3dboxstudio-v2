import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth/auth-form';
import { getCurrentUser } from '@/server/auth/session';
import { safeReturnTo } from '@/lib/auth-navigation';
export const metadata:Metadata={title:'Sign in',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;token?:string;auth_error?:string}>}){const p=await searchParams;const user=await getCurrentUser();if(user)redirect(safeReturnTo(p.next));return <AuthForm kind="login" next={p.next} token={p.token} authError={p.auth_error}/>;}
