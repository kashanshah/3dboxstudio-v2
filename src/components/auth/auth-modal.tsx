'use client';

import { useState,type FormEvent } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useAuth,type AuthUser } from './auth-provider';

export function AuthModal(){
  const auth=useAuth();
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [submitting,setSubmitting]=useState(false);

  if(!auth.modalOpen) return null;
  const signup=auth.mode==='signup';

  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try{
      const response=await fetch(signup?'/api/auth/signup':'/api/auth/login',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(signup?{name,email,password}:{email,password}),
      });
      const data=await response.json() as {user?:AuthUser;error?:string};
      if(!response.ok||!data.user){
        setError(data.error||'Could not continue. Please try again.');
        return;
      }
      auth.setUser(data.user);
      auth.closeAuth();
      setPassword('');
    }catch{
      setError('Could not connect. Please try again.');
    }finally{
      setSubmitting(false);
    }
  };

  return <div className="auth-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget) auth.closeAuth();}}>
    <section className="auth-modal" role="dialog" aria-modal="true" aria-label={signup?'Create account':'Sign in'}>
      <button className="auth-modal-close" type="button" aria-label="Close" onClick={auth.closeAuth}><X size={19}/></button>
      <div className="auth-modal-copy">
        <span>3D Box Studio</span>
        <h2>{signup?'Create your workspace':'Welcome back'}</h2>
        <p>{signup?'Save projects, artwork, and continue from any device.':'Sign in to access your saved workspace.'}</p>
      </div>

      <Link className="auth-google-button" href="/api/auth/google"><span className="auth-google-g">G</span> Continue with Google</Link>
      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={submit}>
        {signup&&<label><span>Name</span><input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name"/></label>}
        <label><span>Email</span><input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
        <label><span>Password</span><input type="password" autoComplete={signup?'new-password':'current-password'} required minLength={signup?8:undefined} value={password} onChange={e=>setPassword(e.target.value)} placeholder={signup?'At least 8 characters':'Your password'}/></label>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={submitting}>{submitting?'Please wait…':signup?'Create account':'Sign in'}</button>
      </form>

      <p className="auth-switch">
        {signup?'Already have an account?':'New to 3D Box Studio?'}
        <button type="button" onClick={()=>auth.openAuth(signup?'signin':'signup')}>{signup?'Sign in':'Create account'}</button>
      </p>
      {!signup&&<p className="auth-legacy-note">Existing 3D Box Studio users can use the same email and password after migration.</p>}
    </section>
  </div>;
}
