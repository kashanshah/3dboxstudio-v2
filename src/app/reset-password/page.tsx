import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { StripUrlSecrets } from '@/components/auth/strip-url-secrets';
export const metadata:Metadata={title:'Reset password',description:'Choose a new password for your 3D Box Studio account.',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;token?:string;auth_error?:string}>}){const p=await searchParams;return <><StripUrlSecrets/><AuthForm kind="reset-password" next={p.next} token={p.token} authError={p.auth_error}/></>;}
