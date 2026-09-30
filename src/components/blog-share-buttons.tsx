'use client';

import { useState } from 'react';
import { Check, Copy, Facebook, Linkedin, MessageCircle, Share2 } from 'lucide-react';

type BlogShareButtonsProps={
  title:string;
  url:string;
  locale?:'en'|'fr';
};

export function BlogShareButtons({title,url,locale='en'}:BlogShareButtonsProps){
  const [copied,setCopied]=useState(false);
  const encodedUrl=encodeURIComponent(url);
  const encodedTitle=encodeURIComponent(title);
  const labels=locale==='fr'
    ? {share:'Partager',copy:'Copier le lien',copied:'Lien copié',native:'Partager'}
    : {share:'Share this guide',copy:'Copy link',copied:'Copied',native:'Share'};

  const nativeShare=async()=>{
    if(typeof navigator==='undefined')return;
    if(navigator.share){
      try{await navigator.share({title,url});return;}catch(error){
        if(error instanceof DOMException&&error.name==='AbortError')return;
      }
    }
    await copyLink();
  };

  const copyLink=async()=>{
    try{
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1800);
    }catch{
      window.prompt(locale==='fr'?'Copiez ce lien':'Copy this link',url);
    }
  };

  return <div className="blog-share" aria-label={labels.share}>
    <span className="blog-share-label">{labels.share}</span>
    <div className="blog-share-actions">
      <button type="button" className="blog-share-native" onClick={()=>void nativeShare()} title={labels.native} aria-label={labels.native}><Share2 size={15}/><span>{labels.native}</span></button>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn" title="LinkedIn"><Linkedin size={15}/><span>LinkedIn</span></a>
      <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook" title="Facebook"><Facebook size={15}/><span>Facebook</span></a>
      <a href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X" title="X"><span className="blog-share-x" aria-hidden="true">𝕏</span><span>X</span></a>
      <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp" title="WhatsApp"><MessageCircle size={15}/><span>WhatsApp</span></a>
      <button type="button" onClick={()=>void copyLink()} aria-label={copied?labels.copied:labels.copy} title={copied?labels.copied:labels.copy}>{copied?<Check size={15}/>:<Copy size={15}/>}<span>{copied?labels.copied:labels.copy}</span></button>
    </div>
  </div>;
}
