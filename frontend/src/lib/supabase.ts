import {createClient} from '@supabase/supabase-js';
import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined,key=import.meta.env.VITE_SUPABASE_KEY as string|undefined;
/** null when the env vars are missing: the app then works as before, without accounts. */
export const supabase=url&&key?createClient(url,key):null;

/** Current session (undefined while loading, null when signed out). */
export function useSession(){
 const [session,setSession]=useState<Session|null|undefined>(supabase?undefined:null);
 useEffect(()=>{
  if(!supabase)return;
  supabase.auth.getSession().then(({data})=>setSession(data.session));
  const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));
  return()=>sub.subscription.unsubscribe();
 },[]);
 return session;
}
