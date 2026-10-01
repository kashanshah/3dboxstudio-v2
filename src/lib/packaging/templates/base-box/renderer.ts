import { sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import { baseBoxPanels, splitTopBoxPanels } from '@/lib/packaging/box-structures';
import type { LegacyOpeningMode } from '@/lib/studio-project';
import { faceNormal, quadFromCorners, type Mesh, type TemplateMeshBuilder } from '@/lib/packaging/template-mesh';

export const buildBaseBoxTemplateMeshes:TemplateMeshBuilder=({dimensions,formation,opening,color,interiorColor,openingMode,splitTopHingeSide})=>
  buildLegacyBoxMeshes(dimensions,formation,opening,color,interiorColor,openingMode,splitTopHingeSide,false);

function buildLegacyBoxMeshes(
  dimensions:CartonDimensions,
  formation:number,
  opening:number,
  color:[number,number,number],
  interiorColor:[number,number,number],
  openingMode:LegacyOpeningMode,
  splitTopHingeSide:'side_a'|'side_b',
  splitTop:boolean,
):Mesh[]{
  const d=sanitizeCartonDimensions(dimensions),w=d.width,h=d.height,depth=d.depth;
  const formationT=clamp(formation,0,100)/100;
  const openingT=clamp(opening,0,100)/100;
  const foldAngle=formationT*(Math.PI/2);
  const x0=-w/2,x1=w/2,y0=-h/2,y1=h/2,z0=-depth/2,z1=depth/2;

  const rotateY=(p:number[],pivot:number[],theta:number)=>{
    const x=p[0]-pivot[0],z=p[2]-pivot[2],c=Math.cos(theta),si=Math.sin(theta);
    return [pivot[0]+x*c+z*si,p[1],pivot[2]-x*si+z*c];
  };
  const rotateAroundAxis=(p:number[],a:number[],b:number[],theta:number)=>{
    const axis=normalize3([b[0]-a[0],b[1]-a[1],b[2]-a[2]]);
    const v=[p[0]-a[0],p[1]-a[1],p[2]-a[2]];
    const c=Math.cos(theta),s=Math.sin(theta),dot=dot3(axis,v),cross=cross3(axis,v);
    return [
      a[0]+v[0]*c+cross[0]*s+axis[0]*dot*(1-c),
      a[1]+v[1]*c+cross[1]*s+axis[1]*dot*(1-c),
      a[2]+v[2]*c+cross[2]*s+axis[2]*dot*(1-c),
    ];
  };
  const transformAll=(corners:number[][],fn:(p:number[])=>number[])=>corners.map(fn);

  const flatPanels=(splitTop?splitTopBoxPanels(d,splitTopHingeSide):baseBoxPanels(d,openingMode));
  const frontFlat=flatPanels.find(panel=>panel.id==='front')!;
  const flatCornerMap=new Map<string,number[][]>();
  for(const panel of flatPanels){
    const name=panel.label.toLowerCase().split(' ').map(part=>part[0].toUpperCase()+part.slice(1)).join(' ');
    flatCornerMap.set(name,[
      [panel.x-frontFlat.x-w/2,h/2-(panel.y+panel.height-frontFlat.y),z1],
      [panel.x+panel.width-frontFlat.x-w/2,h/2-(panel.y+panel.height-frontFlat.y),z1],
      [panel.x+panel.width-frontFlat.x-w/2,h/2-(panel.y-frontFlat.y),z1],
      [panel.x-frontFlat.x-w/2,h/2-(panel.y-frontFlat.y),z1],
    ]);
  }

  // Fold the body as a real four-panel strip. Every intermediate state is a
  // rigid rotation around a scored crease; no corner is linearly interpolated.
  const frontRightHinge=[x1,0,z1],frontLeftHinge=[x0,0,z1];
  const rightBackFlat=[x1+depth,0,z1];
  const leftGlueFlat=[x0-depth,0,z1];

  const bodyTransform=(name:string,p:number[])=>{
    if(name==='Front')return [...p];
    if(name==='Right')return rotateY(p,frontRightHinge,foldAngle);
    if(name==='Back'){
      const first=rotateY(p,frontRightHinge,foldAngle);
      const hinge=rotateY(rightBackFlat,frontRightHinge,foldAngle);
      return rotateY(first,hinge,foldAngle);
    }

    if(splitTop){
      // Split Top's production net is Front -> Right -> Back -> Left.
      // Left is therefore the third hinged panel in the chain, not a panel
      // directly attached to Front as it is in the legacy Base Box net.
      if(name==='Left'){
        const leftFlat=flatCornerMap.get('Left');
        if(!leftFlat)return [...p];
        const backFlat=flatCornerMap.get('Back');
        if(!backFlat)return [...p];
        const backLeftFlat=[backFlat[1][0],0,z1];

        const first=rotateY(p,frontRightHinge,foldAngle);
        const rightBackHinge=rotateY(rightBackFlat,frontRightHinge,foldAngle);
        const second=rotateY(first,rightBackHinge,foldAngle);

        const backLeftAfterFirst=rotateY(backLeftFlat,frontRightHinge,foldAngle);
        const backLeftHinge=rotateY(backLeftAfterFirst,rightBackHinge,foldAngle);
        return rotateY(second,backLeftHinge,foldAngle);
      }
      if(name==='Glue'){
        // The split-top glue tab is attached directly to Front's left crease.
        return rotateY(p,frontLeftHinge,-foldAngle);
      }
    }else{
      if(name==='Left')return rotateY(p,frontLeftHinge,-foldAngle);
      if(name==='Glue'){
        const first=rotateY(p,frontLeftHinge,-foldAngle);
        const hinge=rotateY(leftGlueFlat,frontLeftHinge,-foldAngle);
        return rotateY(first,hinge,-foldAngle);
      }
    }
    return [...p];
  };

  const bodyCorners=(name:string)=>transformAll(flatCornerMap.get(name)??[],p=>bodyTransform(name,p));
  const frontCorners=bodyCorners('Front');
  const backCorners=bodyCorners('Back');
  let leftCorners=bodyCorners('Left');
  let rightCorners=bodyCorners('Right');

  // Door modes articulate an already folding rigid wall around its actual
  // front vertical crease. Scaling by formation keeps the 0% state identical
  // to the physical flat dieline instead of twisting a flat sheet in 3D.
  const doorAngle=openingT*formationT*(Math.PI/2);
  if((openingMode==='door_left'||openingMode==='double_doors')&&leftCorners.length){
    const hingeA=frontCorners[0],hingeB=frontCorners[3];
    leftCorners=transformAll(leftCorners,p=>rotateAroundAxis(p,hingeA,hingeB,doorAngle));
  }
  if((openingMode==='door_right'||openingMode==='double_doors')&&rightCorners.length){
    const hingeA=frontCorners[1],hingeB=frontCorners[2];
    rightCorners=transformAll(rightCorners,p=>rotateAroundAxis(p,hingeA,hingeB,-doorAngle));
  }

  const panels:{name:string;corners:number[][]}[]=[
    {name:'Front',corners:frontCorners},
    {name:'Back',corners:backCorners},
    {name:'Left',corners:leftCorners},
    {name:'Right',corners:rightCorners},
  ];

  const foldFlap=(name:string,parent:string,edge:'top'|'bottom',theta:number)=>{
    const flat=flatCornerMap.get(name);
    if(!flat)return null;
    const parentTransformed=transformAll(flat,p=>bodyTransform(parent,p));
    const hingeIndices=edge==='top'?[0,1]:[3,2];
    const a=bodyTransform(parent,flat[hingeIndices[0]]);
    const b=bodyTransform(parent,flat[hingeIndices[1]]);
    return transformAll(parentTransformed,p=>rotateAroundAxis(p,a,b,theta));
  };

  // Bottom closures fold while the body is being erected.
  if(splitTop){
    const bottomFront=foldFlap('Bottom Front','Front','bottom',foldAngle);
    const bottomBack=foldFlap('Bottom Back','Back','bottom',foldAngle);
    if(bottomFront)panels.push({name:'Bottom Front',corners:bottomFront});
    if(bottomBack)panels.push({name:'Bottom Back',corners:bottomBack});

    // At 70% assembly the carton is formed with both top flaps physically
    // upright. The final 30% closes them around their own front/back creases.
    const closeAngle=(1-openingT)*(Math.PI/2);
    const topParents=splitTopHingeSide==='side_a'
      ? {left:'Left',right:'Right'}
      : {left:'Front',right:'Back'};
    const topLeft=foldFlap('Top Left',topParents.left,'top',-closeAngle);
    const topRight=foldFlap('Top Right',topParents.right,'top',-closeAngle);
    if(topLeft)panels.push({name:'Top Left',corners:topLeft});
    if(topRight)panels.push({name:'Top Right',corners:topRight});
  }else{
    const bottom=foldFlap('Bottom','Front','bottom',foldAngle);
    if(bottom)panels.push({name:'Bottom',corners:bottom});

    const topParent=openingMode==='lid_from_back'?'Back'
      :openingMode==='lid_from_left'?'Left'
        :openingMode==='lid_from_right'?'Right'
          :'Front';
    // Fixed tops close as the carton forms. Hinged lids remain coplanar/open
    // through formation and only close during the opening stage.
    const hasSeparateOpening=openingMode!=='closed'&&!openingMode.startsWith('door_')&&openingMode!=='double_doors';
    const topCloseT=hasSeparateOpening?(1-openingT):formationT;
    const top=foldFlap('Top',topParent,'top',-topCloseT*(Math.PI/2));
    if(top)panels.push({name:'Top',corners:top});
  }

  const result:Mesh[]=[];
  if(formationT<.999){
    const glueCorners=bodyCorners('Glue');
    if(glueCorners.length){
      resultGlue(glueCorners);
    }
  }

  function resultGlue(glueCorners:number[][]){
    result.push(quadFromCorners(glueCorners,color,true,'Glue'));
    const glueNormal=faceNormal(glueCorners),offset=Math.max(0.02,Math.min(2,d.thickness));
    const glueInner=glueCorners.map(p=>[p[0]-glueNormal[0]*offset,p[1]-glueNormal[1]*offset,p[2]-glueNormal[2]*offset]);
    result.push(quadFromCorners([glueInner[3],glueInner[2],glueInner[1],glueInner[0]],interiorColor,true,'Interior Glue'));
  }

  for(const panel of panels){
    const formedCorners=panel.corners;
    const outer=quadFromCorners(formedCorners,color,true,panel.name);
    if(splitTop&&panel.name.startsWith('Bottom ')){
      outer.fallbackPanel='Bottom';
      outer.fallbackUv=[0,panel.name==='Bottom Front'?.5:0,1,.5];
    }
    result.push(outer);
    const normal=faceNormal(formedCorners),offset=Math.max(0.02,Math.min(2,d.thickness));
    const innerCorners=formedCorners.map(p=>[p[0]-normal[0]*offset,p[1]-normal[1]*offset,p[2]-normal[2]*offset]);
    const inner=quadFromCorners([innerCorners[3],innerCorners[2],innerCorners[1],innerCorners[0]],interiorColor,true,`Interior ${panel.name}`);
    if(outer.fallbackPanel){inner.fallbackPanel='Interior Bottom';inner.fallbackUv=outer.fallbackUv;}
    result.push(inner);
  }
  return result;
}



function normalize3(v:number[]){const length=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/length,v[1]/length,v[2]/length];}
function cross3(a:number[],b:number[]){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function dot3(a:number[],b:number[]){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}
