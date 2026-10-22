import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {BellSimple,UserCircle,MapPin,CaretDown,MagnifyingGlass,SlidersHorizontal,ClockCounterClockwise,X,Info,CalendarDots} from '@phosphor-icons/react';
import type {Catalog,Cinema,FilmIndex,History,Region,Showtime,WeekData} from './lib/types';
import {today} from './lib/types';
import {getCatalog,getCinemas,getFilms,getHistory,getWeek,tmdbImage} from './lib/data';
import {toVenue,SYNTAGMA,km,kmLabel} from './lib/geo';
import {AppContext,useApp,type AppData} from './lib/context';
import {usePersistedSet} from './lib/store';
import {supabase,useSession} from './lib/supabase';
import {usePlans} from './lib/plans';
import Plans from './components/Plans';
import Onboarding,{onboardingSeen} from './components/Onboarding';
import {Privacy,Terms} from './components/Legal';
import Avatar from './components/Avatar';
import AuthSheet from './components/AuthSheet';
import ProfileSheet from './components/ProfileSheet';
import {navigate,setQuery,useRoute} from './lib/router';
import {useEntrance,pop} from './lib/motion';
import {activeGroups,EMPTY_FILTERS,filmFlags,filmRoute,filmSub,groupBy,longDate,matchRow,scopeDays,shortDay,dayScope,summarize,timeKey,updatedLabel,cinemaRoute,type Filters,type FilmSummary,type HallType,type TimeFilter} from './lib/derive';
import type {Version} from './lib/types';
import {BottomNav,DateStrip,HeartButton,Link,Poster,Segmented,SkeletonRows,TimeChips} from './components/ui';
import FilterSheet from './components/FilterSheet';
import Details from './components/Details';
import {Cinemas,CinemaPage} from './components/Cinemas';
import Saved from './components/Saved';
import Status from './components/Status';
import {applyUpdate} from './lib/pwa';
const MapScreen=lazy(()=>import('./components/Map'));

// ---------- URL ⇄ filters ----------
export function readFilters(q:URLSearchParams):Filters{
 const km=Number(q.get('km'));
 return {range:q.get('range')==='week',area:q.getAll('area') as Region[],time:(q.get('time')||'all') as TimeFilter,type:q.getAll('type') as HallType[],
  ver:q.getAll('ver') as Version[],genre:q.getAll('genre'),maxKm:km>0?km:null,end:[22,23,24].includes(Number(q.get('end')))?Number(q.get('end')):null};
}
export const filtersQuery=(f:Filters)=>({range:f.range?'week':null,area:f.area,time:f.time==='all'?null:f.time,type:f.type,ver:f.ver,genre:f.genre,km:f.maxKm?String(f.maxKm):null,end:f.end?String(f.end):null});

