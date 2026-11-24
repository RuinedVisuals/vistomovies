import {useEffect,useState} from 'react';
import type {FilmIndex,Showtime} from './types';

export type Section={slug:string;title:string;titles:Set<string>};
type Manual={slug:string;title:string;films:string[]};
const MIN=3; // an automatic section appears only with enough films to be worth a page

/** Sections derived from the programme itself. Festivals and cycles are curated in public/sections.json. */
export function autoSections(rows:Showtime[],films:FilmIndex):Section[]{
 const reissue=new Set(Object.entries(films).filter(([,m])=>m?.badge).map(([t])=>t));
 const midnight=new Set(rows.filter(r=>r.afterMidnight||r.time>='23:30').map(r=>r.movie));
 return ([{slug:'epanekdoseis',title:'Επανεκδόσεις',titles:reissue},{slug:'metamesonyxties',title:'Μεταμεσονύχτιες προβολές',titles:midnight}] as Section[]).filter(s=>s.titles.size>=MIN);
}

export function useSections(rows:Showtime[],films:FilmIndex):Section[]{
 const [manual,setManual]=useState<Manual[]>([]);
 useEffect(()=>{const c=new AbortController();
  fetch('/sections.json',{signal:c.signal}).then(r=>r.ok&&r.headers.get('content-type')?.includes('json')?r.json():null).then(d=>setManual(d?.sections||[])).catch(()=>{});
  return()=>c.abort()},[]);
 return [...autoSections(rows,films),...manual.map(m=>({slug:m.slug,title:m.title,titles:new Set(m.films)}))];
}
