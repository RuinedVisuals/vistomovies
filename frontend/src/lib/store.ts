import {useCallback,useState} from 'react';

// Saved films (film key) and favourite cinemas (cinema id), persisted on this device.
// Keys keep the pre-rename 'afterdark.' prefix so existing saved lists survive.
// Web: localStorage. Native: swap read/write for @capacitor/preferences when the native shell is added.
const KEYS={savedFilms:['afterdark.savedFilms','afterdark.saved'],favCinemas:['afterdark.favCinemas','afterdark.cinemas.saved']} as const;
type Kind=keyof typeof KEYS;
function read(kind:Kind):string[]{
 for(const key of KEYS[kind]){// first key is current, second is the pre-redesign key (migrated on read)
  try{const v=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(v))return v.filter(x=>typeof x==='string')}catch{/* ignore */}
 }
 return [];
}
export function usePersistedSet(kind:Kind){
 const [items,setItems]=useState(()=>read(kind));
 const [error,setError]=useState('');
 const toggle=useCallback((id:string)=>{setItems(old=>{
  const next=old.includes(id)?old.filter(x=>x!==id):[...old,id];
  try{localStorage.setItem(KEYS[kind][0],JSON.stringify(next));setError('')}catch{setError('Η λίστα κρατήθηκε μόνο για αυτή τη συνεδρία.')}
  return next;
 })},[kind]);
 return {items,toggle,has:(id:string)=>items.includes(id),error};
}
