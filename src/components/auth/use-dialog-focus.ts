'use client';
import { useEffect,useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent,RefObject } from 'react';

const FOCUSABLE='a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

// Modal dialog keyboard contract: focus moves in on open ([data-autofocus], else
// the first input, else the primary button), Tab is trapped, Escape closes
// unless busy, and focus returns to the trigger (or `returnTo`) on close.
export function useDialogFocus<T extends HTMLElement=HTMLElement>(open:boolean,onClose:()=>void,busy=false,returnTo?:RefObject<HTMLElement|null>){
 const ref=useRef<T>(null);
 const latest=useRef({onClose,busy,returnTo});
 useEffect(()=>{latest.current={onClose,busy,returnTo};});
 useEffect(()=>{
   if(!open)return;
   const active=document.activeElement as HTMLElement|null;
   const trigger=active&&active!==document.body&&!ref.current?.contains(active)?active:latest.current.returnTo?.current??null;
   const items=()=>Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE)??[]);
   const node=ref.current;
   (node?.querySelector<HTMLElement>('[data-autofocus]:not(:disabled)')??node?.querySelector<HTMLElement>('input:not(:disabled)')??node?.querySelector<HTMLElement>('.button-primary:not(:disabled)')??items()[0]??node)?.focus();
   const keydown=(event:KeyboardEvent)=>{
     if(event.key==='Escape'){event.preventDefault();if(!latest.current.busy)latest.current.onClose();return;}
     if(event.key!=='Tab')return;
     const list=items(),first=list[0],last=list[list.length-1];
     if(!first){event.preventDefault();return;}
     const current=document.activeElement as HTMLElement|null;
     if(!ref.current?.contains(current)||(event.shiftKey?current===first:current===last)){event.preventDefault();(event.shiftKey?last:first).focus();}
   };
   document.addEventListener('keydown',keydown);
   return()=>{
     document.removeEventListener('keydown',keydown);
     const target=trigger?.isConnected?trigger:latest.current.returnTo?.current;
     if(target?.isConnected)target.focus();
   };
 },[open]);
 return ref;
}

// Popup menu: focus the first item on open, Escape closes and refocuses the
// trigger, outside pointer closes.
export function useMenuFocus(openId:string|null,close:()=>void){
 const ref=useRef<HTMLDivElement>(null);
 const latest=useRef(close);
 useEffect(()=>{latest.current=close;});
 useEffect(()=>{
   if(!openId)return;
   const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))latest.current();};
   const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){ref.current?.querySelector<HTMLButtonElement>('.studio-card-menu-trigger')?.focus();latest.current();}};
   ref.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
   document.addEventListener('pointerdown',outside);
   document.addEventListener('keydown',escape);
   return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[openId]);
 return ref;
}

export function menuKeyDown(event:ReactKeyboardEvent<HTMLElement>){
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
 event.preventDefault();
 const items=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
 const index=items.indexOf(document.activeElement as HTMLElement);
 const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
 items[next]?.focus();
}
