import { saveProject } from '@/server/project-save';
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){return saveProject(req,(await params).id);}
