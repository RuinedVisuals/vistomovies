import {useCallback,useEffect,useRef,useState} from 'react';
import {supabase} from './supabase';

// Saved films (film key) and favourite cinemas (cinema id), persisted on this device.
// Keys keep the pre-rename 'afterdark.' prefix so existing saved lists survive.
// Web: localStorage. Native: swap read/write for @capacitor/preferences when the native shell is added.
// Signed in: the same lists are mirrored to Supabase (RLS: own rows only); localStorage stays the offline cache.
const KEYS={savedFilms:['afterdark.savedFilms','afterdark.saved'],favCinemas:['afterdark.favCinemas','afterdark.cinemas.saved']} as const;
const REMOTE={savedFilms:{table:'saved_films',col:'film_key'},favCinemas:{table:'fav_cinemas',col:'cinema_id'}} as const;
type Kind=keyof typeof KEYS;
function read(kind:Kind):string[]{
 for(const key of KEYS[kind]){// first key is current, second is the pre-redesign key (migrated on read)
  try{const v=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(v))return v.filter(x=>typeof x==='string')}catch{/* ignore */}
 }
 return [];
}
export function usePersistedSet(kind:Kind,userId?:string|null){
 const [items,setItems]=useState(()=>read(kind));
 const [error,setError]=useState('');
 const latest=useRef(items);latest.current=items;
 const {table,col}=REMOTE[kind];
 const persist=useCallback((next:string[])=>{
  try{localStorage.setItem(KEYS[kind][0],JSON.stringify(next));setError('')}catch{setError('Η λίστα κρατήθηκε μόνο για αυτή τη συνεδρία.')}
 },[kind]);
 // On sign-in: merge the device list with the account list (union), then upload what the account was missing.
 useEffect(()=>{
  if(!supabase||!userId)return;let dead=false;
  (async()=>{
   const {data,error:e}=await supabase!.from(table).select(col);
   if(e||dead)return;
   const remote=(data as unknown as Record<string,string>[]).map(r=>r[col]);
   const local=latest.current,merged=[...new Set([...local,...remote])];
   const missing=local.filter(x=>!remote.includes(x));
   if(missing.length)await supabase!.from(table).upsert(missing.map(v=>({user_id:userId,[col]:v})),{onConflict:`user_id,${col}`});
   if(dead)return;setItems(merged);persist(merged);
  })();
  return()=>{dead=true};
 },[userId,table,col,persist]);
 const toggle=useCallback((id:string)=>{
  const old=latest.current,adding=!old.includes(id);
  const next=adding?[...old,id]:old.filter(x=>x!==id);
  latest.current=next;setItems(next);persist(next);
  if(supabase&&userId){
   const q=adding?supabase.from(table).upsert({user_id:userId,[col]:id},{onConflict:`user_id,${col}`}):supabase.from(table).delete().eq('user_id',userId).eq(col,id);
   q.then(({error:e})=>{if(e)setError('Η αλλαγή δεν συγχρονίστηκε· θα δοκιμάσει ξανά στην επόμενη σύνδεση.')});
  }
 },[userId,table,col,persist]);
 return {items,toggle,has:(id:string)=>items.includes(id),error};
}
