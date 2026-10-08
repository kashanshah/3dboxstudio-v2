import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { VerifyEmailToken } from '@/components/auth/verify-email-token';
import { StripUrlSecrets } from '@/components/auth/strip-url-secrets';
export const metadata:Metadata={title:'Verify email',description:'Confirm the email address for your 3D Box Studio account.',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function Page({searchParams}:{searchParams:Promise<{next?:string;token?:string;auth_error?:string}>}){const p=await searchParams;return p.token?<><StripUrlSecrets/><VerifyEmailToken key={p.token} token={p.token} next={p.next}/></>:<AuthForm kind="verify-email" next={p.next} authError={p.auth_error}/>;}
