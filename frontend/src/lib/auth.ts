import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';

const url=import.meta.env.VITE_SUPABASE_URL as string|undefined,key=import.meta.env.VITE_SUPABASE_KEY as string|undefined;

export type Providers={google:boolean;apple:boolean};
/** Which OAuth providers are switched on in the Supabase project (public settings endpoint). null while loading. */
export function useProviders(){
 const [p,setP]=useState<Providers|null>(null);
 useEffect(()=>{
  if(!url||!key)return;const c=new AbortController();
  fetch(url+'/auth/v1/settings',{headers:{apikey:key},signal:c.signal}).then(r=>r.json())
   .then(d=>setP({google:!!d.external?.google,apple:!!d.external?.apple})).catch(()=>{if(!c.signal.aborted)setP({google:false,apple:false})});
  return()=>c.abort();
 },[]);
 return p;
}

/** Supabase error → Greek message the user can act on. */
export function authError(message:string|undefined){
 const m=(message||'').toLowerCase();
 if(m.includes('invalid login'))return 'Λάθος email ή κωδικός.';
 if(m.includes('not confirmed'))return 'Το email δεν έχει επιβεβαιωθεί ακόμη. Έλεγξε το inbox σου.';
 if(m.includes('already registered')||m.includes('already been registered'))return 'Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδέσου.';
 if(m.includes('rate limit')||m.includes('too many')||m.includes('after'))return 'Πολλές προσπάθειες. Δοκίμασε ξανά σε λίγο.';
 if(m.includes('expired')||m.includes('invalid'))return 'Ο κωδικός δεν είναι σωστός ή έχει λήξει.';
 if(m.includes('at least'))return 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.';
 if(m.includes('same password'))return 'Ο νέος κωδικός πρέπει να διαφέρει από τον τρέχοντα.';
 if(m.includes('failed to fetch')||m.includes('network'))return 'Δεν υπάρχει σύνδεση. Δοκίμασε ξανά.';
 return 'Κάτι πήγε στραβά. Δοκίμασε ξανά.';
}

export const validEmail=(s:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
export const USERNAME=/^[a-z0-9_]{3,20}$/;

/** Name shown for the signed-in user: profile/Google name, else the email's local part. */
export const displayName=(s:Session|null|undefined)=>{
 const u=s?.user;if(!u)return '';
 const meta=(u.user_metadata||{}) as Record<string,string|undefined>;
 return meta.full_name||meta.name||(u.email||'').split('@')[0]||'';
};
export const initialOf=(s:Session|null|undefined)=>(displayName(s).trim().charAt(0)||'?').toUpperCase();
