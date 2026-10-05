import type {Catalog,FilmIndex,FilmMeta,Region,Showtime,Venue,Version} from './types';
import {addDays,filmKey,normalize,nowTime} from './types';
import {km} from './geo';

// ---------- row facts ----------
export const version=(r:Showtime):Version=>r.version||(/μεταγλ/i.test(r.rawSchedule)?'dubbed':/(?<![\w])3D(?![\w])/.test(r.rawSchedule)?'3d':'subtitled');
export const VERSION_LABEL:Record<Version,string>={subtitled:'Υπότιτλοι',dubbed:'Μεταγλώττιση','3d':'3D'};
export const VERSION_SHORT:Record<Version,string>={subtitled:'Υπότιτλοι',dubbed:'Μεταγλ.','3d':'3D'};
export type HallType='summer'|'indoor';
/** Hall type from the screen name; rows without a screen fall back to the cinema's summer flag. */
export const hallType=(r:Pick<Showtime,'screen'>,v?:{summer:boolean}|null):HallType=>/Θεριν/.test(r.screen||'')||(!r.screen&&!!v?.summer)?'summer':'indoor';
export const HALL_LABEL:Record<HallType,string>={summer:'Θερινή',indoor:'Κλειστή'};
/** After-midnight times (<06:00) belong to the end of the programme day. */
export const timeKey=(t:string)=>t<'06:00'?'3'+t:t;
export const sortTimes=(ts:string[])=>[...new Set(ts)].sort((a,b)=>timeKey(a).localeCompare(timeKey(b)));
export const uniq=<T,>(a:T[])=>[...new Set(a)];
export function groupBy<T>(list:T[],f:(x:T)=>string){const m=new Map<string,T[]>();for(const x of list){const k=f(x);const a=m.get(k);if(a)a.push(x);else m.set(k,[x])}return m}

// ---------- dates ----------
const WD=['Κυρ','Δευ','Τρί','Τετ','Πέμ','Παρ','Σάβ'],WDF=['Κυριακής','Δευτέρας','Τρίτης','Τετάρτης','Πέμπτης','Παρασκευής','Σαββάτου'];
const d12=(x:string)=>new Date(x+'T12:00:00Z');
export const wd=(x:string)=>WD[d12(x).getUTCDay()];
export const wdGen=(x:string)=>WDF[d12(x).getUTCDay()];
export const dm=(x:string)=>{const d=d12(x);return d.getUTCDate()+'/'+(d.getUTCMonth()+1)};
export const shortDay=(x:string)=>wd(x)+' '+dm(x);
export const dayScope=(x:string,todayIso:string)=>x===todayIso?'σήμερα':x===addDays(todayIso,1)?'αύριο':shortDay(x);
export const longDate=(x:string)=>{const s=new Intl.DateTimeFormat('el-GR',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(d12(x));return s.charAt(0).toUpperCase()+s.slice(1).replace(',','')};
export const clock=(iso:string|null|undefined)=>iso?new Intl.DateTimeFormat('el-GR',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso)):'—';
export const updatedLabel=(iso:string|null|undefined,todayIso:string)=>{
 if(!iso)return '—';const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Athens'}).format(new Date(iso));
 return (day===todayIso?'σήμερα ':day===addDays(todayIso,-1)?'χθες ':shortDay(day)+' ')+clock(iso);
};
export const runtimeLabel=(m:number|null|undefined)=>m?Math.floor(m/60)+'ω '+(m%60)+'λ':'';

// ---------- film identity / routes ----------
const GR:Record<string,string>={α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o'};
export const slugify=(s:string)=>normalize(s).split('').map(c=>GR[c]??c).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'film';
const hash=(s:string)=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))|0;return (h>>>0).toString(36)};
export function filmRoute(r:Pick<Showtime,'movie'|'movieSourceUrl'>){
 const m=r.movieSourceUrl?.match(/\/movie\/([^/]+?)-(\d+)\/?$/);
 return m?{id:m[2],slug:m[1].replace(/_/g,'-')}:{id:'t'+hash(r.movie),slug:slugify(r.movie)};
}