export default function ShowtimesApp(){
 const [week,setWeek]=useState<WeekData|null>(null),[mode,setMode]=useState<'api'|'snapshot'>('api'),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [cinemas,setCinemas]=useState<Cinema[]>([]),[catalog,setCatalog]=useState<Catalog>({movies:{}}),[films,setFilms]=useState<FilmIndex>({}),[history,setHistory]=useState<History>({});
 const [userLoc,setUserLoc]=useState<[number,number]|null>(null);
 const session=useSession();const uid=session?.user.id;
 const [sheet,setSheet]=useState<null|'auth'|'reset'|'profile'>(null),[note,setNote]=useState('');
 const openAccount=useCallback(()=>setSheet(session?'profile':'auth'),[session]);
 useEffect(()=>{if(!supabase)return;const {data}=supabase.auth.onAuthStateChange(e=>{if(e==='PASSWORD_RECOVERY')setSheet('reset')});return()=>data.subscription.unsubscribe()},[]);
 useEffect(()=>{if(!note)return;const t=setTimeout(()=>setNote(''),2600);return()=>clearTimeout(t)},[note]);
 const savedFilms=usePersistedSet('savedFilms',uid),favCinemas=usePersistedSet('favCinemas',uid);
 const todayIso=today();
 const plans=usePlans(uid,todayIso);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError('');
  getWeek(c.signal).then(r=>{setWeek(r.data);setMode(r.mode)}).catch(e=>{if(!c.signal.aborted)setError(e.message)}).finally(()=>{if(!c.signal.aborted)setLoading(false)});
  return()=>c.abort()},[attempt]);
 useEffect(()=>{const c=new AbortController();
  getCinemas(c.signal).then(setCinemas).catch(()=>{});getCatalog(c.signal).then(setCatalog).catch(()=>{});getHistory(c.signal).then(setHistory);getFilms(c.signal,setFilms);
  return()=>c.abort()},[]);
 const locate=useCallback(()=>new Promise<[number,number]|null>(res=>{
  if(!navigator.geolocation)return res(null);
  navigator.geolocation.getCurrentPosition(p=>{const loc:[number,number]=[p.coords.longitude,p.coords.latitude];setUserLoc(loc);res(loc)},()=>res(null),{enableHighAccuracy:true,timeout:10000});
 }),[]);
 const value=useMemo<AppData>(()=>{
  const venues=cinemas.map(toVenue);
  return {week,mode,loading,error,retry:()=>setAttempt(a=>a+1),rows:week?.showtimes||[],venues,venueByName:new Map(venues.map(v=>[v.name,v])),venueById:new Map(venues.map(v=>[v.id,v])),
   films,catalog,history,session,openAccount,plans,notify:setNote,todayIso,userLoc,locate,savedFilms,favCinemas};
 },[week,mode,loading,error,cinemas,films,catalog,history,session,openAccount,plans,setNote,todayIso,userLoc,locate,savedFilms,favCinemas]);
 const {parts}=useRoute();
 const [section,id]=parts;
 const [onboard,setOnboard]=useState(()=>!onboardingSeen());
 // A shared film/plan link or a legal page goes straight to its content.
 const showOnboarding=onboard&&!id&&section!=='privacy'&&section!=='terms'&&section!=='add'&&!loading;
 useEffect(()=>{if(!section)navigate('/movies'+location.search,{replace:true})},[section]);
 useEffect(()=>{if(section==='add'&&id)navigate('/saved?tab=friends&add='+encodeURIComponent(id),{replace:true})},[section,id]);
 return <AppContext.Provider value={value}><div className="app">
  <div className="status-fade" aria-hidden="true"/>
  <UpdateToast/>
  {note&&<div className="toast note" role="status">{note}</div>}
  {showOnboarding&&<Onboarding onDone={()=>setOnboard(false)}/>}
  {sheet==='auth'&&<AuthSheet onClose={()=>setSheet(null)} onDone={setNote}/>}
  {sheet==='reset'&&<AuthSheet initial="reset" onClose={()=>setSheet(null)} onDone={setNote}/>}
  {sheet==='profile'&&<ProfileSheet onClose={()=>setSheet(null)} onDone={setNote}/>}
  {(section==='movies'||!section)&&<Feed/>}
  {section==='movies'&&id&&<Details key={id} id={id}/>}
  {section==='cinemas'&&(id?<CinemaPage key={id} id={id}/>:<Cinemas/>)}
  {section==='map'&&<Suspense fallback={<div className="map-screen"/>}><MapScreen/></Suspense>}
  {section==='saved'&&<Saved/>}
  {section==='status'&&<Status/>}
  {section==='plans'&&<Plans/>}
  {section==='privacy'&&<Privacy/>}
  {section==='terms'&&<Terms/>}
  {section&&!['movies','cinemas','map','saved','status','add','plans','privacy','terms'].includes(section)&&<NotFound/>}
  {!(section==='cinemas'&&id)&&section!=='privacy'&&section!=='terms'&&<BottomNav active={section==='cinemas'?1:section==='map'?2:section==='saved'||section==='add'||section==='plans'?3:0}/>}
 </div></AppContext.Provider>;
}

const useOnline=()=>useSyncExternalStore(cb=>{addEventListener('online',cb);addEventListener('offline',cb);return()=>{removeEventListener('online',cb);removeEventListener('offline',cb)}},()=>navigator.onLine);

