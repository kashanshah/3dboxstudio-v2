import { saveProject } from '@/server/project-save';
export async function POST(req:Request){return saveProject(req);}
