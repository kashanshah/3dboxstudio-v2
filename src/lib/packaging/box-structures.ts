import { sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';

export type DielinePanel = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'body' | 'flap' | 'glue';
};

function glueWidth(d:CartonDimensions){return Math.max(12,Math.min(24,d.depth*0.35));}

function bodyStrip(d:CartonDimensions,bodyY:number){
 const glue=glueWidth(d);
 return {
  glue,
  panels:[
   {id:'glue',label:'GLUE',x:0,y:bodyY,width:glue,height:d.height,kind:'glue'} as DielinePanel,
   {id:'left',label:'LEFT',x:glue,y:bodyY,width:d.depth,height:d.height,kind:'body'} as DielinePanel,
   {id:'front',label:'FRONT',x:glue+d.depth,y:bodyY,width:d.width,height:d.height,kind:'body'} as DielinePanel,
   {id:'right',label:'RIGHT',x:glue+d.depth+d.width,y:bodyY,width:d.depth,height:d.height,kind:'body'} as DielinePanel,
   {id:'back',label:'BACK',x:glue+d.depth+d.width+d.depth,y:bodyY,width:d.width,height:d.height,kind:'body'} as DielinePanel,
  ],
 };
}

export function baseBoxPanels(input:CartonDimensions,openingMode:LegacyOpeningMode='closed'):DielinePanel[]{
  const d=sanitizeCartonDimensions(input);
  const sideHinge=openingMode==='lid_from_left'||openingMode==='lid_from_right';
  const topExtent=sideHinge?d.width:d.depth;
  const {glue,panels}=bodyStrip(d,topExtent);
  const anchors={
    left:{x:glue,width:d.depth,height:d.width},
    front:{x:glue+d.depth,width:d.width,height:d.depth},
    right:{x:glue+d.depth+d.width,width:d.depth,height:d.width},
    back:{x:glue+d.depth+d.width+d.depth,width:d.width,height:d.depth},
  };
  const anchor=openingMode==='lid_from_left'?anchors.left
    :openingMode==='lid_from_right'?anchors.right
      :openingMode==='lid_from_back'?anchors.back
        :anchors.front;
  panels.push(
    {id:'top',label:'TOP',x:anchor.x,y:topExtent-anchor.height,width:anchor.width,height:anchor.height,kind:'flap'},
    {id:'bottom',label:'BOTTOM',x:anchors.front.x,y:topExtent+d.height,width:d.width,height:d.depth,kind:'flap'},
  );
  return panels;
}

export function splitTopBoxPanels(input:CartonDimensions,axis:'side_a'|'side_b'='side_a'):DielinePanel[]{
  const d=sanitizeCartonDimensions(input);
  const topExtent=axis==='side_a'?d.width/2:d.depth/2;
  const {glue,panels}=bodyStrip(d,topExtent);
  const leftX=glue,frontX=glue+d.depth,rightX=glue+d.depth+d.width,backX=glue+d.depth+d.width+d.depth;
  if(axis==='side_a'){
    panels.push(
      {id:'topLeft',label:'TOP LEFT',x:leftX,y:0,width:d.depth,height:d.width/2,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:rightX,y:0,width:d.depth,height:d.width/2,kind:'flap'},
    );
  }else{
    panels.push(
      {id:'topLeft',label:'TOP LEFT',x:backX,y:0,width:d.width,height:d.depth/2,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:frontX,y:0,width:d.width,height:d.depth/2,kind:'flap'},
    );
  }
  panels.push({id:'bottom',label:'BOTTOM',x:frontX,y:topExtent+d.height,width:d.width,height:d.depth,kind:'flap'});
  return panels;
}

export function dielineBounds(panels:DielinePanel[]){
  return {
    width:Math.max(...panels.map(panel=>panel.x+panel.width)),
    height:Math.max(...panels.map(panel=>panel.y+panel.height)),
  };
}

export function baseBoxBounds(input:CartonDimensions,openingMode:LegacyOpeningMode='closed'){return dielineBounds(baseBoxPanels(input,openingMode));}
export function splitTopBoxBounds(input:CartonDimensions,axis:'side_a'|'side_b'='side_a'){return dielineBounds(splitTopBoxPanels(input,axis));}
