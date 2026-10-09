import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { dielineBounds, type DielinePanel } from '../../box-structures';
import type { LegacyOpeningMode } from '../../../studio-project';

// The base box's design grid as it stood for layout version 1 (a plain six-
// face net), kept unchanged so saved designs can be moved from it onto the
// current one. Never edit this file: layout migrations depend on it.

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

export function baseBoxPanelsV1(input:CartonDimensions,openingMode:LegacyOpeningMode='closed'):DielinePanel[]{
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


export function baseBoxSheetV1(input: CartonDimensions, openingMode: LegacyOpeningMode = 'closed') {
  const panels = baseBoxPanelsV1(input, openingMode);
  return { panels, bounds: dielineBounds(panels) };
}
