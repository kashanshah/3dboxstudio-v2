export type DielinePrimitive =
  | { kind:'line'; x1:number; y1:number; x2:number; y2:number; role:'cut'|'crease'|'unknown' }
  | { kind:'polyline'; points:{x:number;y:number}[]; closed:boolean; role:'cut'|'crease'|'unknown' };

export type ParsedDieline = {
  name:string;
  format:'svg'|'dxf';
  width:number;
  height:number;
  primitives:DielinePrimitive[];
  warnings:string[];
  sourceText:string;
};

function roleFromText(value:string): 'cut'|'crease'|'unknown' {
  const s=value.toLowerCase();
  if (/(crease|fold|score|perf)/.test(s)) return 'crease';
  if (/(cut|knife|trim|die)/.test(s)) return 'cut';
  return 'unknown';
}

function boundsFromPoints(points:{x:number;y:number}[]) {
  if (!points.length) return { minX:0,minY:0,maxX:100,maxY:100 };
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
  return { minX:Math.min(...xs), minY:Math.min(...ys), maxX:Math.max(...xs), maxY:Math.max(...ys) };
}

export function parseSvgDieline(name:string,text:string): ParsedDieline {
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('The SVG could not be parsed.');
  const svg=doc.documentElement;
  if (svg.nodeName.toLowerCase()!=='svg') throw new Error('This file is not a valid SVG.');

  const primitives:DielinePrimitive[]=[];
  const warnings:string[]=[];
  const allPoints:{x:number;y:number}[]=[];

  const inferRole=(el:Element)=>{
    const hint=[el.getAttribute('id'),el.getAttribute('class'),el.getAttribute('stroke'),el.parentElement?.getAttribute('id'),el.parentElement?.getAttribute('class')].filter(Boolean).join(' ');
    return roleFromText(hint);
  };

  svg.querySelectorAll('line').forEach(el=>{
    const x1=Number(el.getAttribute('x1')||0),y1=Number(el.getAttribute('y1')||0),x2=Number(el.getAttribute('x2')||0),y2=Number(el.getAttribute('y2')||0);
    if([x1,y1,x2,y2].every(Number.isFinite)){primitives.push({kind:'line',x1,y1,x2,y2,role:inferRole(el)});allPoints.push({x:x1,y:y1},{x:x2,y:y2});}
  });
  svg.querySelectorAll('polyline,polygon').forEach(el=>{
    const raw=el.getAttribute('points')||'';
    const nums=raw.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const points:{x:number;y:number}[]=[];
    for(let i=0;i+1<nums.length;i+=2) points.push({x:nums[i],y:nums[i+1]});
    if(points.length>=2){primitives.push({kind:'polyline',points,closed:el.nodeName.toLowerCase()==='polygon',role:inferRole(el)});allPoints.push(...points);}
  });
  svg.querySelectorAll('rect').forEach(el=>{
    const x=Number(el.getAttribute('x')||0),y=Number(el.getAttribute('y')||0),w=Number(el.getAttribute('width')||0),h=Number(el.getAttribute('height')||0);
    if([x,y,w,h].every(Number.isFinite)&&w>0&&h>0){const pts=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];primitives.push({kind:'polyline',points:pts,closed:true,role:inferRole(el)});allPoints.push(...pts);}
  });
  const unsupported=svg.querySelectorAll('path,circle,ellipse').length;
  if(unsupported) warnings.push(`${unsupported} path/circle/ellipse element${unsupported===1?' was':'s were'} not converted in this first importer.`);

  let width=Number.parseFloat(svg.getAttribute('width')||'');
  let height=Number.parseFloat(svg.getAttribute('height')||'');
  const vb=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
  if((!Number.isFinite(width)||!Number.isFinite(height))&&vb.length===4&&vb.every(Number.isFinite)){width=vb[2];height=vb[3];}
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){const b=boundsFromPoints(allPoints);width=Math.max(1,b.maxX-b.minX);height=Math.max(1,b.maxY-b.minY);}

  if(!primitives.length) warnings.push('No supported line, polyline, polygon, or rectangle geometry was found.');
  return {name,format:'svg',width,height,primitives,warnings,sourceText:text};
}

export function parseDxfDieline(name:string,text:string): ParsedDieline {
  const lines=text.replace(/\r/g,'').split('\n');
  const pairs:{code:number;value:string}[]=[];
  for(let i=0;i+1<lines.length;i+=2){const code=Number(lines[i].trim());if(Number.isFinite(code))pairs.push({code,value:lines[i+1].trim()});}
  const primitives:DielinePrimitive[]=[];
  const warnings:string[]=[];
  const allPoints:{x:number;y:number}[]=[];

  for(let i=0;i<pairs.length;i++){
    if(pairs[i].code!==0) continue;
    const type=pairs[i].value.toUpperCase();
    if(type==='LINE'){
      let x1=0,y1=0,x2=0,y2=0,layer='';
      for(let j=i+1;j<pairs.length&&pairs[j].code!==0;j++){const p=pairs[j];if(p.code===8)layer=p.value;else if(p.code===10)x1=Number(p.value);else if(p.code===20)y1=Number(p.value);else if(p.code===11)x2=Number(p.value);else if(p.code===21)y2=Number(p.value);}
      if([x1,y1,x2,y2].every(Number.isFinite)){primitives.push({kind:'line',x1,y1,x2,y2,role:roleFromText(layer)});allPoints.push({x:x1,y:y1},{x:x2,y:y2});}
    } else if(type==='LWPOLYLINE'){
      const points:{x:number;y:number}[]=[];let x:number|null=null;let closed=false;let layer='';
      for(let j=i+1;j<pairs.length&&pairs[j].code!==0;j++){const p=pairs[j];if(p.code===8)layer=p.value;else if(p.code===70)closed=(Number(p.value)&1)===1;else if(p.code===10){x=Number(p.value);}else if(p.code===20&&x!==null){points.push({x,y:Number(p.value)});x=null;}}
      if(points.length>=2&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))){primitives.push({kind:'polyline',points,closed,role:roleFromText(layer)});allPoints.push(...points);}
    }
  }
  const b=boundsFromPoints(allPoints);
  const width=Math.max(1,b.maxX-b.minX),height=Math.max(1,b.maxY-b.minY);
  if(!primitives.length) warnings.push('No LINE or LWPOLYLINE entities were found. Binary DXF and advanced entities are not supported yet.');
  return {name,format:'dxf',width,height,primitives,warnings,sourceText:text};
}

export async function parseDielineFile(file:File):Promise<ParsedDieline>{
  const text=await file.text();
  const lower=file.name.toLowerCase();
  if(lower.endsWith('.svg')||file.type==='image/svg+xml') return parseSvgDieline(file.name,text);
  if(lower.endsWith('.dxf')||file.type==='application/dxf'||file.type==='text/plain') return parseDxfDieline(file.name,text);
  throw new Error('Use an SVG or ASCII DXF dieline.');
}
