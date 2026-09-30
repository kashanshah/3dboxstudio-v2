'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Box,FilePlus2,Search,Clock3,Star,UserRound,PackageOpen,Folder,Plus,Layers3 } from 'lucide-react';
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
 const activeProject=projects.find(project=>project.id===activeProjectId)??null;
 const scope=activeProjectId?`&workspace=${encodeURIComponent(activeProjectId)}`:'';
 const pageLink=(target:number)=>`/studio?q=${encodeURIComponent(search)}&sort=${sort}&page=${target}${scope}`;
 const createDesignHref=activeProjectId?`/studio/editor?workspace=${encodeURIComponent(activeProjectId)}`:'/studio/editor';

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
   <section className="studio-home-welcome"><div><p className="studio-home-eyebrow">Your workspace</p><h1>Good to see you, {firstName}.</h1><span>Organize box designs and scenes inside projects.</span></div><div className="studio-home-welcome-actions"><button className="button button-secondary" type="button" onClick={()=>setCreatingProject(value=>!value)}><Plus size={18}/> New project</button><Link className="button button-primary" href={createDesignHref}><FilePlus2 size={18}/> Create new design</Link></div></section>
   {!user.emailVerified&&<aside className="studio-demo-note"><MailNotice/></aside>}

   {creatingProject&&<section className="studio-project-create" aria-label="Create project">
     <div><h2>New project</h2><p>Keep related designs and scenes together under one umbrella.</p></div>
     <div className="studio-project-create-controls"><input value={projectName} maxLength={120} autoFocus placeholder="Project name" onChange={event=>{setProjectName(event.target.value);setProjectError('');}} onKeyDown={event=>{if(event.key==='Enter')void createProject();}}/><button className="button button-primary button-small" type="button" disabled={projectBusy} onClick={()=>void createProject()}>{projectBusy?'Creating…':'Create'}</button><button className="button button-secondary button-small" type="button" onClick={()=>{setCreatingProject(false);setProjectError('');}}>Cancel</button></div>
     {projectError&&<span className="studio-project-create-error">{projectError}</span>}
   </section>}

   <section className="studio-project-library" aria-labelledby="project-library-heading">
    <div className="studio-section-heading"><div><p>Projects</p><h2 id="project-library-heading">Your projects</h2></div><span>{projects.length} project{projects.length===1?'':'s'}</span></div>
    <div className="studio-project-grid">
      <Link className={`studio-project-card${!activeProjectId?' is-active':''}`} href="/studio">
        <div className="studio-project-card-icon"><Layers3 size={22}/></div><div><strong>All work</strong><span>Browse designs across every project</span></div>
      </Link>
      {projects.map(project=><Link className={`studio-project-card${activeProjectId===project.id?' is-active':''}`} href={`/studio?workspace=${encodeURIComponent(project.id)}`} key={project.id}>
        <div className="studio-project-card-icon"><Folder size={22}/></div>
        <div className="studio-project-card-copy"><div><strong>{project.name}</strong>{project.isDefault&&<em>Default</em>}</div><span>{project.designCount} design{project.designCount===1?'':'s'} · {project.sceneCount} scene{project.sceneCount===1?'':'s'}</span><small>Updated {new Date(project.updatedAt).toLocaleDateString()}</small></div>
      </Link>)}
    </div>
   </section>

   <section className="studio-library" aria-labelledby="design-library-heading">
    <div className="studio-section-heading"><div><p>{activeProject?'Project contents':'Design library'}</p><h2 id="design-library-heading">{activeProject?activeProject.name:'Your designs'}</h2></div><div className="studio-section-heading-actions">{activeProject&&<Link className="button button-secondary button-small" href={`/scene-studio?workspace=${encodeURIComponent(activeProject.id)}`}>Open Scene Studio</Link>}<span>{total} designs</span></div></div>
    <form className="studio-library-controls" action="/studio">
      {activeProjectId&&<input type="hidden" name="workspace" value={activeProjectId}/>}
      <label className="studio-search"><Search/><span className="sr-only">Search designs</span><input name="q" defaultValue={search} placeholder="Search your designs" maxLength={80}/></label>
      <div className="studio-sort"><label htmlFor="design-sort">Sort</label><select id="design-sort" name="sort" defaultValue={sort}><option value="recent">Last edited</option><option value="name">Name</option></select></div>
      <button className="button button-secondary button-small">Search</button>
    </form>
    {designs.length?<div className="studio-design-grid">{designs.map(design=><article className="studio-design-card" key={design.id}><div className="studio-design-thumb tone-sage">{design.preview?<img src={design.preview} alt={`${design.name} preview`} loading="lazy"/>:<Box size={64} strokeWidth={1}/>}<span>{design.legacy?'Legacy design':'Saved design'}</span>{design.favorite&&<i className="studio-design-favorite" title="Favourite" aria-label="Favourite"><Star size={14} fill="currentColor"/></i>}</div><div className="studio-design-meta"><div><h3>{design.name}</h3><small><Clock3/> Edited {new Date(design.updatedAt).toLocaleDateString()}</small></div>{design.href?<Link className="button button-secondary button-small" href={design.href} target={design.legacy?'_blank':undefined} rel={design.legacy?'noopener noreferrer':undefined}>{design.legacy?'Open original':'Open'}</Link>:<span className="studio-legacy-label">Preserved · conversion pending</span>}</div></article>)}</div>:<div className="studio-library-empty"><Box/><h3>{search?'No matching designs':activeProject?'No designs in this project yet':'Your first design starts here'}</h3><p>{search?'Try a different search.':activeProject?'Create a design here and it will stay grouped with this project.':'Create a design and save it to see it in this library.'}</p><Link className="button button-primary" href={search?(activeProjectId?`/studio?workspace=${encodeURIComponent(activeProjectId)}`:'/studio'):createDesignHref}>{search?'Clear search':'Create new design'}</Link></div>}
    {total>24&&<nav className="studio-pagination" aria-label="Design pages">{page>1&&<Link href={pageLink(page-1)}>Previous</Link>}<span>Page {page} of {Math.ceil(total/24)}</span>{page*24<total&&<Link href={pageLink(page+1)}>Next</Link>}</nav>}
   </section>

   <section className="studio-templates" aria-labelledby="template-heading"><div className="studio-section-heading"><div><p>Start from structure</p><h2 id="template-heading">Packaging templates</h2></div></div><div className="studio-template-grid">{PACKAGING_TEMPLATES.map(template=><article className="studio-template-card" key={template.id}><div className="studio-template-art"><TemplateVisual template={template}/></div><div className="studio-template-card-copy"><div><h3>{template.shortName}</h3><p>{template.category}</p></div>{template.status==='ready'?<Link className="button button-secondary button-small" href={`/studio/editor?template=${template.id}${activeProjectId?`&workspace=${encodeURIComponent(activeProjectId)}`:''}`}><PackageOpen size={16}/> Use template</Link>:<span className="studio-legacy-label">Coming soon</span>}</div></article>)}</div></section>
  </div>
 </main>;
}

function MailNotice(){return <div><b>Verify your email</b><span><Link href="/verify-email">Check your inbox or resend the verification email.</Link> You can continue designing while verification is pending.</span></div>;}
