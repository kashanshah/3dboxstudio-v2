import { sanitizeCartonDimensions, type CartonDimensions } from '../../reverse-tuck';
import { dielineBounds, type DielinePanel } from '../../box-structures';

// The split top's design grid as it stood for layout version 1 (two top
// flaps, two bottom flaps, no slots), kept unchanged so saved designs can be
// moved from it onto the current one. Never edit this file: layout
// migrations depend on it.

function glueWidth(d:CartonDimensions){return Math.max(12,Math.min(24,d.depth*0.35));}

export function splitTopPanelsV1(input:CartonDimensions,axis:'side_a'|'side_b'='side_a'):DielinePanel[]{
  const d=sanitizeCartonDimensions(input);
  const glue=glueWidth(d);
  const topExtent=axis==='side_a'?d.width/2:d.depth/2;
  const bottomExtent=d.depth/2;
  const bodyY=topExtent;
  const frontX=glue;
  const rightX=frontX+d.width;
  const backX=rightX+d.depth;
  const leftX=backX+d.width;

  const topPanels:DielinePanel[]=axis==='side_a'
    ? [
      {id:'topLeft',label:'TOP LEFT',x:leftX,y:0,width:d.depth,height:d.width/2,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:rightX,y:0,width:d.depth,height:d.width/2,kind:'flap'},
    ]
    : [
      {id:'topLeft',label:'TOP LEFT',x:frontX,y:0,width:d.width,height:d.depth/2,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:backX,y:0,width:d.width,height:d.depth/2,kind:'flap'},
    ];

  return [
    {id:'glue',label:'GLUE',x:0,y:bodyY,width:glue,height:d.height,kind:'glue'},
    {id:'front',label:'FRONT',x:frontX,y:bodyY,width:d.width,height:d.height,kind:'body'},
    {id:'right',label:'RIGHT',x:rightX,y:bodyY,width:d.depth,height:d.height,kind:'body'},
    {id:'back',label:'BACK',x:backX,y:bodyY,width:d.width,height:d.height,kind:'body'},
    {id:'left',label:'LEFT',x:leftX,y:bodyY,width:d.depth,height:d.height,kind:'body'},
    ...topPanels,
    {id:'bottomFront',label:'BOTTOM FRONT',x:frontX,y:bodyY+d.height,width:d.width,height:bottomExtent,kind:'flap'},
    {id:'bottomBack',label:'BOTTOM BACK',x:backX,y:bodyY+d.height,width:d.width,height:bottomExtent,kind:'flap'},
  ];
}

export function splitTopSheetV1(input: CartonDimensions, axis: 'side_a' | 'side_b' = 'side_a') {
  const panels = splitTopPanelsV1(input, axis);
  return { panels, bounds: dielineBounds(panels) };
}
