export type SceneVector3 = { x:number; y:number; z:number };

export type SceneBoxObject = {
  id:string;
  type:'box-project';
  name:string;
  sourceProjectId:string;
  position:SceneVector3;
  rotation:SceneVector3;
  scale:SceneVector3;
  visible:boolean;
};

export type SceneLight =
  | { id:string; type:'ambient'; name:string; intensity:number; color:string; enabled:boolean }
  | { id:string; type:'directional'|'point'|'spot'; name:string; intensity:number; color:string; enabled:boolean; position:SceneVector3; rotation:SceneVector3 };

export type SceneBackground =
  | { type:'transparent' }
  | { type:'color'; color:string }
  | { type:'image'; url:string }
  | { type:'environment'; assetId:string };

export type SceneShadowSettings = {
  enabled:boolean;
  softness:number;
  opacity:number;
  contact:boolean;
};

export type SceneCamera = {
  position:SceneVector3;
  target:SceneVector3;
  focalLength:number;
  perspective:number;
};

export type SceneProjectState = {
  version:1;
  objects:SceneBoxObject[];
  lights:SceneLight[];
  background:SceneBackground;
  shadows:SceneShadowSettings;
  camera:SceneCamera;
  environment:null | {
    assetId:string;
    intensity:number;
    rotation:number;
  };
};

export function createEmptySceneProject():SceneProjectState {
  return {
    version:1,
    objects:[],
    lights:[],
    background:{type:'transparent'},
    shadows:{enabled:false,softness:0.5,opacity:0.35,contact:true},
    camera:{
      position:{x:4,y:3,z:6},
      target:{x:0,y:0,z:0},
      focalLength:50,
      perspective:45,
    },
    environment:null,
  };
}