// ---------- filters ----------
export type TimeFilter='all'|'now'|'20'|'22';
export type Filters={range:boolean;area:Region[];time:TimeFilter;type:HallType[];ver:Version[];genre:string[];maxKm:number|null};
export const EMPTY_FILTERS:Filters={range:false,area:[],time:'all',type:[],ver:[],genre:[],maxKm:null};
export const activeGroups=(f:Filters,day:string,todayIso:string)=>[f.range||day!==todayIso,f.area.length,f.time!=='all',f.type.length,f.ver.length,f.genre.length,f.maxKm!=null].filter(Boolean).length;
export type Ctx={venues:Map<string,Venue>;films:FilmIndex;todayIso:string;userLoc:[number,number]|null};
/** Days covered by the date part of the filters. */
export const scopeDays=(f:Filters,day:string,todayIso:string,weekEnd:string)=>{
 if(!f.range)return [day];const out:string[]=[];for(let d=todayIso;d<=weekEnd&&out.length<8;d=addDays(d,1))out.push(d);return out.length?out:[day];
};
export function matchRow(r:Showtime,f:Filters,ctx:Ctx,q=''){
 const v=ctx.venues.get(r.cinema);
 if(f.area.length&&!(v&&f.area.includes(v.region)))return false;
 if(f.time==='now'&&r.programmeDate===ctx.todayIso&&!r.afterMidnight&&r.time<nowTime())return false;
 if((f.time==='20'||f.time==='22')&&!r.afterMidnight&&r.time<(f.time==='20'?'20:00':'22:00'))return false;
 if(f.type.length&&!f.type.includes(hallType(r,v)))return false;
 if(f.ver.length&&!f.ver.includes(version(r)))return false;
 if(f.genre.length){const g=ctx.films[r.movie]?.genres||[];if(!f.genre.some(x=>g.includes(x)))return false}
 if(f.maxKm!=null&&ctx.userLoc){const k=v?km(v,ctx.userLoc):null;if(k==null||k>f.maxKm)return false}
 if(q){const n=normalize(q);if(!normalize(r.movie+' '+(ctx.films[r.movie]?.originalTitle||'')+' '+r.cinema+' '+(v?.area||'')+' '+(v?.address||'')).includes(n))return false}
 return true;
}

// ---------- film summaries ----------
export type FilmSummary={key:string;title:string;id:string;slug:string;meta:FilmMeta|null|undefined;rows:Showtime[];cinemas:number;times:string[];poster:string|null;genre:string|null};
export function summarize(rows:Showtime[],films:FilmIndex,catalog:Catalog):FilmSummary[]{
 return [...groupBy(rows,r=>r.movie)].map(([title,rs])=>{
  const meta=films[title],cat=catalog.movies[filmKey(rs[0])];
  return {key:filmKey(rs[0]),title,...filmRoute(rs[0]),meta,rows:rs,cinemas:uniq(rs.map(r=>r.cinema)).length,times:sortTimes(rs.map(r=>r.time)),
   poster:cat?.poster||null,genre:meta?.genres[0]||cat?.genre||null};
 }).sort((a,b)=>b.cinemas-a.cinemas||a.title.localeCompare(b.title,'el'));
}
export const filmSub=(f:FilmSummary)=>{
 const m=f.meta;if(!m)return m===null?'τίτλος από το πρόγραμμα · χωρίς αντιστοίχιση':f.genre||'';
 return [m.originalTitle&&normalize(m.originalTitle)!==normalize(f.title)?m.originalTitle:null,m.year,runtimeLabel(m.runtime),m.genres[0]].filter(Boolean).join(' · ');
};

// ---------- cinema status ----------
export type CinemaInfo={has:boolean;rows:Showtime[];types:HallType[];status:string;statusClass:string;today:string};
export function cinemaInfo(v:Venue,dayRows:Showtime[]):CinemaInfo{
 const has=dayRows.length>0;const types=has?uniq(dayRows.map(r=>hallType(r,v))):[v.summer?'summer' as const:'indoor' as const];
 const films=uniq(dayRows.map(r=>r.movie)).length;
 return {has,rows:dayRows,types,status:has?'Με πρόγραμμα':v.summer?'Θερινός':'Άγνωστη κατάσταση',statusClass:has?'tag tag-accent':v.summer?'tag tag-neutral':'tag tag-outline',
  today:has?`${films} ${films===1?'ταινία':'ταινίες'} · ${dayRows.length} ${dayRows.length===1?'προβολή':'προβολές'} σήμερα`:'Δεν έχουμε πρόγραμμα από αυτή την πηγή για σήμερα'};
}
export const cinemaRoute=(v:Venue)=>`/cinemas/${v.id}/${slugify(v.name)}`;
