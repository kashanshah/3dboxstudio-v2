'use client';
import Link from 'next/link';
import { useEffect,useRef,useState } from 'react';
import { Box,FilePlus2,Search,Clock3,Star,UserRound,PackageOpen,Folder,Plus,Layers3,Sparkles,Clapperboard,MoreHorizontal,Trash2,Move,ExternalLink,X } from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { GoogleSignInButton } from './google-sign-in-button';
import { AccountButton } from './account-button';
import type { AuthUser } from './auth-provider';
import type { WorkspaceDesign } from '@/server/projects';
import type { WorkspaceProject } from '@/server/workspace-projects';
import { PACKAGING_TEMPLATES } from '@/lib/packaging/template-registry';
import { TemplateVisual } from '@/components/studio/template-visual';
import './studio-home.css';
import './auth-pages.css';

export function StudioGate({next='/studio'}:{next?:string}){
  return <main className="studio-auth-gate"><header className="studio-gate-header"><Brand/><GoogleSignInButton next={next}/></header><div className="studio-gate-body"><section className="studio-gate-content"><div className="studio-gate-preview" aria-hidden="true"><div className="studio-gate-cube">YOUR<br/>NEXT<br/>IDEA</div></div><h1>Your packaging workspace</h1><p>Sign in to create designs, save your artwork, and review your packaging in 3D.</p><div className="studio-gate-actions"><Link className="button button-primary" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link><GoogleSignInButton next={next}/></div><p>Already have an account? <Link className="auth-inline-link" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></p></section></div></main>;
}

