import type { DielinePrimitive, ParsedDieline } from './dieline-import';

export type DielineLineRole = 'cut'|'crease'|'ignore'|'unknown';
export type DielinePanelName = 'Front'|'Back'|'Left'|'Right'|'Top'|'Bottom'|'Glue'|'Other';

export type DielineMapping = {
  lineRoles: Record<number, DielineLineRole>;
  panelNames: Record<number, DielinePanelName>;
};

export type PanelCandidate = {
  primitiveIndex:number;
  points:{x:number;y:number}[];
  area:number;
  center:{x:number;y:number};
};

export function createInitialDielineMapping(dieline: ParsedDieline): DielineMapping {
  const lineRoles:Record<number,DielineLineRole>={};
  const panelNames:Record<number,DielinePanelName>={};
  dieline.primitives.forEach((primitive,index)=>{
    lineRoles[index]=primitive.role;
  });
  return {lineRoles,panelNames};
}

function polygonArea(points:{x:number;y:number}[]) {
  let sum=0;
  for(let i=0;i<points.length;i++){
    const a=points[i], b=points[(i+1)%points.length];
    sum += a.x*b.y-b.x*a.y;
  }
  return Math.abs(sum)/2;
}

export function panelCandidates(dieline: ParsedDieline): PanelCandidate[] {
  return dieline.primitives.flatMap((primitive,index)=>{
    if(primitive.kind!=='polyline'||!primitive.closed||primitive.points.length<3) return [];
    const area=polygonArea(primitive.points);
    if(area<=0) return [];
    const center=primitive.points.reduce((acc,p)=>({x:acc.x+p.x,y:acc.y+p.y}),{x:0,y:0});
    return [{primitiveIndex:index,points:primitive.points,area,center:{x:center.x/primitive.points.length,y:center.y/primitive.points.length}}];
  }).sort((a,b)=>b.area-a.area);
}

export function mappingProgress(dieline: ParsedDieline, mapping: DielineMapping) {
  const candidates=panelCandidates(dieline);
  const assigned=candidates.filter(candidate=>mapping.panelNames[candidate.primitiveIndex]).length;
  const unresolvedLines=dieline.primitives.filter((_,index)=>(mapping.lineRoles[index]??'unknown')==='unknown').length;
  const ignored=dieline.primitives.filter((_,index)=>(mapping.lineRoles[index]??'unknown')==='ignore').length;
  return {
    panelCandidates:candidates.length,
    assignedPanels:assigned,
    unresolvedLines,
    ignoredLines:ignored,
    readyFor3D:candidates.length>=4 && assigned>=4 && unresolvedLines===0,
  };
}

export function primitiveSummary(primitive:DielinePrimitive) {
  if(primitive.kind==='line') return 'Line';
  if(primitive.kind==='path') return 'Path';
  return primitive.closed?'Closed region':'Polyline';
}
