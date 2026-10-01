export type NewDesignProject = {id:string;name:string;isDefault:boolean;designCount:number};

export function newDesignDefaults(projects:NewDesignProject[], requestedProjectId?:string) {
  return {
    name:`Box Design ${projects.reduce((total,project)=>total+project.designCount,0)+1}`,
    workspaceProjectId:projects.find(project=>project.id===requestedProjectId)?.id
      ?? projects.find(project=>project.isDefault)?.id
      ?? null,
  };
}
