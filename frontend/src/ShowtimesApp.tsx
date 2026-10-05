import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MapPin,CaretDown,MagnifyingGlass,SlidersHorizontal,ClockCounterClockwise,X,Info,CalendarDots} from '@phosphor-icons/react';
import type {Catalog,Cinema,FilmIndex,Region,WeekData} from './lib/types';
import {today} from './lib/types';
import {getCatalog,getCinemas,getFilms,getWeek,tmdbImage} from './lib/data';
import {toVenue,SYNTAGMA} from './lib/geo';
import {AppContext,useApp,type AppData} from './lib/context';
import {usePersistedSet} from './lib/store';
import {navigate,setQuery,useRoute} from './lib/router';
import {useEntrance,pop} from './lib/motion';
import {activeGroups,EMPTY_FILTERS,filmSub,longDate,matchRow,scopeDays,shortDay,dayScope,summarize,timeKey,updatedLabel,type Filters,type FilmSummary,type HallType,type TimeFilter} from './lib/derive';
import type {Version} from './lib/types';
import {BottomNav,DateStrip,HeartButton,Link,Poster,SkeletonRows} from './components/ui';
import FilterSheet from './components/FilterSheet';
import Details from './components/Details';
import {Cinemas,CinemaPage} from './components/Cinemas';
import Saved from './components/Saved';
const MapScreen=lazy(()=>import('./components/Map'));

// ---------- URL ⇄ filters ----------
export function readFilters(q:URLSearchParams):Filters{
 const km=Number(q.get('km'));
 return {range:q.get('range')==='week',area:q.getAll('area') as Region[],time:(q.get('time')||'all') as TimeFilter,type:q.getAll('type') as HallType[],
  ver:q.getAll('ver') as Version[],genre:q.getAll('genre'),maxKm:km>0?km:null};
}
export const filtersQuery=(f:Filters)=>({range:f.range?'week':null,area:f.area,time:f.time==='all'?null:f.time,type:f.type,ver:f.ver,genre:f.genre,km:f.maxKm?String(f.maxKm):null});

export default function ShowtimesApp(){
 const [week,setWeek]=useState<WeekData|null>(null),[mode,setMode]=useState<'api'|'snapshot'>('api'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [cinemas,setCinemas]=useState<Cinema[]>([]),[catalog,setCatalog]=useState<Catalog>({movies:{}}),[films,setFilms]=useState<FilmIndex>({});
 const [userLoc,setUserLoc]=useState<[number,number]|null>(null);
 const savedFilms=usePersistedSet('savedFilms'),favCinemas=usePersistedSet('favCinemas');
 const todayIso=today();
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
  getWeek(c.signal).then(r=>{setWeek(r.data);setMode(r.mode)}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
  return()=>c.abort()},[attempt]);
 useEffect(()=>{const c=new AbortController();
  getCinemas(c.signal).then(setCinemas).catch(()=>{});getCatalog(c.signal).then(setCatalog).catch(()=>{});getFilms(c.signal,setFilms);
  return()=>c.abort()},[]);
 const locate=useCallback(()=>new Promise<[number,number]|null>(res=>{
  if(!navigator.geolocation)return res(null);
  navigator.geolocation.getCurrentPosition(p=>{const loc:[number,number]=[p.coords.longitude,p.coords.latitude];setUserLoc(loc);res(loc)},()=>res(null),{enableHighAccuracy:true,timeout:10000});
 }),[]);
 const value=useMemo<AppData>(()=>{
  const venues=cinemas.map(toVenue);
  return {week,mode,loading,error,retry:()=>setAttempt(a=>a+1),rows:week?.showtimes||[],venues,venueByName:new Map(venues.map(v=>[v.name,v])),venueById:new Map(venues.map(v=>[v.id,v])),
   films,catalog,todayIso,userLoc,locate,savedFilms,favCinemas};
 },[week,mode,loading,error,cinemas,films,catalog,todayIso,userLoc,locate,savedFilms,favCinemas]);
 const {parts}=useRoute();
 const [section,id]=parts;
 useEffect(()=>{if(!section)navigate('/movies'+location.search,{replace:true})},[section]);
 return <AppContext.Provider value={value}><div className="app">
  <div className="status-fade" aria-hidden="true"/>
  {(section==='movies'||!section)&&<Feed/>}
  {section==='movies'&&id&&<Details key={id} id={id}/>}
  {section==='cinemas'&&(id?<CinemaPage key={id} id={id}/>:<Cinemas/>)}
  {section==='map'&&<Suspense fallback={<div className="map-screen"/>}><MapScreen/></Suspense>}
  {section==='saved'&&<Saved/>}
  {section&&!['movies','cinemas','map','saved'].includes(section)&&<NotFound/>}
  {!(section==='cinemas'&&id)&&<BottomNav active={section==='cinemas'?1:section==='map'?2:section==='saved'?3:0}/>}
 </div></AppContext.Provider>;
}

