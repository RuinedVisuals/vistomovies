import {useEffect,useState} from 'react';
import {isPast} from './derive';
import type {FilmIndex,Showtime} from './types';

export type Section={slug:string;title:string;description?:string;body?:string;sponsor?:string;titles:Set<string>};
type Manual={slug:string;title:string;description?:string;body?:string;sponsor?:string;films?:string[];cinemas?:string[]};
const MIN=3; // an automatic section appears only with enough films to be worth a page

/** Sections derived from the programme itself. Festivals and cycles are curated in public/sections.json. */
export function autoSections(rows:Showtime[],films:FilmIndex,todayIso:string):Section[]{
 // only screenings still to come count: a film that finished earlier this week has nothing to show
 const nowT=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 // cinema counts use the whole week, so a film is not 'rare' just because its last screenings are at one cinema
 const cinemasBy=new Map<string,Set<string>>();for(const r of rows)(cinemasBy.get(r.movie)??cinemasBy.set(r.movie,new Set()).get(r.movie)!).add(r.cinema);
 rows=rows.filter(r=>!isPast(r,todayIso,nowT));
 const titles=[...new Set(rows.map(r=>r.movie))];
 const since=new Date(Date.parse(todayIso)-21*864e5).toISOString().slice(0,10);
 const fresh=new Set(titles.filter(t=>{const d=films[t]?.releaseDate;return !!d&&d>=since&&d<=todayIso}));
 const top=new Set(titles.filter(t=>{const m=films[t];return !!m&&m.vote!=null&&m.vote>=7.5&&m.voteCount>=300}));
 const rare=new Set(titles.filter(t=>cinemasBy.get(t)!.size===1));
 const reissue=new Set(Object.entries(films).filter(([,m])=>m?.badge).map(([t])=>t));
 const midnight=new Set(rows.filter(r=>r.afterMidnight||r.time>='23:30').map(r=>r.movie));
 return ([{slug:'epanekdoseis',title:'Επανεκδόσεις',description:'Κλασικές ταινίες που ξαναπαίζονται στη μεγάλη οθόνη.',titles:reissue},{slug:'metamesonyxties',title:'Μεταμεσονύχτιες προβολές',description:'Προβολές μετά τις 23:30.',titles:midnight},
  {slug:'nees-tainies',title:'Νέες ταινίες',description:'Βγήκαν τις τελευταίες τρεις εβδομάδες.',titles:fresh},
  {slug:'ypsili-vathmologia',title:'Οι πιο αγαπημένες',description:'Ταινίες με βαθμολογία 7,5 και πάνω στο TMDB.',titles:top},
  {slug:'spanies-provoles',title:'Σπάνιες προβολές',description:'Παίζονται σε ένα μόνο σινεμά της Αθήνας.',titles:rare}] as Section[]).filter(s=>s.titles.size>=MIN);
}

export function useSections(rows:Showtime[],films:FilmIndex,todayIso:string):Section[]{
 const [manual,setManual]=useState<Manual[]>([]);
 useEffect(()=>{const c=new AbortController();
  fetch('/sections.json',{signal:c.signal}).then(r=>r.ok&&r.headers.get('content-type')?.includes('json')?r.json():null).then(d=>setManual(d?.sections||[])).catch(()=>{});
  return()=>c.abort()},[]);
 return [...autoSections(rows,films,todayIso),...manual.map(m=>({slug:m.slug,title:m.title,description:m.description,body:m.body,sponsor:m.sponsor,
  // a section lists hand-picked films and/or everything a given cinema is showing (e.g. a promoted cinema)
  titles:new Set([...(m.films||[]),...rows.filter(r=>m.cinemas?.includes(r.cinema)).map(r=>r.movie)])}))];
}
