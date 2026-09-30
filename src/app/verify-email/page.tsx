import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
export const metadata:Metadata={title:'Verify email',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;token?:string;auth_error?:string}>}){const p=await searchParams;return <AuthForm kind="verify-email" next={p.next} token={p.token} authError={p.auth_error}/>;}