/** Offered after a new build is installed in the background; applying it reloads the page. */
function UpdateToast(){
 const [ready,setReady]=useState(false);
 useEffect(()=>{const on=()=>setReady(true);addEventListener('visto:update',on);return()=>removeEventListener('visto:update',on)},[]);
 return ready?<div className="toast" role="status"><span>Νέα έκδοση διαθέσιμη</span><button type="button" onClick={()=>applyUpdate(true)}>Ανανέωση</button></div>:null;
}

function NotFound(){return <main className="screen"><div className="page-head"><h1>Δεν βρέθηκε</h1></div><p className="pad muted" style={{marginTop:12}}><Link to="/movies">Πίσω στις ταινίες</Link></p></main>}

/** Earliest show still ahead (for today), else the first of the day. */
export const nextTime=(times:string[],day:string,todayIso:string,now:string)=>day!==todayIso?times[0]:times.find(t=>timeKey(t)>=timeKey(now))||times[0];

// ---------- 01 Τι παίζει ----------
const HOME_REGIONS:(Region|null)[]=[null,'Κέντρο','Βόρεια','Νότια','Πειραιάς'];
const SORTS=[['cinemas','Περισσότερα σινεμά'],['next','Επόμενη προβολή'],['title','Αλφαβητικά']] as const;
function Feed(){
 const app=useApp();const {query}=useRoute();const ref=useRef<HTMLElement>(null);
 const {rows,week,films,catalog,history,todayIso,venueByName,userLoc,loading,error,mode}=app;
 const day=query.get('date')||todayIso;const f=readFilters(query);const q=query.get('q')||'';
 const sort=(query.get('sort')||'cinemas') as typeof SORTS[number][0];
 const view=query.get('view')==='cinemas'?1:0;
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
 const weekByMovie=useMemo(()=>groupBy(rows,r=>r.movie),[rows]);
 const flagsFor=(m:FilmSummary)=>filmFlags(m.title,weekByMovie.get(m.title)||[],week,todayIso,history,m.meta);
 const anyMeta=Object.values(films).some(Boolean);
 const featured=(anyMeta?[...list].filter(m=>m.meta).sort((a,b)=>(b.meta!.voteCount-a.meta!.voteCount)||b.cinemas-a.cinemas):[...list].sort((a,b)=>b.cinemas-a.cinemas).filter(m=>m.poster)).slice(0,8);
 const nextUp=useMemo(()=>{if(day!==todayIso)return null;let best:{m:FilmSummary;t:string}|null=null;
  for(const m of list)for(const t of m.times)if(timeKey(t)>=timeKey(now)&&(!best||timeKey(t)<timeKey(best.t)))best={m,t};return best},[list,day,todayIso,now]);
 const outside=day>weekEnd||(!!week&&day<week.weekStart);
 const scopeLabel=f.range?'έως '+shortDay(weekEnd):dayScope(day,todayIso);
 const badge=activeGroups(f,day,todayIso);
 const filmTo=(m:FilmSummary)=>`/movies/${m.id}/${m.slug}${location.search}`;
 useEntrance(ref,[loading,view]);
 const carousel=useRef<HTMLDivElement>(null);const featKey=featured.map(m=>m.key).join();
 useEffect(()=>{carousel.current?.scrollTo({left:0})},[featKey]);
 return <main className="screen" ref={ref}>
  <div data-a className="brand-row"><Link to="/movies" className="brand" aria-label="Visto αρχική">visto<span>.</span></Link>
   <div style={{display:'flex',gap:8,alignItems:'center'}}><button type="button" className="loc-pill" onClick={()=>app.locate()} title="Χρήση της τοποθεσίας σου για αποστάσεις"><MapPin className="pin" weight={userLoc?'fill':'regular'}/>Αθήνα<CaretDown size={11} color="var(--color-neutral-500)"/></button>
    {app.session&&<Link to="/plans" className="bell-btn" aria-label={`Σχέδια${app.plans.pending.length?` (${app.plans.pending.length} νέες προσκλήσεις)`:''}`}><BellSimple weight={app.plans.pending.length?'fill':'regular'}/>{app.plans.pending.length>0&&<span className="badge">{app.plans.pending.length}</span>}</Link>}
    {supabase&&app.session!==undefined&&<button type="button" className={'acct-btn'+(app.session?' in':'')} onClick={app.openAccount} aria-label={app.session?'Λογαριασμός':'Σύνδεση'}>{app.session?<Avatar session={app.session} size={34}/>:<UserCircle size={20}/>}</button>}</div></div>
  <div data-a style={{padding:'18px 20px 0'}}><div style={{fontSize:13,color:'var(--color-neutral-400)'}}>{longDate(day)}</div><h1 style={{fontSize:34,marginTop:2}}>{day===todayIso&&!f.range?'Τι παίζει απόψε':'Τι παίζει'}</h1></div>
  <div data-a style={{paddingTop:16}}><DateStrip className="pad" value={f.range?'':day} todayIso={todayIso} weekStart={week?.weekStart} weekEnd={week?.weekEnd} onPick={d=>setQuery({date:d===todayIso?null:d,range:null})}/></div>
  <div data-a style={{display:'flex',gap:8,padding:'14px 20px 0'}}>
   <label className="search"><MagnifyingGlass size={17}/><span className="sr-only">Αναζήτηση</span><input type="search" value={q} placeholder="Ταινία, σινεμά ή γειτονιά" onChange={e=>setQuery({q:e.target.value})}/>
    {q&&<button type="button" className="clear" aria-label="Καθαρισμός αναζήτησης" onClick={()=>setQuery({q:null})}><X size={15}/></button>}</label>
   <button type="button" className="icon-btn accent" aria-label={'Φίλτρα'+(badge?` (${badge} ενεργά)`:'')} aria-haspopup="dialog" onClick={()=>setSheet(true)}><SlidersHorizontal/>{badge>0&&<span className="badge">{badge}</span>}</button>
  </div>
  <div data-a className="hscroll chip-row pad" style={{paddingTop:12}}>{HOME_REGIONS.map(r=>{const on=r?f.area.length===1&&f.area[0]===r:!f.area.length;
   return <button key={r||'all'} type="button" className="chip" aria-pressed={on} onClick={e=>{setQuery({area:r?[r]:null});pop(e.currentTarget,.9)}}>{r||'Όλη η Αθήνα'}</button>})}</div>
  <div data-a className="pad" style={{paddingTop:12}}><Segmented label="Προβολή" options={['Ταινίες','Σινεμά']} value={view} onChange={i=>setQuery({view:i?'cinemas':null})}/></div>
  {!loading&&<SourceNotice/>}
  {loading?<div className="pad" style={{paddingTop:20}}><SkeletonRows/></div>:error?<div className="pad" style={{paddingTop:24}}><div className="empty-card" role="alert"><strong style={{marginTop:0}}>{error}</strong><button className="btn btn-primary" style={{marginTop:12}} onClick={app.retry}>Δοκίμασε ξανά</button></div></div>:<>
   {nextUp&&!q&&!view&&<div data-a className="pad" style={{paddingTop:18}}><Link to={filmTo(nextUp.m)} className="hero-card">
    <Poster className="hero-img" src={tmdbImage(nextUp.m.meta?.backdropPath,'w780')||tmdbImage(nextUp.m.meta?.posterPath,'w500')||nextUp.m.poster} title={nextUp.m.title}/>
    <div className="shade"/><div className="info"><span className="when-pill">{untilLabel(nextUp.t,now)}</span>
     <div className="t">{nextUp.m.title}</div><div className="m">{nextUp.t} · {nextUp.m.cinemas} σινεμά{nextUp.m.meta?.vote!=null&&` · ★ ${nextUp.m.meta.vote.toFixed(1)}`}</div></div></Link></div>}
   {featured.length>0&&!q&&!view&&<>
    <div data-a className="section-head pad" style={{padding:'24px 20px 10px'}}><h2>Δημοφιλείς</h2><span className="aside">κορυφαίες {scopeLabel}</span></div>
    <div ref={carousel} className="hscroll featured">{featured.map(m=><div data-a key={m.key} className="feat-card">
     <Poster src={tmdbImage(m.meta?.posterPath,'w500')||m.poster} title={m.title}/>
     <Link className="open" to={filmTo(m)} aria-label={m.title}/>
     <div className="shade"/>
     <HeartButton on={app.savedFilms.has(m.key)} onToggle={()=>app.savedFilms.toggle(m.key)} title={m.title}/>
     <div className="info"><div className="t">{m.title}</div><div className="m">{m.meta?.vote!=null&&<span className="vote-badge">TMDB {m.meta.vote.toFixed(1)}</span>}<span>{m.cinemas} σινεμά · επόμενη {nextTime(m.times,day,todayIso,now)}</span></div></div>
    </div>)}</div></>}
   <div data-a className="list-head"><h2>{view?`${new Set(scoped.map(r=>r.cinema)).size} σινεμά`:`${list.length} ${list.length===1?'ταινία':'ταινίες'}`} <span>· {scopeLabel}</span></h2>
    <button type="button" className="sort-btn" onClick={()=>{const i=SORTS.findIndex(s=>s[0]===sort);setQuery({sort:i===SORTS.length-1?null:SORTS[i+1][0]})}} aria-label="Αλλαγή ταξινόμησης">{SORTS.find(s=>s[0]===sort)?.[1]}<CaretDown/></button></div>
   <div className="pad">
    {view&&!scoped.length&&<div data-a className="empty-card" style={{marginTop:12}}><CalendarDots size={24} color="var(--color-neutral-500)"/><strong>Κανένα σινεμά με αυτά τα κριτήρια.</strong><p>Δοκίμασε άλλη ημέρα ή λιγότερα φίλτρα.</p></div>}
    {view?<CinemaList rows={scoped} now={now}/>:<div className="film-grid">{list.map(m=><FilmCard key={m.key} m={m} to={filmTo(m)} flags={flagsFor(m)} now={now}/>)}</div>}
    {!list.length&&!view&&<div data-a className="empty-card" style={{marginTop:12}}><CalendarDots size={24} color="var(--color-neutral-500)"/>
     {outside?<><strong>Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτή την ημερομηνία ακόμη.</strong><p>Το πρόγραμμα της νέας εβδομάδας δημοσιεύεται την Πέμπτη.</p></>
      :<><strong>Καμία ταινία με αυτά τα κριτήρια.</strong><p>Δοκίμασε άλλη ημέρα ή λιγότερα φίλτρα.</p><button className="btn btn-secondary" style={{marginTop:12}} onClick={()=>navigate('/movies',{replace:true})}>Καθαρισμός φίλτρων</button></>}</div>}
   </div>
  </>}
  <div className="source-line pad" style={{paddingTop:16}}><ClockCounterClockwise/>Πρόγραμμα: Αθηνόραμα · ενημ. {updatedLabel(week?.checkedAt,todayIso)} · Metadata: TMDB · <Link to="/status">Ποιότητα δεδομένων</Link> · <Link to="/privacy">Απόρρητο</Link> · <Link to="/terms">Όροι</Link></div>
  {sheet&&<FilterSheet filters={f} day={day} onClose={()=>setSheet(false)}/>}
 </main>;
}

