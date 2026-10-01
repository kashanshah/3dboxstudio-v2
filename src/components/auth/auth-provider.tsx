'use client';

import { useRouter,usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import { createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';

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

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(true);
  const router=useRouter(),pathname=usePathname();

  const setAuthenticatedUser=useCallback((nextUser:AuthUser|null)=>{
    setUser(nextUser);
    if(nextUser){
      posthog.identify(nextUser.id,{
        email:nextUser.email,
        name:nextUser.name??undefined,
        signup_method:nextUser.signupMethod??undefined,
      });
    }
  },[]);

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/auth/me',{cache:'no-store'});
      const data=await response.json() as {user?:AuthUser|null};
      setAuthenticatedUser(data.user??null);
    }catch{
      setUser(null);
    }finally{
      setLoading(false);
    }
  },[setAuthenticatedUser]);

  useEffect(()=>{
    let cancelled=false;
    void fetch('/api/auth/me',{cache:'no-store'})
      .then(response=>response.json() as Promise<{user?:AuthUser|null}>)
      .then(data=>{if(!cancelled) setAuthenticatedUser(data.user??null);})
      .catch(()=>{if(!cancelled) setUser(null);})
      .finally(()=>{if(!cancelled) setLoading(false);});
    return ()=>{cancelled=true;};
  },[setAuthenticatedUser]);

  const openAuth=useCallback((nextMode:AuthMode='signin')=>{router.push(`${nextMode==='signup'?'/signup':'/login'}?next=${encodeURIComponent(pathname)}`);},[router,pathname]);

  const signOut=useCallback(async()=>{
    await fetch('/api/auth/logout',{method:'POST'});
    posthog.capture('user_logged_out');
    posthog.reset();
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
