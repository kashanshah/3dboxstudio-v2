'use client';

import { useRouter,usePathname } from 'next/navigation';
import { createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import { withPostHog } from '@/lib/analytics/posthog';
import { markSessionChecked,shouldCheckSession } from '@/lib/auth-hint';

export type AuthUser={
  id:string;
  email:string;
  name:string|null;
  emailVerified:boolean;
  hasPassword:boolean;
  createdAt:string;
  signupMethod:string|null;
};

type AuthMode='signin'|'signup';
type AuthContextValue={
  user:AuthUser|null;
  loading:boolean;
  openAuth:(mode?:AuthMode)=>void;
  refresh:()=>Promise<void>;
  setUser:(user:AuthUser|null)=>void;
  signOut:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|null>(null);

// /api/auth/me also refreshes or clears the signed-in hint cookie.
async function fetchSessionUser():Promise<AuthUser|null>{
  const response=await fetch('/api/auth/me',{cache:'no-store'});
  if(!response.ok) throw new Error('Session check failed');
  const data=await response.json() as {user?:AuthUser|null};
  markSessionChecked();
  return data.user??null;
}

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(true);
  const router=useRouter(),pathname=usePathname();

  const setAuthenticatedUser=useCallback((nextUser:AuthUser|null)=>{
    setUser(nextUser);
    if(nextUser){
      withPostHog(posthog=>posthog.identify(nextUser.id,{
        email:nextUser.email,
        name:nextUser.name??undefined,
        signup_method:nextUser.signupMethod??undefined,
      }));
    }
  },[]);

  const refresh=useCallback(async()=>{
    try{
      setAuthenticatedUser(await fetchSessionUser());
    }catch{
      setUser(null);
    }finally{
      setLoading(false);
    }
  },[setAuthenticatedUser]);

  useEffect(()=>{
    let cancelled=false;
    // Visitors without the hint are signed out, so most page views skip /me.
    void (shouldCheckSession()?fetchSessionUser():Promise.resolve(null))
      .then(nextUser=>{if(!cancelled) setAuthenticatedUser(nextUser);})
      .catch(()=>{if(!cancelled) setUser(null);})
      .finally(()=>{if(!cancelled) setLoading(false);});
    return ()=>{cancelled=true;};
  },[setAuthenticatedUser]);

  const openAuth=useCallback((nextMode:AuthMode='signin')=>{router.push(`${nextMode==='signup'?'/signup':'/login'}?next=${encodeURIComponent(pathname)}`);},[router,pathname]);

  const signOut=useCallback(async()=>{
    await fetch('/api/auth/logout',{method:'POST'});
    withPostHog(posthog=>{posthog.capture('user_logged_out');posthog.reset();});
    setUser(null);router.push('/login');router.refresh();
  },[router]);

  const value=useMemo(()=>({user,loading,openAuth,refresh,setUser:setAuthenticatedUser,signOut}),[user,loading,openAuth,refresh,setAuthenticatedUser,signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const value=useContext(AuthContext);
  if(!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