/** Data freshness: snapshot fallback, week not yet published, or a failed update. */
function SourceNotice(){
 const {week,mode,todayIso}=useApp();if(!week)return null;
 const src=week.sources.find(s=>s.source==='athinorama');
 // Static hosting (snapshot) is normal; the footer already shows when the programme was updated.
 const online=useOnline();
 const msg=!online?`Είσαι εκτός σύνδεσης. Βλέπεις το πρόγραμμα όπως ενημερώθηκε ${updatedLabel(week.checkedAt,todayIso)}.`:todayIso>week.weekEnd?`Το πρόγραμμα της νέας εβδομάδας δεν έχει δημοσιευτεί ακόμη από την πηγή. Ελέγχουμε ξανά αυτόματα· το τελευταίο διαθέσιμο ήταν έως ${shortDay(week.weekEnd)}.`
  :mode==='api'&&src?.error?`Η τελευταία ενημέρωση δεν ολοκληρώθηκε. Βλέπεις το πρόγραμμα όπως ενημερώθηκε ${updatedLabel(src.lastSuccessAt,todayIso)}.`:'';
 return msg?<div className="notice" data-a role="status"><Info size={15} style={{flex:'none',marginTop:1}}/>{msg}</div>:null;
}

const Flags=({flags}:{flags:{kind:string;label:string}[]})=><>{flags.map(f=><span key={f.kind} className={'flag '+f.kind}>{f.label}</span>)}</>;

