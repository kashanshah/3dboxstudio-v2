'use client';
import { getPackagingTemplateCopy } from '@/lib/i18n/template-copy';
import { useTranslations } from '@/components/i18n/locale-provider';
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
  const t = useTranslations();

  return <main className="studio-auth-gate"><header className="studio-gate-header"><Brand/><GoogleSignInButton next={next}/></header><div className="studio-gate-body"><section className="studio-gate-content"><div className="studio-gate-preview" aria-hidden="true"><div className="studio-gate-cube">{t("workspace.your")}<br/>{t("workspace.next")}<br/>{t("workspace.idea")}</div></div><h1>{t("workspace.your_packaging_workspace")}</h1><p>{t("workspace.sign_in_to_create_designs_save_your_artwork_and_review_your_packaging_in_3d")}</p><div className="studio-gate-actions"><Link className="button button-primary" href={`/signup?next=${encodeURIComponent(next)}`}>{t("workspace.create_an_account")}</Link><GoogleSignInButton next={next} large/></div><p>{t("workspace.already_have_an_account") + " "}<Link className="auth-inline-link" href={`/login?next=${encodeURIComponent(next)}`}>{t("workspace.sign_in")}</Link></p></section></div></main>;
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
  const t = useTranslations();

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
  <header className="studio-home-header"><Brand/><nav aria-label={t("workspace.workspace_navigation")}><Link className="studio-home-nav-link is-current" href="/studio" aria-current="page">{t("workspace.studio")}</Link><Link className="studio-home-nav-link" href="/accounts"><UserRound size={16}/>{" " + t("workspace.account")}</Link></nav><div className="studio-home-header-actions"><AccountButton className="button button-secondary button-small"/></div></header>
  <div className="studio-home-main">
   <section className="studio-home-welcome">
     <div>
       <p className="studio-home-eyebrow">{t("workspace.your_workspace")}</p>
       <h1>{t("workspace.good_to_see_you") + " "}{firstName}.</h1>
       <span>{t("workspace.what_would_you_like_to_create_today")}</span>
     </div>
     <div className="studio-home-welcome-actions">
       <Link className="studio-create-action is-primary" href={createDesignHref}>
         <span className="studio-create-action-icon"><FilePlus2 size={22}/></span>
         <span><strong>{t("workspace.new_box_design")}</strong><small>{t("workspace.choose_a_box_add_artwork_preview_it_in_3d")}</small></span>
       </Link>
       <div className="studio-create-action is-coming-soon" aria-disabled="true">
         <span className="studio-create-action-icon"><Clapperboard size={22}/></span>
         <span><strong>{t("workspace.scene") + " "}<em>{t("workspace.coming_soon")}</em></strong><small>{t("workspace.product_photography_lighting_backgrounds_and_multi_box_compositions_are_pla")}</small></span>
       </div>
       <button className="studio-create-project-link" type="button" onClick={()=>{setProjectName('');setProjectError('');setCreatingProject(true);}}><Plus size={17}/>{" " + t("workspace.new_project")}</button>
     </div>
   </section>
   {!user.emailVerified&&<aside className="studio-demo-note"><MailNotice/></aside>}

   {creatingProject&&<div className="studio-project-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!projectBusy){setCreatingProject(false);setProjectError('');}}}>
     <section className="studio-project-modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onKeyDown={event=>{if(event.key==='Escape'&&!projectBusy){event.stopPropagation();setCreatingProject(false);setProjectError('');}}}>
       <header className="studio-project-modal-header">
         <div><h2 id="new-project-title">{t("workspace.new_project")}</h2><p>{t("workspace.keep_related_designs_and_scenes_together_under_one_umbrella")}</p></div>
         <button type="button" className="studio-project-modal-close" aria-label={t("workspace.cancel")} disabled={projectBusy} onClick={()=>{setCreatingProject(false);setProjectError('');}}><X size={18}/></button>
       </header>
       <label className="studio-project-modal-field">
         <span>{t("workspace.project_name")}</span>
         <input value={projectName} maxLength={120} autoFocus placeholder={t("workspace.project_name")} onChange={event=>{setProjectName(event.target.value);setProjectError('');}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void createProject();}}}/>
       </label>
       {projectError&&<span className="studio-project-create-error" role="alert">{projectError}</span>}
       <div className="studio-project-modal-actions">
         <button className="button button-secondary" type="button" disabled={projectBusy} onClick={()=>{setCreatingProject(false);setProjectError('');}}>{t("workspace.cancel")}</button>
         <button className="button button-primary" type="button" disabled={projectBusy||!projectName.trim()} onClick={()=>void createProject()}>{projectBusy?t("workspace.creating"):t("workspace.create")}</button>
       </div>
     </section>
   </div>}

   {recentDesigns.length>0&&<section className="studio-recent" aria-labelledby="recent-work-heading">
    <div className="studio-section-heading">
      <div><p>{t("workspace.pick_up_where_you_left_off")}</p><h2 id="recent-work-heading">{t("workspace.recent_work")}</h2></div>
      <span>{activeProject?activeProject.name:t("workspace.across_your_projects")}</span>
    </div>
    <div className="studio-recent-grid">
      {recentDesigns.map(design=><Link className="studio-recent-card" href={design.href??'/studio'} key={design.id} target="_blank" rel="noopener noreferrer">
        <div className="studio-recent-thumb">
          {design.preview?<img src={design.preview} alt="" loading="lazy"/>:<Box size={54} strokeWidth={1}/>}
          {design.favorite&&<span className="studio-recent-favorite" aria-label={t("workspace.favourite")}><Star size={14} fill="currentColor"/></span>}
        </div>
        <div className="studio-recent-copy">
          <span><Sparkles size={14}/> {design.legacy?t("workspace.legacy_design"):t("workspace.box_design")}</span>
          <strong>{design.name}</strong>
          <small><Clock3 size={13}/>{" " + t("workspace.edited") + " "}{new Date(design.updatedAt).toLocaleDateString()}</small>
        </div>
      </Link>)}
    </div>
   </section>}

   <section className="studio-project-library" aria-labelledby="project-library-heading">
    <div className="studio-section-heading studio-project-heading">
      <div><p>{t("workspace.keep_related_work_together")}</p><h2 id="project-library-heading">{t("workspace.projects")}</h2></div>
      <div className="studio-project-view-actions">
        <Link className={`studio-all-work-link${!activeProjectId?' is-active':''}`} href="/studio"><Layers3 size={16}/>{" " + t("workspace.all_work")}</Link>
        <span>{projects.length}{" " + t("workspace.project")}{projects.length===1?'':t("workspace.s")}</span>
      </div>
    </div>
    <div className="studio-project-grid">
      {projects.map(project=><Link className={`studio-project-card studio-project-folder${activeProjectId===project.id?' is-active':''}`} href={`/studio?workspace=${encodeURIComponent(project.id)}`} key={project.id}>
        <div className="studio-project-card-icon"><Folder size={22}/></div>
        <div className="studio-project-card-copy"><div><strong>{project.name}</strong>{project.isDefault&&<em>{t("workspace.default")}</em>}</div><span>{project.designCount}{" " + t("workspace.design")}{project.designCount===1?'':t("workspace.s")} · {project.sceneCount}{" " + t("workspace.scene_2")}{project.sceneCount===1?'':t("workspace.s")}</span><small>{t("workspace.updated") + " "}{new Date(project.updatedAt).toLocaleDateString()}</small></div>
      </Link>)}
    </div>
   </section>

   {favoriteDesigns.length>0&&<section className="studio-favorites" aria-labelledby="favorite-designs-heading">
    <div className="studio-section-heading">
      <div><p>{t("workspace.your_shortcuts")}</p><h2 id="favorite-designs-heading"><Star size={22} fill="currentColor"/>{" " + t("workspace.favorites")}</h2></div>
      <span>{favoriteDesigns.length}{" " + t("workspace.favorite")}{favoriteDesigns.length===1?'':t("workspace.s")}</span>
    </div>
    <div className="studio-favorite-grid">
      {favoriteDesigns.map(design=><Link className="studio-favorite-card" href={design.href??'/studio'} key={design.id} target="_blank" rel="noopener noreferrer">
        <span className="studio-favorite-thumb">{design.preview?<img src={design.preview} alt="" loading="lazy"/>:<Box size={30} strokeWidth={1.2}/>}</span>
        <span className="studio-favorite-copy"><strong>{design.name}</strong><small><Clock3 size={12}/>{" " + t("workspace.edited") + " "}{new Date(design.updatedAt).toLocaleDateString()}</small></span>
        <Star size={18} fill="currentColor"/>
      </Link>)}
    </div>
   </section>}

   <section className="studio-library" aria-labelledby="design-library-heading">
    <div className="studio-section-heading"><div><p>{activeProject?t("workspace.inside_this_project"):t("workspace.your_box_designs")}</p><h2 id="design-library-heading">{activeProject?activeProject.name:t("workspace.all_designs")}</h2></div><div className="studio-section-heading-actions">{activeProject&&<span className="studio-coming-soon-pill">{t("workspace.scene_coming_soon")}</span>}<span>{total}{" " + t("workspace.designs")}</span></div></div>
    <form className="studio-library-controls" action="/studio">
      {activeProjectId&&<input type="hidden" name="workspace" value={activeProjectId}/>}
      <label className="studio-search"><Search/><span className="sr-only">{t("workspace.search_designs")}</span><input name="q" defaultValue={search} placeholder={t("workspace.search_your_designs")} maxLength={80}/></label>
      <div className="studio-sort"><label htmlFor="design-sort">{t("workspace.sort")}</label><select id="design-sort" name="sort" defaultValue={sort}><option value="recent">{t("workspace.last_edited")}</option><option value="name">{t("workspace.name")}</option></select></div>
      <button className="button button-secondary button-small">{t("workspace.search")}</button>
    </form>
    {libraryDesigns.length?<div className="studio-design-grid">{libraryDesigns.map(design=><article className={`studio-design-card${design.favorite?' is-favorite':''}`} key={design.id}>
      <div className="studio-design-thumb tone-sage">
        {design.href?<Link className="studio-design-thumb-link" href={design.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${design.name} in a new tab`}>{design.preview?<img src={design.preview} alt={`${design.name} preview`} loading="lazy"/>:<Box size={64} strokeWidth={1}/>}</Link>:design.preview?<img src={design.preview} alt={`${design.name} preview`} loading="lazy"/>:<Box size={64} strokeWidth={1}/>}
        <span className="studio-design-type">{design.legacy?t("workspace.legacy_design"):t("workspace.box_design")}</span>
        {!design.legacy&&<button type="button" className={`studio-card-star${design.favorite?' is-active':''}`} aria-label={design.favorite?t("workspace.remove_from_favorites"):t("workspace.add_to_favorites")} title={design.favorite?t("workspace.remove_from_favorites"):t("workspace.add_to_favorites")} disabled={actionBusy} onClick={()=>void toggleDesignFavorite(design)}><Star size={18} fill={design.favorite?'currentColor':'none'}/></button>}
        <div className="studio-card-menu-wrap" ref={openMenuId===design.id?menuRef:undefined}>
          <button type="button" className="studio-card-menu-trigger" aria-label={`More actions for ${design.name}`} aria-expanded={openMenuId===design.id} onClick={()=>setOpenMenuId(current=>current===design.id?null:design.id)}><MoreHorizontal size={20}/></button>
          {openMenuId===design.id&&<div className="studio-card-menu" role="menu">
            {design.href&&<Link role="menuitem" href={design.href} target="_blank" rel="noopener noreferrer" onClick={()=>setOpenMenuId(null)}><ExternalLink size={16}/><span><strong>{t("workspace.open_in_new_tab")}</strong><small>{design.legacy?t("workspace.open_and_convert_in_v2"):t("workspace.continue_editing")}</small></span></Link>}
            {!design.legacy&&<>
              <button type="button" role="menuitem" disabled={actionBusy} onClick={()=>void toggleDesignFavorite(design)}><Star size={16} fill={design.favorite?'currentColor':'none'}/><span><strong>{design.favorite?t("workspace.remove_from_favorites"):t("workspace.add_to_favorites")}</strong><small>{t("workspace.keep_important_designs_handy")}</small></span></button>
              <button type="button" role="menuitem" disabled={actionBusy||projects.length<2} onClick={()=>{setOpenMenuId(null);setMoveDesign(design);}}><Move size={16}/><span><strong>{t("workspace.move_to_project")}</strong><small>{projects.length<2?t("workspace.create_another_project_first"):t("workspace.organize_this_design")}</small></span></button>
              <span className="studio-card-menu-separator" aria-hidden="true"/>
              <button type="button" role="menuitem" className="is-danger" disabled={actionBusy} onClick={()=>{setOpenMenuId(null);setDeleteDesign(design);}}><Trash2 size={16}/><span><strong>{t("workspace.delete")}</strong><small>{t("workspace.permanently_delete_this_design")}</small></span></button>
            </>}
            {design.legacy&&<div className="studio-card-menu-note">{t("workspace.save_this_legacy_design_in_v2_to_favorite_move_or_delete_it_here")}</div>}
          </div>}
        </div>
      </div>
      <div className="studio-design-meta">
        <div className="studio-design-info">
          <div className="studio-design-title-row"><h3>{design.href?<Link href={design.href} target="_blank" rel="noopener noreferrer">{design.name}</Link>:design.name}</h3>{design.favorite&&<span className="studio-favorite-label"><Star size={12} fill="currentColor"/>{" " + t("workspace.favorite_2")}</span>}</div>
          <small><Clock3/>{" " + t("workspace.edited") + " "}{new Date(design.updatedAt).toLocaleDateString()}</small>
        </div>
        {design.href?<Link className="studio-card-open" href={design.href} target="_blank" rel="noopener noreferrer">{t("workspace.open") + " "}<ExternalLink size={15}/></Link>:<span className="studio-legacy-label">{t("workspace.preserved_conversion_pending")}</span>}
      </div>
    </article>)}</div>:<div className="studio-library-empty"><Box/><h3>{search?t("workspace.no_matching_designs"):activeProject?t("workspace.no_designs_in_this_project_yet"):t("workspace.your_first_design_starts_here")}</h3><p>{search?t("workspace.try_a_different_search"):activeProject?t("workspace.create_a_design_here_and_it_will_stay_grouped_with_this_project"):t("workspace.create_a_design_and_save_it_to_see_it_in_this_library")}</p><Link className="button button-primary" href={search?(activeProjectId?`/studio?workspace=${encodeURIComponent(activeProjectId)}`:'/studio'):createDesignHref}>{search?t("workspace.clear_search"):t("workspace.create_new_design")}</Link></div>}
    {total>24&&<nav className="studio-pagination" aria-label={t("workspace.design_pages")}>{page>1&&<Link href={pageLink(page-1)}>{t("workspace.previous")}</Link>}<span>{t("workspace.page") + " "}{page}{" " + t("workspace.of") + " "}{Math.ceil(total/24)}</span>{page*24<total&&<Link href={pageLink(page+1)}>{t("workspace.next_2")}</Link>}</nav>}
   </section>

   {actionMessage&&<div className="studio-library-toast" role="status" aria-live="polite">{actionMessage}</div>}

   {moveDesign&&<div className="studio-card-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!actionBusy)setMoveDesign(null);}}>
    <section className="studio-card-modal" role="dialog" aria-modal="true" aria-labelledby="move-design-title">
      <header><div><span>{t("workspace.organize_design")}</span><h2 id="move-design-title">{t("workspace.move")}{moveDesign.name}”</h2></div><button type="button" aria-label={t("workspace.close")} disabled={actionBusy} onClick={()=>setMoveDesign(null)}><X size={19}/></button></header>
      <p>{t("workspace.choose_the_project_where_this_design_should_live")}</p>
      <div className="studio-move-project-list">
        {projects.filter(project=>project.id!==moveDesign.workspaceProjectId).map(project=><button type="button" key={project.id} disabled={actionBusy} onClick={()=>void moveDesignToProject(project.id)}>
          <span className="studio-project-card-icon"><Folder size={19}/></span><span><strong>{project.name}</strong><small>{project.designCount}{" " + t("workspace.design")}{project.designCount===1?'':t("workspace.s")} · {project.sceneCount}{" " + t("workspace.scene_2")}{project.sceneCount===1?'':t("workspace.s")}</small></span><Move size={16}/>
        </button>)}
      </div>
      <footer><button type="button" className="button button-secondary button-small" disabled={actionBusy} onClick={()=>setMoveDesign(null)}>{t("workspace.cancel")}</button></footer>
    </section>
   </div>}

   {deleteDesign&&<div className="studio-card-modal-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!actionBusy)setDeleteDesign(null);}}>
    <section className="studio-card-modal studio-delete-modal" role="dialog" aria-modal="true" aria-labelledby="delete-design-title">
      <header><div><span>{t("workspace.delete_design")}</span><h2 id="delete-design-title">{t("workspace.delete_2")}{deleteDesign.name}”?</h2></div><button type="button" aria-label={t("workspace.close")} disabled={actionBusy} onClick={()=>setDeleteDesign(null)}><X size={19}/></button></header>
      <p>{t("workspace.this_permanently_removes_the_saved_v2_design_this_action_cannot_be_undone")}</p>
      <footer><button type="button" className="button button-secondary button-small" disabled={actionBusy} onClick={()=>setDeleteDesign(null)}>{t("workspace.cancel")}</button><button type="button" className="studio-danger-button" disabled={actionBusy} onClick={()=>void confirmDeleteDesign()}>{actionBusy?t("workspace.deleting"):t("workspace.delete_design")}</button></footer>
    </section>
   </div>}

   <section className="studio-templates" aria-labelledby="template-heading"><div className="studio-section-heading"><div><p>{t("workspace.start_from_structure")}</p><h2 id="template-heading">{t("workspace.packaging_templates")}</h2></div></div><div className="studio-template-grid">{PACKAGING_TEMPLATES.map(template=><article className="studio-template-card" key={template.id}><div className="studio-template-art"><TemplateVisual template={template}/></div><div className="studio-template-card-copy"><div><h3>{getPackagingTemplateCopy(template, t).shortName}</h3><p>{getPackagingTemplateCopy(template, t).category}</p></div>{template.status==='ready'?<Link className="button button-secondary button-small" href={`/studio/editor?template=${template.id}${activeProjectId?`&workspace=${encodeURIComponent(activeProjectId)}`:''}`}><PackageOpen size={16}/>{" " + t("workspace.use_template")}</Link>:<span className="studio-legacy-label">{t("workspace.coming_soon")}</span>}</div></article>)}</div></section>
  </div>
 </main>;
}

function MailNotice(){
  const t = useTranslations();
return <div><b>{t("workspace.verify_your_email")}</b><span><Link href="/verify-email">{t("workspace.check_your_inbox_or_resend_the_verification_email")}</Link>{" " + t("workspace.you_can_continue_designing_while_verification_is_pending")}</span></div>;}
