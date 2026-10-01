'use client';
import type { MessageKey } from '@/lib/i18n';
import { useTranslations } from '@/components/i18n/locale-provider';
import { useState,type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight,Eye,EyeOff,Mail } from 'lucide-react';
import { AuthShell,AuthNotice } from './auth-shell';
import { GoogleSignInButton } from './google-sign-in-button';
import { useAuth } from './auth-provider';
import { safeReturnTo } from '@/lib/auth-navigation';
export type AuthPageKind='login'|'signup'|'forgot-password'|'reset-password'|'verify-email';
export function PasswordField({id,label,value,onChange,autoComplete='new-password',minLength=8}:{id:string;label:string;value:string;onChange:(value:string)=>void;autoComplete?:string;minLength?:number}){
 const t = useTranslations();
 const [visible,setVisible]=useState(false);
 return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-password"><input id={id} required minLength={minLength} maxLength={200} type={visible?'text':'password'} autoComplete={autoComplete} value={value} onChange={event=>onChange(event.target.value)}/><button type="button" aria-label={visible?t("auth.hide_password"):t("auth.show_password")} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>;
}
const copy:Record<AuthPageKind,{eyebrow:MessageKey;title:MessageKey;intro:MessageKey}>={login:{eyebrow:"auth.welcome_back",title:"auth.sign_in_to_your_studio",intro:"auth.continue_designing_and_reviewing_your_packaging"},signup:{eyebrow:"auth.create_your_account",title:"auth.start_with_a_blank_canvas",intro:"auth.create_your_account_and_open_your_packaging_workspace"},'forgot-password':{eyebrow:"auth.account_recovery",title:"auth.forgot_your_password",intro:"auth.enter_your_email_and_we_ll_send_a_password_reset_link"},'reset-password':{eyebrow:"auth.new_password",title:"auth.create_a_secure_password",intro:"auth.choose_a_password_with_at_least_eight_characters"},'verify-email':{eyebrow:"auth.verify_your_email",title:"auth.confirm_it_s_really_you",intro:"auth.confirm_your_email_using_the_link_in_your_inbox"}};
const googleErrors:Record<string,string>={google_denied:'Google sign-in was cancelled. You can try again.',google_invalid:'The sign-in request expired. Please try again.',google_failed:'Google sign-in failed. Please try again.',google_unconfigured:'Google sign-in is not configured yet.'};
export function AuthForm({kind,next,token,authError}:{kind:AuthPageKind;next?:string;token?:string;authError?:string}){
  const t = useTranslations();

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
 return <AuthShell eyebrow={t(copy[kind].eyebrow)} title={t(copy[kind].title)} intro={t(copy[kind].intro)} footer={login?<>{t("auth.new_to_3d_box_studio") + " "}<Link href={`/signup?next=${encodeURIComponent(returnTo)}`}>{t("auth.create_an_account")}</Link></>:signup?<>{t("auth.already_have_an_account") + " "}<Link href={`/login?next=${encodeURIComponent(returnTo)}`}>{t("auth.sign_in")}</Link></>:<Link href="/login">{t("auth.back_to_sign_in")}</Link>}>
 {error&&<AuthNotice kind="error">{error}</AuthNotice>}
 {message&&<AuthNotice>{message}</AuthNotice>}
 {complete?<div className="auth-status-actions">{signup&&<button className="button button-secondary" onClick={resend} disabled={busy}><Mail size={16}/>{" " + t("auth.resend_verification_email")}</button>}<Link className="button button-primary" href={reset?'/login':kind==='forgot-password'?'/login':returnTo}>{reset?t("auth.sign_in_with_new_password"):kind==='forgot-password'?t("auth.back_to_sign_in"):t("auth.continue_to_studio")} <ArrowRight size={16}/></Link></div>:verify&&!token?<div className="auth-status-actions">{auth.user?.emailVerified?<AuthNotice>{t("auth.your_email_is_already_verified")}</AuthNotice>:auth.user?<><p>{t("auth.check_the_inbox_for") + " "}{auth.user.email}.</p><button className="button button-primary" disabled={busy} onClick={resend}>{t("auth.resend_verification_email")}</button></>:<Link className="button button-primary" href="/login?next=%2Fverify-email">{t("auth.sign_in_to_resend_verification")}</Link>}<Link className="button button-secondary" href="/studio">{t("auth.continue_to_studio")}</Link></div>:reset&&!token?<div className="auth-status-actions"><AuthNotice kind="error">{t("auth.this_reset_link_is_missing_or_invalid")}</AuthNotice><Link className="button button-primary" href="/forgot-password">{t("auth.request_a_new_link")}</Link></div>:<form className="auth-form" onSubmit={submit}>
 {(login||signup)&&<><GoogleSignInButton next={returnTo} large/><div className="auth-divider">{t("auth.or_use_email")}</div></>}
 {signup&&<div className="auth-field"><label htmlFor="auth-name">{t("auth.display_name")}</label><input id="auth-name" autoComplete="name" required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></div>}
 {!verify&&!reset&&<div className="auth-field"><label htmlFor="auth-email">{t("auth.email")}</label><input id="auth-email" type="email" autoComplete="email" required maxLength={320} value={email} onChange={event=>setEmail(event.target.value)}/></div>}
 {(login||signup||reset)&&<PasswordField id="auth-password" label={reset?t("auth.new_password"):t("auth.password")} value={password} onChange={setPassword} autoComplete={login?'current-password':'new-password'} minLength={login?1:8}/>}
 {(signup||reset)&&<PasswordField id="auth-confirm" label={t("auth.confirm_password")} value={confirm} onChange={setConfirm}/>}
 {login&&<Link className="auth-inline-link" href="/forgot-password">{t("auth.forgot_password")}</Link>}
 <button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy?t("auth.please_wait"):login?t("auth.sign_in"):signup?t("auth.create_account"):reset?t("auth.update_password"):verify?t("auth.verify_email"):t("auth.send_reset_link")} <ArrowRight size={16}/></button>
 {signup&&<p className="auth-legal">{t("auth.by_continuing_you_agree_to_our") + " "}<Link href="/terms">{t("auth.terms")}</Link>{" " + t("auth.and") + " "}<Link href="/privacy">{t("auth.privacy_policy")}</Link>.</p>}
 </form>}
 </AuthShell>;
}
