'use client';

import { useState } from 'react';
import { ChevronDown,LogOut,UserRound } from 'lucide-react';
import { useAuth } from './auth-provider';

export function AccountButton({compact=false}:{compact?:boolean}){
  const auth=useAuth();
  const [open,setOpen]=useState(false);

  if(auth.loading) return <span className={compact?'account-button is-loading is-compact':'account-button is-loading'} aria-hidden="true"/>;
  if(!auth.user) return <button type="button" className={compact?'account-button is-compact':'account-button'} onClick={()=>auth.openAuth('signin')}>Sign in</button>;

  const label=auth.user.name?.trim()||auth.user.email;
  return <div className="account-menu">
    <button type="button" className={compact?'account-button is-compact':'account-button'} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <UserRound size={15}/><span>{label}</span><ChevronDown size={13}/>
    </button>
    {open&&<div className="account-popover">
      <div><strong>{auth.user.name||'3D Box Studio user'}</strong><span>{auth.user.email}</span></div>
      <button type="button" onClick={async()=>{setOpen(false);await auth.signOut();}}><LogOut size={15}/> Sign out</button>
    </div>}
  </div>;
}
