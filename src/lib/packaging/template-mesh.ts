import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { LegacyOpeningMode } from '@/lib/studio-project';

export type Mesh = {
  vertices: Float32Array;
  useTexture: boolean;
  color: [number, number, number];
  model?: Float32Array;
  panel?: string;
  fallbackPanel?: string;
  /** For a surface that is not a panel itself (a bend): the panel whose artwork it shows. */
  sourcePanel?: string;
  /**
   * With no artwork of its own, the first of these panels that has artwork is
   * continued over this face; uv maps the face's artwork square into it.
   */
  continues?: { panel: string; uv: [number, number, number, number] }[];
  fallbackUv?: [number,number,number,number];
  pickCorners?: number[][];
  faceAspect?: number;
  doubleSided?: boolean;
  /** Unprinted closure flap (tuck tongue, dust flap): drawn but never picked or printed. */
  closureFlap?: boolean;
  /** Pairs the outside and inside faces of one board panel that has no panel name. */
  board?: { id: string; side: 'outside' | 'inside' };
  /**
   * Which panel covers which where two meet without a crease: a lower layer
   * stops at the inside surface of a higher one. Defaults: tucked flaps 0,
   * walls 1, lids and bottoms 2.
   */
  layer?: number;
  /** Quad edges (a→b = 0 … d→a = 3) that continue into a bent crease rather than a cut. */
  creases?: number[];
  /** Part of a bent crease: its outside, inside, or cut end face. */
  bend?: 'outside' | 'inside' | 'edge';
  /** Millimetres spanned by the texture coordinates 0–1, when not the quad's own size. */
  uvSize?: [number, number];
};

export type TemplateMeshInput = {
  dimensions: CartonDimensions;
  opening: number;
  formation: number;
  openingMode: LegacyOpeningMode;
  splitTopHingeSide: 'side_a' | 'side_b';
  color: [number,number,number];
  interiorColor: [number,number,number];
};

export type TemplateMeshBuilder = (input:TemplateMeshInput)=>Mesh[];

export function quadFromCorners(
  corners:number[][],
  color:[number,number,number],
  useTexture=false,
  panel?:string,
):Mesh{
  const normal=faceNormal(corners);
  return quad(corners[0],corners[1],corners[2],corners[3],normal,color,useTexture,panel);
}

export function faceNormal(corners:number[][]):[number,number,number]{
  const a=corners[0],b=corners[1],d=corners[3];
  const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
  const ad=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
  const cross=[
    ab[1]*ad[2]-ab[2]*ad[1],
    ab[2]*ad[0]-ab[0]*ad[2],
    ab[0]*ad[1]-ab[1]*ad[0],
  ];
  const length=Math.hypot(cross[0],cross[1],cross[2])||1;
  return [cross[0]/length,cross[1]/length,cross[2]/length];
}

function quad(
  a:number[],b:number[],c:number[],d:number[],
  normal:[number,number,number],
  color:[number,number,number],
  useTexture=false,
  panel?:string,
):Mesh{
  const vertices=[
    ...vertex(a,normal,[0,0]),...vertex(b,normal,[1,0]),...vertex(c,normal,[1,1]),
    ...vertex(a,normal,[0,0]),...vertex(c,normal,[1,1]),...vertex(d,normal,[0,1]),
  ];
  const edge1=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  const edge2=Math.hypot(d[0]-a[0],d[1]-a[1],d[2]-a[2]);
  return {
    vertices:new Float32Array(vertices),
    useTexture,
    color,
    panel,
    pickCorners:panel?[a,b,c,d]:undefined,
    faceAspect:edge2>0?edge1/edge2:1,
  };
}

function vertex(position:number[],normal:number[],uv:number[]){
  return [...position,...normal,...uv];
}
