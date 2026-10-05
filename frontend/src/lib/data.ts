import type {Catalog,Cinema,FilmIndex,Showtime,WeekData} from './types';
import {addDays} from './types';

const ERROR='Δεν ήταν δυνατή η φόρτωση των προβολών. Δοκίμασε ξανά.';

/** Rows for the whole coverage week (fetched once, not per day) so filters can span days. */
export async function getWeek(signal:AbortSignal):Promise<{data:WeekData;mode:'api'|'snapshot'}>{
 try{
  const r=await fetch('/api/showtimes/week',{signal:AbortSignal.any([signal,AbortSignal.timeout(5000)])});
  if(!r.ok)throw new Error('API unavailable');
  const d=await r.json();if(!Array.isArray(d.showtimes)||!d.showtimes.length||!d.weekStart)throw new Error('Invalid response');
  return {data:{...d,showtimes:d.showtimes.map(withProgrammeDate)},mode:'api'};
 }catch(e){
  if(signal.aborted)throw e;
  const r=await fetch('/snapshot.json',{signal});if(!r.ok)throw new Error(ERROR);
  const d=await r.json().catch(()=>{throw new Error(ERROR)});
  const rows:Showtime[]=(d.showtimes||[]).map(withProgrammeDate);
  const weekStart=rows.map(s=>s.weekStart).filter(Boolean).sort().pop()||rows[0]?.programmeDate;
  if(!weekStart)throw new Error(ERROR);
  const checkedAt=(d.sources||[]).map((s:{checkedAt?:string})=>s.checkedAt).filter(Boolean).sort().pop()||null;
  return {data:{weekStart,weekEnd:addDays(weekStart,6),checkedAt,sources:d.sources||[],showtimes:rows.filter(s=>(s.weekStart||weekStart)===weekStart)},mode:'snapshot'};
 }
}
const withProgrammeDate=(s:Showtime):Showtime=>({...s,programmeDate:s.programmeDate||s.date});

export async function getCinemas(signal:AbortSignal):Promise<Cinema[]>{
 const r=await fetch('/cinemas.json',{signal});if(!r.ok)throw new Error('Δεν φορτώθηκε ο κατάλογος κινηματογράφων.');
 return (await r.json()).cinemas;
}
export async function getCatalog(signal:AbortSignal):Promise<Catalog>{
 const r=await fetch('/catalog.json',{signal});if(!r.ok)return {movies:{}};return r.json();
}

/** TMDB metadata keyed by programme title. The backend fills its cache in the background,
 *  so poll while it reports pending lookups. Failure → empty index (titles render unmatched). */
export async function getFilms(signal:AbortSignal,onUpdate:(f:FilmIndex)=>void){
 for(let attempt=0;attempt<30&&!signal.aborted;attempt++){
  try{
   const r=await fetch('/api/films',{signal});if(!r.ok)return;
   const d=await r.json();onUpdate(d.films||{});
   if(!d.pending)return;
  }catch{return}
  await new Promise(res=>setTimeout(res,attempt<5?2500:6000));
 }
}
export const tmdbImage=(path:string|null|undefined,size:'w185'|'w342'|'w780'|'w1280'='w342')=>path?`https://image.tmdb.org/t/p/${size}${path}`:null;
