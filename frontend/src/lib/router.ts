import {useSyncExternalStore} from 'react';

// Minimal History-API router: the URL is the source of truth for screen + filter state.
const EVENT='visto:navigate';
const subscribe=(cb:()=>void)=>{window.addEventListener('popstate',cb);window.addEventListener(EVENT,cb);return()=>{window.removeEventListener('popstate',cb);window.removeEventListener(EVENT,cb)}};
const snapshot=()=>location.pathname+location.search;

export function navigate(to:string,opts:{replace?:boolean}={}){
 if(to===snapshot())return;
 history[opts.replace?'replaceState':'pushState']({from:snapshot()},'',to);
 window.dispatchEvent(new Event(EVENT));
}
/** Go back inside the app when there is history, else to a fallback route. */
export function back(fallback:string){if(history.state?.from)history.back();else navigate(fallback,{replace:true})}

export function useRoute(){
 const url=useSyncExternalStore(subscribe,snapshot);
 const u=new URL(url,location.origin);
 return {path:u.pathname,parts:u.pathname.split('/').filter(Boolean),query:u.searchParams};
}
/** Replace query params on the current path (null/empty removes). */
export function setQuery(patch:Record<string,string|string[]|null|undefined>,opts:{replace?:boolean}={replace:true}){
 const q=new URLSearchParams(location.search);
 for(const [k,v] of Object.entries(patch)){
  q.delete(k);
  if(Array.isArray(v))v.forEach(x=>q.append(k,x));else if(v)q.set(k,v);
 }
 const s=q.toString();navigate(location.pathname+(s?'?'+s:''),opts);
}