/** "Επόμενη σε 25 λεπτά" while it is close, else the clock time. */
function untilLabel(t:string,now:string){
 const [a,b]=t.split(':').map(Number),[c,d]=now.split(':').map(Number);const mins=a*60+b-(c*60+d);
 return mins>=0&&mins<=90?(mins<2?'Ξεκινά τώρα':`Επόμενη σε ${mins} λεπτά`):`Επόμενη στις ${t}`;
}

function FilmCard({m,to,flags,now}:{m:FilmSummary;to:string;flags:{kind:string;label:string}[];now:string}){
 const app=useApp();const noTmdb=m.meta===null;
 return <div data-a className="film-card">
  <Link to={to} className="fc-poster" aria-label={m.title}>
   <Poster src={tmdbImage(m.meta?.posterPath,'w342')||m.poster} title={m.title} striped={noTmdb} label={noTmdb?'χωρίς TMDB':undefined}/>
   {m.meta?.vote!=null&&<span className="fc-vote">★ {m.meta.vote.toFixed(1)}</span>}
   {flags[0]&&<span className={'flag fc-flag '+flags[0].kind}>{flags[0].label}</span>}
  </Link>
  <HeartButton on={app.savedFilms.has(m.key)} onToggle={()=>app.savedFilms.toggle(m.key)} title={m.title} className="heart"/>
  <Link to={to} className="fc-t">{m.title}</Link>
  <div className="fc-s">{m.cinemas} σινεμά{m.meta?.year?` · ${m.meta.year}`:''}</div>
  <div className="times"><TimeChips rows={m.rows} todayIso={app.todayIso} now={now} limit={2}/></div>
 </div>;
}