function NotFound(){return <main className="screen"><div className="page-head"><h1>Δεν βρέθηκε</h1></div><p className="pad muted" style={{marginTop:12}}><Link to="/movies">Πίσω στις ταινίες</Link></p></main>}

/** Earliest show still ahead (for today), else the first of the day. */
export const nextTime=(times:string[],day:string,todayIso:string,now:string)=>day!==todayIso?times[0]:times.find(t=>timeKey(t)>=timeKey(now))||times[0];

// ---------- 01 Τι παίζει ----------
const HOME_REGIONS:(Region|null)[]=[null,'Κέντρο','Βόρεια','Νότια','Πειραιάς'];
const SORTS=[['cinemas','Περισσότερα σινεμά'],['next','Επόμενη προβολή'],['title','Αλφαβητικά']] as const;
function Feed(){
 const app=useApp();const {query}=useRoute();const ref=useRef<HTMLElement>(null);
 const {rows,week,films,catalog,todayIso,venueByName,userLoc,loading,error,mode}=app;
 const day=query.get('date')||todayIso;const f=readFilters(query);const q=query.get('q')||'';
 const sort=(query.get('sort')||'cinemas') as typeof SORTS[number][0];
 const [sheet,setSheet]=useState(false);
 const ctx=useMemo(()=>({venues:venueByName,films,todayIso,userLoc}),[venueByName,films,todayIso,userLoc]);
 const weekEnd=week?.weekEnd||todayIso;
 const days=scopeDays(f,day,todayIso,weekEnd);
 const scoped=useMemo(()=>rows.filter(r=>days.includes(r.programmeDate)&&matchRow(r,f,ctx,q)),[rows,days.join(),query.toString(),ctx]);
 const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const list=useMemo(()=>{const l=summarize(scoped,films,catalog);
  if(sort==='title')l.sort((a,b)=>a.title.localeCompare(b.title,'el'));
  if(sort==='next')l.sort((a,b)=>timeKey(nextTime(a.times,day,todayIso,now)).localeCompare(timeKey(nextTime(b.times,day,todayIso,now)))||b.cinemas-a.cinemas);
  return l},[scoped,films,catalog,sort]);
 const anyMeta=Object.values(films).some(Boolean);
 const featured=(anyMeta?[...list].sort((a,b)=>b.cinemas-a.cinemas).filter(m=>m.meta):[...list].sort((a,b)=>b.cinemas-a.cinemas).filter(m=>m.poster)).slice(0,4);
 const outside=day>weekEnd||(!!week&&day<week.weekStart);
 const scopeLabel=f.range?'έως '+shortDay(weekEnd):dayScope(day,todayIso);
 const badge=activeGroups(f,day,todayIso);
 const filmTo=(m:FilmSummary)=>`/movies/${m.id}/${m.slug}${location.search}`;
 useEntrance(ref,[loading]);
 const carousel=useRef<HTMLDivElement>(null);const featKey=featured.map(m=>m.key).join();
 useEffect(()=>{carousel.current?.scrollTo({left:0})},[featKey]);
 return <main className="screen" ref={ref}>
  <div data-a className="brand-row"><Link to="/movies" className="brand" aria-label="Visto αρχική">visto<span>.</span></Link>
   <button type="button" className="loc-pill" onClick={()=>app.locate()} title="Χρήση της τοποθεσίας σου για αποστάσεις"><MapPin className="pin" weight={userLoc?'fill':'regular'}/>Αθήνα<CaretDown size={11} color="var(--color-neutral-500)"/></button></div>
  <div data-a style={{padding:'18px 20px 0'}}><div style={{fontSize:13,color:'var(--color-neutral-400)'}}>{longDate(day)}</div><h1 style={{fontSize:34,marginTop:2}}>Τι παίζει</h1></div>
  <div data-a style={{paddingTop:16}}><DateStrip className="pad" value={f.range?'':day} todayIso={todayIso} weekStart={week?.weekStart} weekEnd={week?.weekEnd} onPick={d=>setQuery({date:d===todayIso?null:d,range:null})}/></div>
  <div data-a style={{display:'flex',gap:8,padding:'14px 20px 0'}}>
   <label className="search"><MagnifyingGlass size={17}/><span className="sr-only">Αναζήτηση</span><input type="search" value={q} placeholder="Ταινία, σινεμά ή γειτονιά" onChange={e=>setQuery({q:e.target.value})}/>
    {q&&<button type="button" className="clear" aria-label="Καθαρισμός αναζήτησης" onClick={()=>setQuery({q:null})}><X size={15}/></button>}</label>
   <button type="button" className="icon-btn accent" aria-label={'Φίλτρα'+(badge?` (${badge} ενεργά)`:'')} aria-haspopup="dialog" onClick={()=>setSheet(true)}><SlidersHorizontal/>{badge>0&&<span className="badge">{badge}</span>}</button>
  </div>
  <div data-a className="hscroll chip-row pad" style={{paddingTop:12}}>{HOME_REGIONS.map(r=>{const on=r?f.area.length===1&&f.area[0]===r:!f.area.length;
   return <button key={r||'all'} type="button" className="chip" aria-pressed={on} onClick={e=>{setQuery({area:r?[r]:null});pop(e.currentTarget,.9)}}>{r||'Όλη η Αθήνα'}</button>})}</div>
  {!loading&&<SourceNotice/>}
  {loading?<div className="pad" style={{paddingTop:20}}><SkeletonRows/></div>:error?<div className="pad" style={{paddingTop:24}}><div className="empty-card" role="alert"><strong style={{marginTop:0}}>{error}</strong><button className="btn btn-primary" style={{marginTop:12}} onClick={app.retry}>Δοκίμασε ξανά</button></div></div>:<>
   {featured.length>0&&!q&&<>
    <div data-a className="section-head pad" style={{padding:'24px 20px 10px'}}><h2>Στο επίκεντρο</h2><span className="aside">περισσότερα σινεμά</span></div>
    <div ref={carousel} className="hscroll featured">{featured.map(m=><div data-a key={m.key} className="feat-card">
     <Poster src={tmdbImage(m.meta?.posterPath,'w342')||m.poster} title={m.title}/>
     <Link className="open" to={filmTo(m)} aria-label={m.title}/>
     <div className="shade"/>
     <HeartButton on={app.savedFilms.has(m.key)} onToggle={()=>app.savedFilms.toggle(m.key)} title={m.title}/>
     <div className="info"><div className="t">{m.title}</div><div className="m">{m.meta?.vote!=null&&<span className="vote-badge">TMDB {m.meta.vote.toFixed(1)}</span>}<span>{m.cinemas} σινεμά · επόμενη {nextTime(m.times,day,todayIso,now)}</span></div></div>
    </div>)}</div></>}
   <div data-a className="list-head"><h2>{list.length} {list.length===1?'ταινία':'ταινίες'} <span>· {scopeLabel}</span></h2>
    <button type="button" className="sort-btn" onClick={()=>{const i=SORTS.findIndex(s=>s[0]===sort);setQuery({sort:i===SORTS.length-1?null:SORTS[i+1][0]})}} aria-label="Αλλαγή ταξινόμησης">{SORTS.find(s=>s[0]===sort)?.[1]}<CaretDown/></button></div>
   <div className="pad">
    {list.map(m=><FilmRow key={m.key} m={m} to={filmTo(m)}/>)}
    {!list.length&&<div data-a className="empty-card" style={{marginTop:12}}><CalendarDots size={24} color="var(--color-neutral-500)"/>
     {outside?<><strong>Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτή την ημερομηνία ακόμη.</strong><p>Το πρόγραμμα της νέας εβδομάδας δημοσιεύεται την Πέμπτη.</p></>
      :<><strong>Καμία ταινία με αυτά τα κριτήρια.</strong><p>Δοκίμασε άλλη ημέρα ή λιγότερα φίλτρα.</p><button className="btn btn-secondary" style={{marginTop:12}} onClick={()=>navigate('/movies',{replace:true})}>Καθαρισμός φίλτρων</button></>}</div>}
   </div>
  </>}
  <div className="source-line pad" style={{paddingTop:16}}><ClockCounterClockwise/>Πρόγραμμα: Αθηνόραμα · ενημ. {updatedLabel(week?.checkedAt,todayIso)} · Metadata: TMDB</div>
  {sheet&&<FilterSheet filters={f} day={day} onClose={()=>setSheet(false)}/>}
 </main>;
}

