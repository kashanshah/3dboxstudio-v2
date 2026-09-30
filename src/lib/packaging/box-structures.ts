import { sanitizeCartonDimensions, type CartonDimensions } from '@/lib/packaging/reverse-tuck';

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

export function baseBoxPanels(input:CartonDimensions):DielinePanel[]{
  const d=sanitizeCartonDimensions(input),glue=glueWidth(d),bodyY=d.depth;
  return [
    {id:'glue',label:'GLUE',x:0,y:bodyY,width:glue,height:d.height,kind:'glue'},
    {id:'left',label:'LEFT',x:glue,y:bodyY,width:d.depth,height:d.height,kind:'body'},
    {id:'front',label:'FRONT',x:glue+d.depth,y:bodyY,width:d.width,height:d.height,kind:'body'},
    {id:'right',label:'RIGHT',x:glue+d.depth+d.width,y:bodyY,width:d.depth,height:d.height,kind:'body'},
    {id:'back',label:'BACK',x:glue+d.depth+d.width+d.depth,y:bodyY,width:d.width,height:d.height,kind:'body'},
    {id:'top',label:'TOP',x:glue+d.depth,y:0,width:d.width,height:d.depth,kind:'flap'},
    {id:'bottom',label:'BOTTOM',x:glue+d.depth,y:bodyY+d.height,width:d.width,height:d.depth,kind:'flap'},
  ];
}

export function splitTopBoxPanels(input:CartonDimensions,axis:'side_a'|'side_b'='side_a'):DielinePanel[]{
  const d=sanitizeCartonDimensions(input),panels=baseBoxPanels(d).filter(panel=>panel.id!=='top');
  const frontX=glueWidth(d)+d.depth;
  if(axis==='side_b'){
    panels.push(
      {id:'topLeft',label:'TOP LEFT',x:frontX,y:0,width:d.width,height:d.depth/2,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:frontX,y:d.depth/2,width:d.width,height:d.depth/2,kind:'flap'},
    );
  }else{
    panels.push(
      {id:'topLeft',label:'TOP LEFT',x:frontX,y:0,width:d.width/2,height:d.depth,kind:'flap'},
      {id:'topRight',label:'TOP RIGHT',x:frontX+d.width/2,y:0,width:d.width/2,height:d.depth,kind:'flap'},
    );
  }
  return panels;
}

export function dielineBounds(panels:DielinePanel[]){
  return {
    width:Math.max(...panels.map(panel=>panel.x+panel.width)),
    height:Math.max(...panels.map(panel=>panel.y+panel.height)),
  };
}

export function baseBoxBounds(input:CartonDimensions){return dielineBounds(baseBoxPanels(input));}
export function splitTopBoxBounds(input:CartonDimensions,axis:'side_a'|'side_b'='side_a'){return dielineBounds(splitTopBoxPanels(input,axis));}
