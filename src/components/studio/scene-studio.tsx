'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
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
type SceneArea='objects'|'setup';

const tools:Array<{id:SceneTool;label:string;icon:typeof Box}>=[
  {id:'objects',label:'Objects',icon:Layers3},
  {id:'background',label:'Background',icon:ImageIcon},
  {id:'lighting',label:'Lighting',icon:Lightbulb},
  {id:'shadows',label:'Shadows',icon:Moon},
  {id:'camera',label:'Camera',icon:Camera},
  {id:'environment',label:'Environment',icon:Sun},
  {id:'export',label:'Download',icon:Download},
];

const sceneAreas:Array<{id:SceneArea;label:string;helper:string;icon:typeof Box;defaultTool:SceneTool;tools:SceneTool[]}>=[
  {id:'objects',label:'Objects',helper:'Boxes & props',icon:Layers3,defaultTool:'objects',tools:['objects']},
  {id:'setup',label:'Scene setup',helper:'Background, light & camera',icon:Sparkles,defaultTool:'background',tools:['background','lighting','shadows','camera','environment']},
];

function areaForSceneTool(tool:SceneTool):SceneArea|null{
  if(tool==='export')return null;
  return sceneAreas.find(area=>area.tools.includes(tool))?.id??null;
}

export function SceneStudio({designs,workspaceProjectId}:{designs:WorkspaceDesign[];workspaceProjectId?:string|null}){
  const [tool,setTool]=useState<SceneTool>('objects');
  const activeArea=areaForSceneTool(tool);
  const activeAreaConfig=sceneAreas.find(area=>area.id===activeArea)??null;
  const [scene,setScene]=useState<SceneProjectState>(()=>createEmptySceneProject());
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const nextObjectIdRef=useRef(0);
  const selected=useMemo(()=>scene.objects.find(item=>item.id===selectedId)??null,[scene.objects,selectedId]);

  const addBox=(design:WorkspaceDesign)=>{
    nextObjectIdRef.current += 1;
    const id=`scene-box-${nextObjectIdRef.current}`;
    setScene(current=>({
      ...current,
      objects:[...current.objects,{
        id,
        type:'box-project',
        name:design.name,
        sourceDesignId:design.id,
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
        <button type="button" className="scene-primary-action" onClick={()=>setTool('export')}><Download size={16}/> Download</button>
        <AccountButton compact className="scene-account-button"/>
      </div>
    </header>

    <section className="scene-workspace">
      <nav className="scene-toolbar scene-task-toolbar" aria-label="Scene tools">
        {sceneAreas.map(area=>{
          const Icon=area.icon;
          return <button key={area.id} type="button" className={activeArea===area.id?'is-active':''} aria-pressed={activeArea===area.id} title={area.helper} onClick={()=>setTool(activeArea===area.id?tool:area.defaultTool)}>
            <Icon size={20}/><span><strong>{area.label}</strong><small>{area.helper}</small></span>
          </button>;
        })}
      </nav>

      <aside className="scene-panel">
        {activeAreaConfig?.tools.length && activeAreaConfig.tools.length>1 ? <nav className="scene-panel-tabs" aria-label={`${activeAreaConfig.label} tools`}>
          {activeAreaConfig.tools.map(toolId=>{
            const item=tools.find(candidate=>candidate.id===toolId)!;
            const Icon=item.icon;
            return <button key={toolId} type="button" className={tool===toolId?'is-active':''} aria-pressed={tool===toolId} onClick={()=>setTool(toolId)}><Icon size={15}/><span>{item.label}</span></button>;
          })}
        </nav>:null}
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
        {tool==='export' && <ToolPlaceholder icon={Download} title="Download" text="Download scene outputs here as rendering formats become available. Scene composition remains separate from the source box design."/>}
      </aside>

      <div className="scene-stage-wrap">
        <div className="scene-stage" aria-label="3D scene canvas">
          <div className="scene-stage-grid"/>
          {!scene.objects.length ? <div className="scene-empty-state">
            <span className="scene-empty-icon"><Box size={34}/></span>
            <h1>Create your product shot</h1>
            <p>Start by adding one of your saved box designs. Then shape the scene with background, lighting and camera controls without changing the source packaging artwork.</p>
            <div><button type="button" onClick={()=>setTool('objects')}><PackagePlus size={17}/> Add a box</button><Link href={workspaceProjectId?`/studio/editor?workspace=${encodeURIComponent(workspaceProjectId)}`:'/studio/editor'}>Create a new box</Link></div>
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
        <div className="scene-properties-head"><span>{selected?'Selected object':'Scene'}</span>{selected ? <strong>{selected.name}</strong> : <strong>Properties</strong>}</div>
        {!selected ? <div className="scene-properties-empty"><Layers3 size={22}/><p>Select an object to edit its position and appearance. With nothing selected, use Scene setup for background, lighting and camera.</p></div> : <div className="scene-properties-content">
          <label>Name<input value={selected.name} onChange={event=>setScene(current=>({...current,objects:current.objects.map(item=>item.id===selected.id?{...item,name:event.target.value}:item)}))}/></label>
          <TransformGroup title="Position" value={selected.position}/>
          <TransformGroup title="Rotation" value={selected.rotation}/>
          <TransformGroup title="Scale" value={selected.scale}/>
          <Link className="scene-edit-source" href={`/studio/editor?project=${encodeURIComponent(selected.sourceDesignId)}${workspaceProjectId?`&workspace=${encodeURIComponent(workspaceProjectId)}`:''}`}>Edit source box</Link>
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
