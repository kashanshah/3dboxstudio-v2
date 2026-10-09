import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { lookupCurrentUser,setSignedInHint } from '@/server/auth/session';
import { SIGNED_IN_HINT_COOKIE } from '@/lib/auth-hint';

export const runtime='nodejs';

export async function GET(){
  await ensureV2Schema();
  // A failed lookup is not "signed out": the client keeps its hint and asks again.
  let user;
  try{user=await lookupCurrentUser();}
  catch{return NextResponse.json({error:'Could not check your session.'},{status:503});}
  // Sessions from before the hint existed get one here; stale hints are cleared.
  if(user) await setSignedInHint(true);
  else if((await cookies()).has(SIGNED_IN_HINT_COOKIE)) await setSignedInHint(false);
  return NextResponse.json({user});
}
