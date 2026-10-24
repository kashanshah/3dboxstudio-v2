'use client';
import { useEffect, useState } from 'react';
import { BRAND_NAME_MAX, SHARE_PASSWORD_MAX, SHARE_PASSWORD_MIN } from '@/lib/share-brand';
import { canUseFeature } from '@/lib/features';
import { useAuth } from '@/components/auth/auth-provider';

type ShareSettings={brandName:string|null;logoAssetId:string|null;hasPassword:boolean};
type Asset={id:string;name:string;url:string;mimeType:string};

// Pro (the clientShares flag, or Pro access given in the admin): in the share
// dialog, the owner can put their own name and logo on the link instead of
// ours, and ask for a password.
export function ClientShareSettings({shareId}:{shareId:string}){
  const {user}=useAuth();
  return canUseFeature('clientShares',user)?<Settings shareId={shareId}/>:null;
}

function Settings({shareId}:{shareId:string}){
  const [settings,setSettings]=useState<ShareSettings|null>(null);
  const [assets,setAssets]=useState<Asset[]>([]);
  const [brandName,setBrandName]=useState('');
  const [logoAssetId,setLogoAssetId]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');

  useEffect(()=>{
    let cancelled=false;
    void Promise.all([
      fetch(`/api/shares/${encodeURIComponent(shareId)}`).then(response=>response.ok?response.json():null),
      fetch('/api/media').then(response=>response.ok?response.json():{assets:[]}),
    ]).then(([shared,media])=>{
      if(cancelled||!shared)return;
      const loaded=shared.settings as ShareSettings;
      setSettings(loaded);setBrandName(loaded.brandName??'');setLogoAssetId(loaded.logoAssetId??'');
      setAssets(((media?.assets??[]) as Asset[]).filter(asset=>asset.mimeType.startsWith('image/')));
    }).catch(()=>{if(!cancelled)setStatus('Could not load the link settings.');});
    return()=>{cancelled=true;};
  },[shareId]);

  async function save(change:{password?:string|null}={}){
    setBusy(true);setStatus('');
    try{
      const response=await fetch(`/api/shares/${encodeURIComponent(shareId)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({brandName,logoAssetId:logoAssetId||null,...change})});
      const body=await response.json().catch(()=>({})) as {settings?:ShareSettings;error?:string};
      if(!response.ok||!body.settings){setStatus(body.error??'Could not save the link settings.');return;}
      setSettings(body.settings);setPassword('');
      setStatus(change.password===null?'Password removed':change.password?'Saved. The link now asks for the password.':'Saved');
    }catch{setStatus('Could not save the link settings.');}
    finally{setBusy(false);}
  }

  if(!settings)return status?<p className="client-share-status" role="status">{status}</p>:null;
  return <form className="client-share-settings" onSubmit={event=>{event.preventDefault();void save(password?{password}:{});}}>
    <h3>For your client <small>Pro</small></h3>
    <label><span>Your business name</span><input value={brandName} maxLength={BRAND_NAME_MAX} onChange={event=>setBrandName(event.target.value)} placeholder="Shown instead of 3D Box Studio"/></label>
    <fieldset>
      <legend>Your logo</legend>
      <div className="client-share-logos">
        <label className={!logoAssetId?'is-checked':undefined}><input type="radio" name="logo" checked={!logoAssetId} onChange={()=>setLogoAssetId('')}/><span>None</span></label>
        {assets.map(asset=><label key={asset.id} className={logoAssetId===asset.id?'is-checked':undefined} title={asset.name}>
          <input type="radio" name="logo" checked={logoAssetId===asset.id} onChange={()=>setLogoAssetId(asset.id)}/>
          {/* eslint-disable-next-line @next/next/no-img-element -- a thumbnail of the owner's own upload */}
          <img src={asset.url} alt={asset.name}/>
        </label>)}
      </div>
      {!assets.length&&<small>Upload your logo to the Studio image library to use it here.</small>}
    </fieldset>
    <label><span>{settings.hasPassword?'New password':'Password'} <small>(optional)</small></span>
      <input type="password" autoComplete="new-password" value={password} minLength={SHARE_PASSWORD_MIN} maxLength={SHARE_PASSWORD_MAX} onChange={event=>setPassword(event.target.value)} placeholder={settings.hasPassword?'Leave empty to keep the current one':'Anyone with the link can view'}/></label>
    {status&&<p className="client-share-status" role="status">{status}</p>}
    <div className="client-share-actions">
      {settings.hasPassword&&<button type="button" className="pro-secondary-button" disabled={busy} onClick={()=>void save({password:null})}>Remove password</button>}
      <button type="submit" className="pro-secondary-button" disabled={busy}>{busy?'Saving…':'Save'}</button>
    </div>
  </form>;
}
