'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Box, Camera, ChevronLeft, CirclePlus, Download, Image as ImageIcon,
  Layers3, Lightbulb, Moon, PackagePlus, Sparkles, Sun, Upload, WandSparkles
} from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { AccountButton } from '@/components/auth/account-button';
import { createEmptySceneProject, type SceneProjectState } from '@/lib/scene-project';
import type { WorkspaceDesign } from '@/server/projects';
import './scene-studio.css';

type SceneTool='objects'|'background'|'lighting'|'shadows'|'camera'|'environment'|'export';

const tools:Array<{id:SceneTool;label:string;icon:typeof Box}>=[
  {id:'objects',label:'Objects',icon:Layers3},
  {id:'background',label:'Background',icon:ImageIcon},
  {id:'lighting',label:'Lighting',icon:Lightbulb},
  {id:'shadows',label:'Shadows',icon:Moon},
  {id:'camera',label:'Camera',icon:Camera},
  {id:'environment',label:'Environment',icon:Sun},
  {id:'export',label:'Export',icon:Download},
];

export function SceneStudio({designs,user}:{designs:WorkspaceDesign[];user:{name?:string|null;email:string}}){
  const [tool,setTool]=useState<SceneTool>('objects');
  const [scene,setScene]=useState<SceneProjectState>(()=>createEmptySceneProject());
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const selected=useMemo(()=>scene.objects.find(item=>item.id===selectedId)??null,[scene.objects,selectedId]);

  const addBox=(design:WorkspaceDesign)=>{
    const id=globalThis.crypto?.randomUUID?.() ?? `scene-box-${Date.now()}`;
    setScene(current=>({
      ...current,
      objects:[...current.objects,{
        id,
        type:'box-project',
        name:design.name,
        sourceProjectId:design.id,
        position:{x:current.objects.length*0.35,y:0,z:0},
        rotation:{x:0,y:0,z:0},
        scale:{x:1,y:1,z:1},
        visible:true,
      }],
    }));
    setSelectedId(id);
  };

  return <main className="scene-studio">
    <header className="scene-topbar">
      <div className="scene-topbar-left">
        <Link className="scene-back" href="/studio/editor" aria-label="Back to Box Studio"><ChevronLeft size={18}/></Link>
        <Brand/>
        <span className="scene-product-name">Scene Studio</span>
      </div>
      <div className="scene-topbar-center">
        <strong>Untitled scene</strong>
        <span>{scene.objects.length ? `${scene.objects.length} object${scene.objects.length===1?'':'s'}` : 'Empty scene'}</span>
      </div>
      <div className="scene-topbar-actions">
        <button type="button" className="scene-ghost-button"><Sparkles size={16}/> Render</button>
        <AccountButton user={user}/>
      </div>
    </header>

    <section className="scene-workspace">
      <nav className="scene-toolbar" aria-label="Scene tools">
        {tools.map(item=>{
          const Icon=item.icon;
          return <button key={item.id} type="button" className={tool===item.id?'is-active':''} onClick={()=>setTool(item.id)}>
            <Icon size={19}/><span>{item.label}</span>
          </button>;
        })}
      </nav>

      <aside className="scene-panel">
        {tool==='objects' && <div className="scene-panel-content">
          <div className="scene-panel-heading"><div><span>Scene</span><h2>Objects</h2></div><button type="button" title="Add object"><CirclePlus size={18}/></button></div>
          <p className="scene-panel-copy">Add packaging from Box Studio now. Props, bottles, jars and imported 3D assets can use the same object system later.</p>
          <div className="scene-section-title"><span>Your boxes</span><Link href="/studio">Manage</Link></div>
          <div className="scene-box-library">
            {designs.length ? designs.slice(0,12).map(design=><button key={design.id} type="button" onClick={()=>addBox(design)}>
              <span className="scene-box-thumb">{design.preview ? <img src={design.preview} alt=""/> : <Box size={24}/>}</span>
              <span><strong>{design.name}</strong><small>{design.legacy?'Legacy design':'Box Studio project'}</small></span>
              <PackagePlus size={17}/>
            </button>) : <div className="scene-library-empty"><Box size={26}/><strong>No saved boxes yet</strong><p>Create a package in Box Studio, save it, then bring it into any scene.</p><Link href="/studio/editor">Create a box</Link></div>}
          </div>
          <div className="scene-section-title"><span>More objects</span></div>
          <button className="scene-coming-row" type="button" disabled><Upload size={17}/><span><strong>Import 3D object</strong><small>GLB / GLTF / OBJ later</small></span></button>
          <button className="scene-coming-row" type="button" disabled><WandSparkles size={17}/><span><strong>Props library</strong><small>Studio surfaces, blocks, plinths and decor</small></span></button>
        </div>}

        {tool==='background' && <ToolPlaceholder icon={ImageIcon} title="Background" text="Start transparent. Add a solid color, gradient, uploaded image, generated backdrop, or full environment later."/>}
        {tool==='lighting' && <ToolPlaceholder icon={Lightbulb} title="Lighting" text="The empty scene starts with no authored lights. Add softboxes, area lights, spots, point lights, rim lights and presets here."/>}
        {tool==='shadows' && <ToolPlaceholder icon={Moon} title="Shadows" text="Scene shadows are independent from Box Studio's true-color proofing view. Control contact shadows, softness, opacity and floor receiving here."/>}
        {tool==='camera' && <ToolPlaceholder icon={Camera} title="Camera" text="Compose product shots with camera position, focal length, perspective, aspect ratio, depth of field and saved camera angles."/>}
        {tool==='environment' && <ToolPlaceholder icon={Sun} title="Environment" text="Use HDRI/studio environments for reflections and ambient light, with independent intensity and rotation."/>}
        {tool==='export' && <ToolPlaceholder icon={Download} title="Render & export" text="Render the scene as transparent PNG, JPG/WebP, high-resolution product imagery, animation and reusable share links."/>}
      </aside>

      <div className="scene-stage-wrap">
        <div className="scene-stage" aria-label="3D scene canvas">
          <div className="scene-stage-grid"/>
          {!scene.objects.length ? <div className="scene-empty-state">
            <span className="scene-empty-icon"><Box size={34}/></span>
            <h1>Start with an empty scene</h1>
            <p>Add a saved box when you are ready, then build the shot around it. Background, lighting and shadows belong to the scene—not to the package artwork.</p>
            <div><button type="button" onClick={()=>setTool('objects')}><PackagePlus size={17}/> Add a box</button><Link href="/studio/editor">Create a new box</Link></div>
          </div> : <div className="scene-object-board">
            {scene.objects.map((object,index)=><button
              key={object.id}
              type="button"
              className={selectedId===object.id?'is-selected':''}
              onClick={()=>setSelectedId(object.id)}
              style={{transform:`translate(${object.position.x*70}px,${object.position.z*40}px) rotate(${object.rotation.y}deg)`,zIndex:index+1}}
            >
              <Box size={42}/><span>{object.name}</span>
            </button>)}
          </div>}
          <div className="scene-view-chip">Perspective</div>
        </div>
      </div>

      <aside className="scene-properties">
        <div className="scene-properties-head"><span>Properties</span>{selected && <strong>{selected.name}</strong>}</div>
        {!selected ? <div className="scene-properties-empty"><Layers3 size={22}/><p>Select an object in the scene to edit its transform and appearance.</p></div> : <div className="scene-properties-content">
          <label>Name<input value={selected.name} onChange={event=>setScene(current=>({...current,objects:current.objects.map(item=>item.id===selected.id?{...item,name:event.target.value}:item)}))}/></label>
          <TransformGroup title="Position" value={selected.position}/>
          <TransformGroup title="Rotation" value={selected.rotation}/>
          <TransformGroup title="Scale" value={selected.scale}/>
          <Link className="scene-edit-source" href={`/studio/editor?project=${encodeURIComponent(selected.sourceProjectId)}`}>Edit source box</Link>
        </div>}
      </aside>
    </section>
  </main>;
}

function ToolPlaceholder({icon:Icon,title,text}:{icon:typeof Box;title:string;text:string}){
  return <div className="scene-tool-placeholder"><Icon size={27}/><span>Scene tool</span><h2>{title}</h2><p>{text}</p><small>Foundation added — controls come next.</small></div>;
}

function TransformGroup({title,value}:{title:string;value:{x:number;y:number;z:number}}){
  return <div className="scene-transform"><span>{title}</span><div>{(['x','y','z'] as const).map(axis=><label key={axis}><small>{axis.toUpperCase()}</small><input readOnly value={Number(value[axis]).toFixed(2)}/></label>)}</div></div>;
}