/** "Ανά σινεμά": nearest cinemas first, each with its films and times. */
function CinemaList({rows,now}:{rows:Showtime[];now:string}){
 const {venueByName,userLoc,todayIso}=useApp();const from=userLoc||SYNTAGMA;
 const cards=useMemo(()=>[...groupBy(rows,r=>r.cinema)].map(([name,rs])=>{const v=venueByName.get(name);
  const films=[...groupBy(rs,r=>r.movie)].map(([title,fr])=>({title,route:filmRoute(fr[0]),rows:fr,first:fr.map(r=>timeKey(r.time)).sort()[0]})).sort((a,b)=>a.first.localeCompare(b.first));
  return {name,v,k:v?km(v,from):null,films};
 }).sort((a,b)=>(a.k??99)-(b.k??99)||a.name.localeCompare(b.name,'el')),[rows,venueByName,from[0],from[1]]);
 return <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>{cards.map(c=><div data-a key={c.name} className="prog-card cinema-block">
  <div className="top"><div style={{minWidth:0}}>{c.v?<Link className="name" to={cinemaRoute(c.v)}>{c.name}</Link>:<span className="name">{c.name}</span>}
   <div className="addr">{c.v?`${c.v.addrShort} · ${c.v.area}`:''}</div></div>
   <span className="dist" title={userLoc?'Από την τοποθεσία σου':'Από Σύνταγμα'}>{kmLabel(c.k)}</span></div>
  {c.films.map(f=><div key={f.title} className="cf"><Link className="ft" to={`/movies/${f.route.id}/${f.route.slug}${location.search}`}>{f.title}</Link>
   <div className="times"><TimeChips rows={f.rows} todayIso={todayIso} now={now}/></div></div>)}
 </div>)}</div>;
}
