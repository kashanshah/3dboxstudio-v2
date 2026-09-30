'use client';
import { useState,type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight,Eye,EyeOff,Mail } from 'lucide-react';
import { AuthShell,AuthNotice,GoogleMark } from './auth-shell';
import { useAuth } from './auth-provider';
import { safeReturnTo } from '@/lib/auth-navigation';
export type AuthPageKind='login'|'signup'|'forgot-password'|'reset-password'|'verify-email';
export function PasswordField({id,label,value,onChange,autoComplete='new-password',minLength=8}:{id:string;label:string;value:string;onChange:(value:string)=>void;autoComplete?:string;minLength?:number}){
 const [visible,setVisible]=useState(false);
 return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-password"><input id={id} required minLength={minLength} maxLength={200} type={visible?'text':'password'} autoComplete={autoComplete} value={value} onChange={event=>onChange(event.target.value)}/><button type="button" aria-label={visible?'Hide password':'Show password'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>;
}
const copy:Record<AuthPageKind,{eyebrow:string;title:string;intro:string}>={login:{eyebrow:'Welcome back',title:'Sign in to your Studio',intro:'Continue designing and reviewing your packaging.'},signup:{eyebrow:'Create your account',title:'Start with a blank canvas',intro:'Create your account and open your packaging workspace.'},'forgot-password':{eyebrow:'Account recovery',title:'Forgot your password?',intro:'Enter your email and we’ll send a password reset link.'},'reset-password':{eyebrow:'New password',title:'Create a secure password',intro:'Choose a password with at least eight characters.'},'verify-email':{eyebrow:'Verify your email',title:'Confirm it’s really you',intro:'Confirm your email using the link in your inbox.'}};
const googleErrors:Record<string,string>={google_denied:'Google sign-in was cancelled. You can try again.',google_invalid:'The sign-in request expired. Please try again.',google_failed:'Google sign-in failed. Please try again.',google_unconfigured:'Google sign-in is not configured yet.'};
export function AuthForm({kind,next,token,authError}:{kind:AuthPageKind;next?:string;token?:string;authError?:string}){
 const router=useRouter(),auth=useAuth(),returnTo=safeReturnTo(next);
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
 const [error,setError]=useState(authError?googleErrors[authError]??'Please sign in again.':''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[complete,setComplete]=useState(false);
 const login=kind==='login',signup=kind==='signup',verify=kind==='verify-email',reset=kind==='reset-password';
 async function request(endpoint:string,body:unknown){setBusy(true);setError('');try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json().catch(()=>({error:'The account service is unavailable. Please try again shortly.'}));if(!response.ok)throw new Error(result.error||'Please try again.');return result;}catch(error){setError(error instanceof Error?error.message:'Could not connect. Please try again.');return null;}finally{setBusy(false);}}
 async function submit(event:FormEvent){event.preventDefault();if((signup||reset)&&password!==confirm){setError('Passwords do not match.');return;}
 const result=await request(`/api/auth/${kind}`,login?{email,password}:signup?{name,email,password}:reset?{token,password}:verify?{token}:{email});if(!result)return;
 if(login){auth.setUser(result.user);router.replace(returnTo);router.refresh();return;}
 if(signup){auth.setUser(result.user);setMessage(result.verificationSent?'We sent a verification link to your email.':'Your account is created. Request a verification email below.');}else{setMessage(result.message);if(verify)await auth.refresh();}
 setPassword('');setConfirm('');setComplete(true);
 }
 async function resend(){const result=await request('/api/auth/resend-verification',{});if(result)setMessage(result.message);}
 return <AuthShell {...copy[kind]} footer={login?<>New to 3D Box Studio? <Link href={`/signup?next=${encodeURIComponent(returnTo)}`}>Create an account</Link></>:signup?<>Already have an account? <Link href={`/login?next=${encodeURIComponent(returnTo)}`}>Sign in</Link></>:<Link href="/login">Back to sign in</Link>}>
 {error&&<AuthNotice kind="error">{error}</AuthNotice>}
 {message&&<AuthNotice>{message}</AuthNotice>}
 {complete?<div className="auth-status-actions">{signup&&<button className="button button-secondary" onClick={resend} disabled={busy}><Mail size={16}/> Resend verification email</button>}<Link className="button button-primary" href={reset?'/login':kind==='forgot-password'?'/login':returnTo}>{reset?'Sign in with new password':kind==='forgot-password'?'Back to sign in':'Continue to Studio'} <ArrowRight size={16}/></Link></div>:verify&&!token?<div className="auth-status-actions">{auth.user?.emailVerified?<AuthNotice>Your email is already verified.</AuthNotice>:auth.user?<><p>Check the inbox for {auth.user.email}.</p><button className="button button-primary" disabled={busy} onClick={resend}>Resend verification email</button></>:<Link className="button button-primary" href="/login?next=%2Fverify-email">Sign in to resend verification</Link>}<Link className="button button-secondary" href="/studio">Continue to Studio</Link></div>:reset&&!token?<div className="auth-status-actions"><AuthNotice kind="error">This reset link is missing or invalid.</AuthNotice><Link className="button button-primary" href="/forgot-password">Request a new link</Link></div>:<form className="auth-form" onSubmit={submit}>
 {(login||signup)&&<><Link className="button button-secondary auth-google" href={`/api/auth/google?next=${encodeURIComponent(returnTo)}`}><GoogleMark/> Continue with Google</Link><div className="auth-divider">or use email</div></>}
 {signup&&<div className="auth-field"><label htmlFor="auth-name">Display name</label><input id="auth-name" autoComplete="name" required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></div>}
 {!verify&&!reset&&<div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event=>setEmail(event.target.value)}/></div>}
 {(login||signup||reset)&&<PasswordField id="auth-password" label={reset?'New password':'Password'} value={password} onChange={setPassword} autoComplete={login?'current-password':'new-password'} minLength={login?1:8}/>}
 {(signup||reset)&&<PasswordField id="auth-confirm" label="Confirm password" value={confirm} onChange={setConfirm}/>}
 {login&&<Link className="auth-inline-link" href="/forgot-password">Forgot password?</Link>}
 <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy?'Please wait…':login?'Sign in':signup?'Create account':reset?'Update password':verify?'Verify email':'Send reset link'} <ArrowRight size={16}/></button>
 {signup&&<p className="auth-legal">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>}
 </form>}
 </AuthShell>;
}
