'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown,LogOut,UserRound } from 'lucide-react';
import { useAuth } from './auth-provider';

export function AccountButton({compact=false,className='button button-secondary marketing-header-cta'}:{compact?:boolean;className?:string}){
  const auth=useAuth();
  const [open,setOpen]=useState(false);
  const menuRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(!open)return;
    const closeOutside=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setOpen(false);};
    const closeEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('keydown',closeEscape);
    return ()=>{document.removeEventListener('pointerdown',closeOutside);document.removeEventListener('keydown',closeEscape);};
  },[open]);

  const buttonClassName=`${className} account-button${compact?' is-compact':''}`;

  if(auth.loading) return <button type="button" disabled className={`${buttonClassName} is-loading`} aria-hidden="true"/>;
  if(!auth.user) return <button type="button" className={buttonClassName} onClick={()=>auth.openAuth('signin')} aria-label="Sign in"><UserRound size={16}/><span>Sign in</span></button>;

  const label=auth.user.name?.trim()||auth.user.email;
  return <div className="account-menu" ref={menuRef}>
    <button type="button" className={buttonClassName} aria-label={`Account: ${label}`} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <UserRound size={15}/><span>{label}</span><ChevronDown size={13}/>
    </button>
    {open&&<div className="account-popover">
      <div><strong>{auth.user.name||'3D Box Studio user'}</strong><span>{auth.user.email}</span></div>
      <Link href="/accounts" onClick={()=>setOpen(false)}><UserRound size={15}/> Account settings</Link>
      <Link href="/studio" onClick={()=>setOpen(false)}>Your designs</Link>
      <button type="button" onClick={async()=>{setOpen(false);await auth.signOut();}}><LogOut size={15}/> Sign out</button>
    </div>}
  </div>;
}