export function StudioHome({
  user,designs,total,projects,activeProjectId,search,sort,page,
}:{
  user:AuthUser;
  designs:WorkspaceDesign[];
  total:number;
  projects:WorkspaceProject[];
  activeProjectId:string|null;
  search:string;
  sort:string;
  page:number;
}){
 const firstName=user.name?.split(' ')[0]||'there';
 const [creatingProject,setCreatingProject]=useState(false);
 const [projectName,setProjectName]=useState('');
 const [projectError,setProjectError]=useState('');
 const [projectBusy,setProjectBusy]=useState(false);
 const [favoriteOverrides,setFavoriteOverrides]=useState<Record<string,boolean>>({});
 const [deletedDesignIds,setDeletedDesignIds]=useState<Set<string>>(()=>new Set());
 const [openMenuId,setOpenMenuId]=useState<string|null>(null);
 const [moveDesign,setMoveDesign]=useState<WorkspaceDesign|null>(null);
 const [deleteDesign,setDeleteDesign]=useState<WorkspaceDesign|null>(null);
 const [actionBusy,setActionBusy]=useState(false);
 const [actionMessage,setActionMessage]=useState('');
 const menuRef=useRef<HTMLDivElement>(null);
 const activeProject=projects.find(project=>project.id===activeProjectId)??null;
 const scope=activeProjectId?`&workspace=${encodeURIComponent(activeProjectId)}`:'';
 const pageLink=(target:number)=>`/studio?q=${encodeURIComponent(search)}&sort=${sort}&page=${target}${scope}`;
 const createDesignHref=activeProjectId?`/studio/editor?workspace=${encodeURIComponent(activeProjectId)}`:'/studio/editor';
 const libraryDesigns=designs
   .filter(design=>!deletedDesignIds.has(design.id))
   .map(design=>Object.prototype.hasOwnProperty.call(favoriteOverrides,design.id)?{...design,favorite:favoriteOverrides[design.id]}:design);
 const recentDesigns=!search&&sort==='recent'&&page===1?libraryDesigns.slice(0,4):[];
 const favoriteDesigns=!search&&page===1?libraryDesigns.filter(design=>design.favorite).slice(0,4):[];
 useEffect(()=>{
   if(!openMenuId)return;
   const close=(event:PointerEvent)=>{if(!menuRef.current?.contains(event.target as Node))setOpenMenuId(null);};
   const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpenMenuId(null);};
   document.addEventListener('pointerdown',close);
   document.addEventListener('keydown',escape);
   return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
 },[openMenuId]);
 useEffect(()=>{
   if(!actionMessage)return;
   const timeout=window.setTimeout(()=>setActionMessage(''),2800);
   return()=>window.clearTimeout(timeout);
 },[actionMessage]);

 const toggleDesignFavorite=async(design:WorkspaceDesign)=>{
   if(design.legacy){setActionMessage('Save this legacy design in V2 before adding it to favorites.');return;}
   const next=!design.favorite;
   setActionBusy(true);setOpenMenuId(null);
   try{
     const response=await fetch(`/api/projects/${encodeURIComponent(design.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorite:next})});
     const result=await response.json().catch(()=>({error:'Could not update favorite.'}));
     if(!response.ok)throw new Error(result.error||'Could not update favorite.');
     setFavoriteOverrides(current=>({...current,[design.id]:next}));
     setActionMessage(next?'Added to favorites':'Removed from favorites');
   }catch(error){setActionMessage(error instanceof Error?error.message:'Could not update favorite.');}
   finally{setActionBusy(false);}
 };

 const moveDesignToProject=async(destinationId:string)=>{
   if(!moveDesign||moveDesign.legacy||actionBusy)return;
   setActionBusy(true);
   try{
     const response=await fetch(`/api/projects/${encodeURIComponent(moveDesign.id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({workspaceProjectId:destinationId})});
     const result=await response.json().catch(()=>({error:'Could not move this design.'}));
     if(!response.ok)throw new Error(result.error||'Could not move this design.');
     setMoveDesign(null);
     setActionMessage('Design moved');
     if(activeProjectId)window.location.reload();
   }catch(error){setActionMessage(error instanceof Error?error.message:'Could not move this design.');}
   finally{setActionBusy(false);}
 };

 const confirmDeleteDesign=async()=>{
   if(!deleteDesign||deleteDesign.legacy||actionBusy)return;
   setActionBusy(true);
   try{
     const response=await fetch(`/api/projects/${encodeURIComponent(deleteDesign.id)}`,{method:'DELETE'});
     const result=await response.json().catch(()=>({error:'Could not delete this design.'}));
     if(!response.ok)throw new Error(result.error||'Could not delete this design.');
     setDeletedDesignIds(current=>new Set([...current,deleteDesign.id]));
     setDeleteDesign(null);
     setActionMessage('Design deleted');
   }catch(error){setActionMessage(error instanceof Error?error.message:'Could not delete this design.');}
   finally{setActionBusy(false);}
 };

 const createProject=async()=>{
   const name=projectName.trim();
   if(!name){setProjectError('Enter a project name.');return;}
   setProjectBusy(true);setProjectError('');
   try{
     const response=await fetch('/api/workspace-projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
     const result=await response.json().catch(()=>({error:'Could not create project.'}));
     if(!response.ok)throw new Error(result.error||'Could not create project.');
     window.location.assign(`/studio?workspace=${encodeURIComponent(result.project.id)}`);
   }catch(error){setProjectError(error instanceof Error?error.message:'Could not create project.');setProjectBusy(false);}
 };

 return <main className="studio-home">
  <header className="studio-home-header"><Brand/><nav aria-label="Workspace navigation"><Link className="studio-home-nav-link is-current" href="/studio" aria-current="page">Studio</Link><Link className="studio-home-nav-link" href="/accounts"><UserRound size={16}/> Account</Link></nav><div className="studio-home-header-actions"><AccountButton className="button button-secondary button-small"/></div></header>
  <div className="studio-home-main">
   <section className="studio-home-welcome">
     <div>
       <p className="studio-home-eyebrow">Your workspace</p>
       <h1>Good to see you, {firstName}.</h1>
       <span>What would you like to create today?</span>
     </div>
     <div className="studio-home-welcome-actions">
       <Link className="studio-create-action is-primary" href={createDesignHref}>
         <span className="studio-create-action-icon"><FilePlus2 size={22}/></span>
         <span><strong>New box design</strong><small>Choose a box, add artwork, preview it in 3D.</small></span>
       </Link>
       <div className="studio-create-action is-coming-soon" aria-disabled="true">
         <span className="studio-create-action-icon"><Clapperboard size={22}/></span>
         <span><strong>Scene <em>Coming soon</em></strong><small>Product photography, lighting, backgrounds and multi-box compositions are planned after V2 launch.</small></span>
       </div>
       <button className="studio-create-project-link" type="button" onClick={()=>setCreatingProject(value=>!value)}><Plus size={17}/> New project</button>
     </div>
   </section>
   {!user.emailVerified&&<aside className="studio-demo-note"><MailNotice/></aside>}

   {creatingProject&&<section className="studio-project-create" aria-label="Create project">
     <div><h2>New project</h2><p>Keep related designs and scenes together under one umbrella.</p></div>
     <div className="studio-project-create-controls"><input value={projectName} maxLength={120} autoFocus placeholder="Project name" onChange={event=>{setProjectName(event.target.value);setProjectError('');}} onKeyDown={event=>{if(event.key==='Enter')void createProject();}}/><button className="button button-primary button-small" type="button" disabled={projectBusy} onClick={()=>void createProject()}>{projectBusy?'Creating…':'Create'}</button><button className="button button-secondary button-small" type="button" onClick={()=>{setCreatingProject(false);setProjectError('');}}>Cancel</button></div>
     {projectError&&<span className="studio-project-create-error">{projectError}</span>}
   </section>}

   {recentDesigns.length>0&&<section className="studio-recent" aria-labelledby="recent-work-heading">
    <div className="studio-section-heading">
      <div><p>Pick up where you left off</p><h2 id="recent-work-heading">Recent work</h2></div>
      <span>{activeProject?activeProject.name:'Across your projects'}</span>
    </div>
    <div className="studio-recent-grid">
      {recentDesigns.map(design=><Link className="studio-recent-card" href={design.href??'/studio'} key={design.id} target="_blank" rel="noopener noreferrer">
        <div className="studio-recent-thumb">
          {design.preview?<img src={design.preview} alt="" loading="lazy"/>:<Box size={54} strokeWidth={1}/>}
          {design.favorite&&<span className="studio-recent-favorite" aria-label="Favourite"><Star size={14} fill="currentColor"/></span>}
        </div>
        <div className="studio-recent-copy">
          <span><Sparkles size={14}/> {design.legacy?'Legacy design':'Box design'}</span>
          <strong>{design.name}</strong>
          <small><Clock3 size={13}/> Edited {new Date(design.updatedAt).toLocaleDateString()}</small>
        </div>
      </Link>)}
    </div>
   </section>}

   <section className="studio-project-library" aria-labelledby="project-library-heading">
    <div className="studio-section-heading studio-project-heading">
      <div><p>Keep related work together</p><h2 id="project-library-heading">Projects</h2></div>
      <div className="studio-project-view-actions">
        <Link className={`studio-all-work-link${!activeProjectId?' is-active':''}`} href="/studio"><Layers3 size={16}/> All work</Link>
        <span>{projects.length} project{projects.length===1?'':'s'}</span>
      </div>
    </div>
    <div className="studio-project-grid">
      {projects.map(project=><Link className={`studio-project-card studio-project-folder${activeProjectId===project.id?' is-active':''}`} href={`/studio?workspace=${encodeURIComponent(project.id)}`} key={project.id}>
        <div className="studio-project-card-icon"><Folder size={22}/></div>
        <div className="studio-project-card-copy"><div><strong>{project.name}</strong>{project.isDefault&&<em>Default</em>}</div><span>{project.designCount} design{project.designCount===1?'':'s'} · {project.sceneCount} scene{project.sceneCount===1?'':'s'}</span><small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small></div>
      </Link>)}
    </div>
   </section>

   {favoriteDesigns.length>0&&<section className="studio-favorites" aria-labelledby="favorite-designs-heading">
    <div className="studio-section-heading">
      <div><p>Your shortcuts</p><h2 id="favorite-designs-heading"><Star size={22} fill="currentColor"/> Favorites</h2></div>
      <span>{favoriteDesigns.length} favorite{favoriteDesigns.length===1?'':'s'}</span>
    </div>
    <div className="studio-favorite-grid">
      {favoriteDesigns.map(design=><Link className="studio-favorite-card" href={design.href??'/studio'} key={design.id} target="_blank" rel="noopener noreferrer">
        <span className="studio-favorite-thumb">{design.preview?<img src={design.preview} alt="" loading="lazy"/>:<Box size={30} strokeWidth={1.2}/>}</span>
        <span className="studio-favorite-copy"><strong>{design.name}</strong><small><Clock3 size={12}/> Edited {new Date(design.updatedAt).toLocaleDateString()}</small></span>
        <Star size={18} fill="currentColor"/>
      </Link>)}
    </div>
   </section>}

   <section className="studio-library" aria-labelledby="design-library-heading">
    <div className="studio-section-heading"><div><p>{activeProject?'Inside this project':'Your box designs'}</p><h2 id="design-library-heading">{activeProject?activeProject.name:'All designs'}</h2></div><div className="studio-section-heading-actions">{activeProject&&<span className="studio-coming-soon-pill">Scene · Coming soon</span>}<span>{total} designs</span></div></div>
    <form className="studio-library-controls" action="/studio">
      {activeProjectId&&<input type="hidden" name="workspace" value={activeProjectId}/>}
      <label className="studio-search"><Search/><span className="sr-only">Search designs</span><input name="q" defaultValue={search} placeholder="Search your designs" maxLength={80}/></label>
      <div className="studio-sort"><label htmlFor="design-sort">Sort</label><select id="design-sort" name="sort" defaultValue={sort}><option value="recent">Last edited</option><option value="name">Name</option></select></div>
      <button className="button button-secondary button-small">Search</button>
    </form>
    {libraryDesigns.length?<div className="studio-design-grid">{libraryDesigns.map(design=><article className={`studio-design-card${design.favorite?' is-favorite':''}`} key={design.id}>
      <div className="studio-design-thumb tone-sage">
        {design.href?<Link className="studio-design-thumb-link" href={design.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${design.name} in a new tab`}>{design.preview?<img src={design.preview} alt={`${design.name} preview`} loading="lazy"/>:<Box size={64} strokeWidth={1}/>}</Link>:design.preview?<img src={design.preview} alt={`${design.name} preview`} loading="lazy"/>:<Box size={64} strokeWidth={1}/>}
        <span className="studio-design-type">{design.legacy?'Legacy design':'Box design'}</span>
        {!design.legacy&&<button type="button" className={`studio-card-star${design.favorite?' is-active':''}`} aria-label={design.favorite?'Remove from favorites':'Add to favorites'} title={design.favorite?'Remove from favorites':'Add to favorites'} disabled={actionBusy} onClick={()=>void toggleDesignFavorite(design)}><Star size={18} fill={design.favorite?'currentColor':'none'}/></button>}
        <div className="studio-card-menu-wrap" ref={openMenuId===design.id?menuRef:undefined}>
          <button type="button" className="studio-card-menu-trigger" aria-label={`More actions for ${design.name}`} aria-expanded={openMenuId===design.id} onClick={()=>setOpenMenuId(current=>current===design.id?null:design.id)}><MoreHorizontal size={20}/></button>
          {openMenuId===design.id&&<div className="studio-card-menu" role="menu">
            {design.href&&<Link role="menuitem" href={design.href} target="_blank" rel="noopener noreferrer" onClick={()=>setOpenMenuId(null)}><ExternalLink size={16}/><span><strong>Open in new tab</strong><small>{design.legacy?'Open and convert in V2':'Continue editing'}</small></span></Link>}
            {!design.legacy&&<>
              <button type="button" role="menuitem" disabled={actionBusy} onClick={()=>void toggleDesignFavorite(design)}><Star size={16} fill={design.favorite?'currentColor':'none'}/><span><strong>{design.favorite?'Remove from favorites':'Add to favorites'}</strong><small>Keep important designs handy</small></span></button>
              <button type="button" role="menuitem" disabled={actionBusy||projects.length<2} onClick={()=>{setOpenMenuId(null);setMoveDesign(design);}}><Move size={16}/><span><strong>Move to project…</strong><small>{projects.length<2?'Create another project first':'Organize this design'}</small></span></button>
              <span className="studio-card-menu-separator" aria-hidden="true"/>
              <button type="button" role="menuitem" className="is-danger" disabled={actionBusy} onClick={()=>{setOpenMenuId(null);setDeleteDesign(design);}}><Trash2 size={16}/><span><strong>Delete</strong><small>Permanently delete this design</small></span></button>
            </>}
            {design.legacy&&<div className="studio-card-menu-note">Save this legacy design in V2 to favorite, move or delete it here.</div>}
          </div>}
        </div>
      </div>
      <div className="studio-design-meta">
        <div className="studio-design-info">
          <div className="studio-design-title-row"><h3>{design.href?<Link href={design.href} target="_blank" rel="noopener noreferrer">{design.name}</Link>:design.name}</h3>{design.favorite&&<span className="studio-favorite-label"><Star size={12} fill="currentColor"/> Favorite</span>}</div>
          <small><Clock3/> Edited {new Date(design.updatedAt).toLocaleDateString()}</small>
        </div>
        {design.href?<Link className="studio-card-open" href={design.href} target="_blank" rel="noopener noreferrer">Open <ExternalLink size={15}/></Link>:<span className="studio-legacy-label">Preserved · conversion pending</span>}
      </div>
    </article>)}</div>:<div className="studio-library-empty"><Box/><h3>{search?'No matching designs':activeProject?'No designs in this project yet':'Your first design starts here'}</h3><p>{search?'Try a different search.':activeProject?'Create a design here and it will stay grouped with this project.':'Create a design and save it to see it in this library.'}</p><Link className="button button-primary" href={search?(activeProjectId?`/studio?workspace=${encodeURIComponent(activeProjectId)}`:'/studio'):createDesignHref}>{search?'Clear search':'Create new design'}</Link></div>}
    {total>24&&<nav className="studio-pagination" aria-label="Design pages">{page>1&&<Link href={pageLink(page-1)}>Previous</Link>}<span>Page {page} of {Math.ceil(total/24)}</span>{page*24<total&&<Link href={pageLink(page+1)}>Next</Link>}</nav>}
   </section>

   {actionMessage&&<div className="studio-library-toast" role="status" aria-live="polite">{actionMessage}</div>}

   {moveDesign&&<div className="studio-card-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!actionBusy)setMoveDesign(null);}}>
    <section className="studio-card-modal" role="dialog" aria-modal="true" aria-labelledby="move-design-title">
      <header><div><span>Organize design</span><h2 id="move-design-title">Move “{moveDesign.name}”</h2></div><button type="button" aria-label="Close" disabled={actionBusy} onClick={()=>setMoveDesign(null)}><X size={19}/></button></header>
      <p>Choose the project where this design should live.</p>
      <div className="studio-move-project-list">
        {projects.filter(project=>project.id!==moveDesign.workspaceProjectId).map(project=><button type="button" key={project.id} disabled={actionBusy} onClick={()=>void moveDesignToProject(project.id)}>
          <span className="studio-project-card-icon"><Folder size={19}/></span><span><strong>{project.name}</strong><small>{project.designCount} design{project.designCount===1?'':'s'} · {project.sceneCount} scene{project.sceneCount===1?'':'s'}</small></span><Move size={16}/>
        </button>)}
      </div>
      <footer><button type="button" className="button button-secondary button-small" disabled={actionBusy} onClick={()=>setMoveDesign(null)}>Cancel</button></footer>
    </section>
   </div>}

   {deleteDesign&&<div className="studio-card-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!actionBusy)setDeleteDesign(null);}}>
    <section className="studio-card-modal studio-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-design-title">
      <header><div><span>Delete design</span><h2 id="delete-design-title">Delete “{deleteDesign.name}”?</h2></div><button type="button" aria-label="Close" disabled={actionBusy} onClick={()=>setDeleteDesign(null)}><X size={19}/></button></header>
      <p>This permanently removes the saved V2 design. This action cannot be undone.</p>
      <footer><button type="button" className="button button-secondary button-small" disabled={actionBusy} onClick={()=>setDeleteDesign(null)}>Cancel</button><button type="button" className="studio-danger-button" disabled={actionBusy} onClick={()=>void confirmDeleteDesign()}>{actionBusy?'Deleting…':'Delete design'}</button></footer>
    </section>
   </div>}

   <section className="studio-templates" aria-labelledby="template-heading"><div className="studio-section-heading"><div><p>Start from structure</p><h2 id="template-heading">Packaging templates</h2></div></div><div className="studio-template-grid">{PACKAGING_TEMPLATES.map(template=><article className="studio-template-card" key={template.id}><div className="studio-template-art"><TemplateVisual template={template}/></div><div className="studio-template-card-copy"><div><h3>{template.shortName}</h3><p>{template.category}</p></div>{template.status==='ready'?<Link className="button button-secondary button-small" href={`/studio/editor?template=${template.id}${activeProjectId?`&workspace=${encodeURIComponent(activeProjectId)}`:''}`}><PackageOpen size={16}/> Use template</Link>:<span className="studio-legacy-label">Coming soon</span>}</div></article>)}</div></section>
  </div>
 </main>;
}

function MailNotice(){return <div><b>Verify your email</b><span><Link href="/verify-email">Check your inbox or resend the verification email.</Link> You can continue designing while verification is pending.</span></div>;}