/** Data freshness: snapshot fallback, week not yet published, or a failed update. */
function SourceNotice(){
 const {week,mode,todayIso}=useApp();if(!week)return null;
 const src=week.sources.find(s=>s.source==='athinorama');
 // Static hosting (snapshot) is normal; the footer already shows when the programme was updated.
 const msg=todayIso>week.weekEnd?`Το πρόγραμμα της νέας εβδομάδας δεν έχει δημοσιευτεί ακόμη από την πηγή. Ελέγχουμε ξανά αυτόματα· το τελευταίο διαθέσιμο ήταν έως ${shortDay(week.weekEnd)}.`
  :mode==='api'&&src?.error?`Η τελευταία ενημέρωση δεν ολοκληρώθηκε. Βλέπεις το πρόγραμμα όπως ενημερώθηκε ${updatedLabel(src.lastSuccessAt,todayIso)}.`:'';
 return msg?<div className="notice" data-a role="status"><Info size={15} style={{flex:'none',marginTop:1}}/>{msg}</div>:null;
}

function FilmRow({m,to}:{m:FilmSummary;to:string}){
 const app=useApp();const noTmdb=m.meta===null;const kicker=noTmdb?'Χωρίς στοιχεία TMDB':m.meta?.badge;
 return <div data-a className="film-row">
  <Link to={to} tabIndex={-1} aria-hidden="true" style={{flex:'none'}}><Poster className="" style={{width:82,height:122,borderRadius:10}} src={tmdbImage(m.meta?.posterPath,'w185')||m.poster} title={m.title} striped={noTmdb} label={noTmdb?'χωρίς TMDB':undefined}/></Link>
  <div className="body">
   <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
    <Link to={to} className="title-btn" style={{flex:1,minWidth:0,color:'inherit',textDecoration:'none'}}>
     {kicker&&<div className="badge-k">{kicker}</div>}<div className="t">{m.title}</div><div className="s">{filmSub(m)}</div></Link>
    <HeartButton on={app.savedFilms.has(m.key)} onToggle={()=>app.savedFilms.toggle(m.key)} title={m.title} className="heart" />
   </div>
   <div className="meta">{m.meta?.vote!=null&&<><b>TMDB {m.meta.vote.toFixed(1)}</b><span style={{color:'var(--color-neutral-700)'}}>•</span></>}<span>{m.cinemas} σινεμά στα φίλτρα σου</span></div>
   <div className="times">{m.times.slice(0,3).map(t=><span key={t} className="time-chip">{t}</span>)}{m.times.length>3&&<span className="more-times">+{m.times.length-3}</span>}</div>
  </div>
 </div>;
}
