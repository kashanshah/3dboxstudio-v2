'use client';

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
  modalOpen:boolean;
  mode:AuthMode;
  openAuth:(mode?:AuthMode)=>void;
  closeAuth:()=>void;
  refresh:()=>Promise<void>;
  setUser:(user:AuthUser|null)=>void;
  signOut:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(true);
  const [modalOpen,setModalOpen]=useState(false);
  const [mode,setMode]=useState<AuthMode>('signin');

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/auth/me',{cache:'no-store'});
      const data=await response.json() as {user?:AuthUser|null};
      setUser(data.user??null);
    }catch{
      setUser(null);
    }finally{
      setLoading(false);
    }
  },[]);

  useEffect(()=>{void refresh();},[refresh]);

  const openAuth=useCallback((nextMode:AuthMode='signin')=>{
    setMode(nextMode);
    setModalOpen(true);
  },[]);

  const closeAuth=useCallback(()=>setModalOpen(false),[]);

  const signOut=useCallback(async()=>{
    await fetch('/api/auth/logout',{method:'POST'});
    setUser(null);
  },[]);

  const value=useMemo(()=>({user,loading,modalOpen,mode,openAuth,closeAuth,refresh,setUser,signOut}),[user,loading,modalOpen,mode,openAuth,closeAuth,refresh,signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(){
  const value=useContext(AuthContext);
  if(!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
