import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {CaretLeft,ShareNetwork,PaperPlaneTilt,Play,ArrowUpRight,Translate,NavigationArrow,Sun,Armchair,Ticket,MapTrifold,ArrowsOutSimple,MoonStars,CalendarDots,Clock,CalendarBlank,FilmSlate} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {back,setQuery,useRoute} from '../lib/router';
import {gsap,useEntrance,reducedMotion} from '../lib/motion';
import {tmdbImage} from '../lib/data';
import {SYNTAGMA,km,kmLabel,ticketsUrl} from '../lib/geo';
import {VERSION_SHORT,HALL_LABEL,clock,filmFlags,isPast,dayScope,filmRoute,groupBy,hallType,runtimeLabel,shortDay,uniq,version,wdGen,cinemaRoute} from '../lib/derive';
import {filmKey,nowTime} from '../lib/types';
import type {Showtime} from '../lib/types';
import {DateStrip,HeartButton,Link,Segmented,hueOf} from './ui';
import {PlanSheet} from './Plans';
import type {NewPlan} from '../lib/plans';

const regionName=new Intl.DisplayNames(['el'],{type:'region'}),langName=new Intl.DisplayNames(['el'],{type:'language'});
const safe=(f:()=>string|undefined)=>{try{return f()}catch{return undefined}};
const endClock=(t:string,late:boolean|undefined,rt:number)=>{const [h,m]=t.split(':').map(Number);const x=(h*60+m+rt)%1440;return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0')};
const cap=(s?:string)=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

/** 02 Ταινία — opens as a bottom sheet over the feed. */
export default function Details({id}:{id:string}){
 const app=useApp();const {query}=useRoute();
 const {rows,films,catalog,history,todayIso,week,venueByName,userLoc,savedFilms,session,notify}=app;
 const [tab,setTab]=useState(0);const now=nowTime();
 const programmeRef=useRef<HTMLDivElement>(null),page=useRef<HTMLDivElement>(null),body=useRef<HTMLDivElement>(null),bg=useRef<HTMLImageElement>(null);
 const day=query.get('date')||todayIso;
 const filmRows=useMemo(()=>rows.filter(r=>filmRoute(r).id===id),[rows,id]);
 // A saved film that is no longer in the programme can still be opened.
 const savedKey=savedFilms.items.find(k=>filmRoute({movie:catalog.movies[k]?.title||k,movieSourceUrl:k.startsWith('http')?k:null}).id===id);
 const title=filmRows[0]?.movie||(savedKey&&(catalog.movies[savedKey]?.title||savedKey))||'';
 const key=filmRows[0]?filmKey(filmRows[0]):savedKey||'';
 const meta=films[title];
 const [trailer,setTrailer]=useState<string|null>(null);
 useEffect(()=>{if(!meta?.tmdbId)return;const c=new AbortController();
  fetch('/api/movies/'+meta.tmdbId,{signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{const v=d?.videos?.results?.find((v:{site:string;type:string;key:string})=>v.site==='YouTube'&&v.type==='Trailer'&&/^[\w-]+$/.test(v.key));if(v)setTrailer(v.key)}).catch(()=>{});
  return()=>c.abort()},[meta?.tmdbId]);

 // Sheet entrance, body scroll lock, Escape, backdrop parallax.
 useEffect(()=>{
  const el=page.current!;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const t=gsap.fromTo(el,{yPercent:reducedMotion()?0:100,opacity:reducedMotion()?0:1},{yPercent:0,opacity:1,duration:.6,ease:'expo.out',clearProps:'transform'});
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')back('/movies'+location.search)};document.addEventListener('keydown',key);
  const scroll=()=>{if(bg.current&&!reducedMotion())bg.current.style.transform=`translateY(${el.scrollTop*.4}px)`};el.addEventListener('scroll',scroll,{passive:true});
  el.focus();
  return()=>{t.kill();document.body.style.overflow=overflow;document.removeEventListener('keydown',key);el.removeEventListener('scroll',scroll)};
 },[]);
 useEntrance(body,[title,!!meta]);

 const from=userLoc||SYNTAGMA;
 const dayRows=filmRows.filter(r=>r.programmeDate===day);
 const programme=[...groupBy(dayRows,r=>r.cinema)].map(([name,rs])=>{
  const v=venueByName.get(name);const types=uniq(rs.map(r=>hallType(r,v)));const screens=uniq(rs.map(r=>r.screen).filter(Boolean)) as string[];
  return {name,v,k:v?km(v,from):null,types,screens,booking:rs.find(r=>r.bookingUrl)?.bookingUrl||null,
   times:[...rs].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time))};
 }).sort((a,b)=>(a.k??99)-(b.k??99)||a.name.localeCompare(b.name,'el'));
 const pins=programme.map(p=>p.v).filter(v=>v&&v.lng!=null&&v.lat!=null) as {lng:number;lat:number}[];
 const late=dayRows.find(r=>r.afterMidnight);
 const outside=!!week&&(day>week.weekEnd||day<week.weekStart);
 const scope=dayScope(day,todayIso);
 const subtitle=meta?[meta.originalTitle,meta.year,runtimeLabel(meta.runtime),meta.countryCode&&safe(()=>regionName.of(meta.countryCode!)),meta.languageCode&&cap(safe(()=>langName.of(meta.languageCode!)))].filter(Boolean).join(' · ')
  :meta===null?'τίτλος από το πρόγραμμα · χωρίς αντιστοίχιση':catalog.movies[key]?.genre||'';
 const share=async()=>{const url=location.href;try{if(navigator.share)await navigator.share({title,url});else{await navigator.clipboard.writeText(url)}}catch{/* cancelled */}};
 // "Πάμε μαζί": a screening (cinema + day + time) travels in the link itself, so no account or server is needed.
 const pickCinema=query.get('cinema'),pickTime=query.get('time');
 const [copied,setCopied]=useState('');
 type Prog={name:string;v?:{id:string}|null;times:Showtime[]};
 const timeFor=(p:Prog)=>(pickCinema&&p.v?.id===pickCinema&&pickTime)||(p.times.find(r=>!isPast(r,todayIso,now))||p.times[0]).time;
 const [planFor,setPlanFor]=useState<{plan:NewPlan;p:Prog}|null>(null);
 const sharePlan=async(p:Prog)=>{
  const t=timeFor(p);
  const url=new URL(location.pathname,location.origin);url.searchParams.set('date',day);if(p.v)url.searchParams.set('cinema',p.v.id);url.searchParams.set('time',t);
  const text=`Πάμε στο «${title}»; ${shortDay(day)} ${t} · ${p.name.split(',')[0]}`;
  try{if(navigator.share)await navigator.share({title,text,url:url.href});else{await navigator.clipboard.writeText(text+'\n'+url.href);setCopied(p.name);setTimeout(()=>setCopied(''),2500)}}catch{/* cancelled */}
 };
 const filmId=id;
 // Signed in: invite friends; otherwise just share the link.
 const openPlan=(p:Prog)=>{if(!session)return sharePlan(p);const r=filmRoute(filmRows[0]);
  setPlanFor({p,plan:{film_title:title,film_route:`${r.id}/${r.slug}`,cinema_id:p.v?.id||p.name,cinema_name:p.name,show_date:day,show_time:timeFor(p)}})};
 const invitedOnce=useRef(false);
 useEffect(()=>{if(invitedOnce.current||!pickCinema)return;const el=document.querySelector('.prog-card.invited');if(el){invitedOnce.current=true;el.scrollIntoView({block:'center',behavior:reducedMotion()?'auto':'smooth'})}});
 const flags=filmFlags(title,filmRows,week,todayIso,history,meta);

 return <div ref={page} className="sheet-page" role="dialog" aria-modal="true" aria-label={title||'Ταινία'} tabIndex={-1}>
  <div className="sheet-inner">
   <div className="float-bar"><div>
    <button type="button" className="glass-round" aria-label="Πίσω" onClick={()=>back('/movies'+location.search)}><CaretLeft/></button>
    <div className="group"><button type="button" className="glass-round" aria-label="Κοινοποίηση" onClick={share}><ShareNetwork/></button>
     {key&&<HeartButton className="glass-round" on={savedFilms.has(key)} onToggle={()=>savedFilms.toggle(key)} title={title}/>}</div>
   </div></div>
   <div className="backdrop" style={{'--hue':hueOf(title)} as CSSProperties}>
    {meta?.backdropPath?<img ref={bg} src={tmdbImage(meta.backdropPath,'w780')!} alt=""/>:(meta?.posterPath||catalog.movies[key]?.poster)&&<img ref={bg} src={tmdbImage(meta?.posterPath,'w780')||catalog.movies[key]!.poster!} alt="" style={{filter:'blur(18px) brightness(.7)',scale:'1.2'}}/>}
    {trailer&&<a className="play" href={'https://www.youtube.com/watch?v='+trailer} target="_blank" rel="noreferrer" aria-label="Δες το trailer"><Play weight="fill"/></a>}
    <div className="shade"/>
   </div>
   <div ref={body} className="detail-body">
    <div data-a className="kicker">{flags.map(f=><span key={f.kind} className={'flag '+f.kind}>{f.label}</span>)}{programme.length?`Στις αίθουσες · ${programme.length} σινεμά ${scope}`:`Χωρίς προβολές ${scope}`}</div>
    {meta===null&&<div data-a className="kicker" style={{marginTop:4,color:'var(--color-neutral-500)'}}>Χωρίς στοιχεία TMDB</div>}
    <h1 data-a>{title||'Η ταινία δεν βρέθηκε'}</h1>
    <div data-a className="detail-sub">{subtitle}</div>
    {meta&&meta.genres.length>0&&<div data-a style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>{meta.genres.map(g=><span key={g} className="tag tag-neutral">{g}</span>)}</div>}
    <div data-a className="stat-grid">
     <a className="stat" href={meta?'https://www.themoviedb.org/movie/'+meta.tmdbId:'https://www.themoviedb.org/search/movie?query='+encodeURIComponent(title)} target="_blank" rel="noreferrer">
      <div className="v">{meta?.vote!=null?Math.round(meta.vote*10)+'%':'—'}<ArrowUpRight size={13}/></div><div className="l">{meta?.vote!=null?`TMDB · ${meta.voteCount.toLocaleString('el-GR')} ψήφοι`:'TMDB · αναζήτηση'}</div></a>
     <a className="stat" href={meta?.imdbId?'https://www.imdb.com/title/'+meta.imdbId+'/':'https://www.imdb.com/find/?s=tt&q='+encodeURIComponent(meta?.originalTitle||title)} target="_blank" rel="noreferrer">
      <div className="v link">IMDb<ArrowUpRight size={13}/></div><div className="l">{meta?.imdbId||'αναζήτηση'}</div></a>
     <a className="stat" href={meta?'https://letterboxd.com/tmdb/'+meta.tmdbId:'https://letterboxd.com/search/films/'+encodeURIComponent(title)+'/'} target="_blank" rel="noreferrer">
      <div className="v link">Letterboxd<ArrowUpRight size={13}/></div><div className="l">{meta?'/tmdb/'+meta.tmdbId:'αναζήτηση'}</div></a>
    </div>
    <div data-a className="facts">
     <span><Clock/>{meta?.runtime?runtimeLabel(meta.runtime):'Διάρκεια —'}</span>
     {meta?.year&&<span><CalendarBlank/>{meta.year}</span>}
     {(meta?.genres[0]||catalog.movies[key]?.genre)&&<span><FilmSlate/>{meta?.genres[0]||catalog.movies[key]?.genre}</span>}
    </div>
    <div data-a style={{marginTop:18}}><Segmented label="Ενότητα" options={['Πρόγραμμα','Πληροφορίες']} value={tab} onChange={setTab}/></div>
    {tab===1&&<>
    <h3 data-a className="sub-h">Περιγραφή</h3>
    <p data-a className="overview" style={{marginTop:6}}>{meta?.overview||(meta===undefined?'Η περιγραφή θα εμφανιστεί μόλις φορτώσουν τα στοιχεία από το TMDB.':'Δεν υπάρχει διαθέσιμη περιγραφή για αυτή την ταινία.')}</p>
    {meta?.overview&&<div data-a className="source-line"><Translate/>{meta.overviewLanguage==='en'?'Περίληψη στα αγγλικά · δεν υπάρχει ελληνική στο TMDB':'Ελληνική περίληψη · TMDB'}</div>}
    {meta&&meta.cast.length>0&&<div data-a className="cast-row">{meta.cast.map((c,i)=><div className="cast" key={c.name+i}>
     <div className="av" style={{background:`oklch(.34 .03 ${[270,30,200,120,330][i%5]})`}}>{c.profile?<img src={tmdbImage(c.profile,'w185')!} alt="" loading="lazy"/>:c.name.split(/[\s.]+/).filter(Boolean).map(w=>w[0]).join('').slice(0,3).toUpperCase()}</div>
     <div className="n">{c.name}</div><div className="r">{c.role}</div></div>)}</div>}

    </>}
    {tab===0&&<>
    <div data-a ref={programmeRef} className="section-head" style={{margin:'22px 0 10px',scrollMarginTop:70}}><h2 style={{fontSize:20}}>Πρόγραμμα</h2><span className="aside">ενημ. {clock(week?.checkedAt)} · Αθηνόραμα</span></div>
    <div data-a style={{margin:'0 -20px'}}><DateStrip className="pad" value={day} todayIso={todayIso} weekStart={week?.weekStart} weekEnd={week?.weekEnd} onPick={d=>setQuery({date:d===todayIso?null:d})}/></div>
    {programme.length>0&&<MiniMap pins={pins} label={`${programme.length} σινεμά · ${shortDay(day)}`} to={`/map?mode=film&film=${filmId}`}/>}
    {!programme.length&&<div data-a className="empty-card" style={{marginTop:12}}><CalendarDots size={22} color="var(--color-neutral-500)"/>
     <div style={{marginTop:6}}>{outside||!filmRows.length?'Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτή την ημερομηνία ακόμη. Το πρόγραμμα της νέας εβδομάδας δημοσιεύεται την Πέμπτη.':'Η ταινία δεν έχει προβολές αυτή την ημέρα. Δοκίμασε άλλη ημερομηνία.'}</div></div>}
    {pickCinema&&pickTime&&programme.some(p=>p.v?.id===pickCinema)&&<div data-a className="invite" role="status"><PaperPlaneTilt/>
     <span>Πρόταση: <b>{shortDay(day)} {pickTime}</b> · {programme.find(p=>p.v?.id===pickCinema)!.name.split(',')[0]}</span>
     <button type="button" onClick={()=>setQuery({cinema:null,time:null})} aria-label="Κλείσιμο πρότασης">×</button></div>}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:12}}>{programme.map(p=><div data-a key={p.name} data-cinema={p.v?.id} className={'prog-card'+(pickCinema&&p.v?.id===pickCinema?' invited':'')}>
     <div className="top"><div style={{minWidth:0}}>{p.v?<Link className="name" to={cinemaRoute(p.v)}>{p.name}</Link>:<span className="name">{p.name}</span>}
      <div className="addr">{p.v?`${p.v.addrShort} · ${p.v.area}`:''}</div></div>
      <span className="dist" title={userLoc?'Από την τοποθεσία σου':'Από Σύνταγμα'}><NavigationArrow/>{kmLabel(p.k)}</span></div>
     <div className="hall">{p.types[0]==='summer'?<Sun/>:<Armchair/>}{(p.screens.join(', ')||'Αίθουσα')+' · '+p.types.map(t=>HALL_LABEL[t].toLowerCase()).join('/')}</div>
     <div className="times">{p.times.map(r=><button type="button" key={r.id||r.date+r.time} aria-pressed={!!p.v&&pickCinema===p.v.id&&pickTime===r.time} onClick={()=>setQuery({cinema:p.v?.id||null,time:r.time})}
      className={'time-chip stack'+(isPast(r,todayIso,now)?' past':'')}
      title={meta?.runtime?'Τέλος περίπου '+endClock(r.time,r.afterMidnight,meta.runtime):undefined}><span>{r.time}</span>
      <small className={r.afterMidnight?'late':''}>{r.afterMidnight?shortDay(r.date):VERSION_SHORT[version(r)]}</small></button>)}</div>
     <div className="actions">
      <a className="btn btn-primary" href={ticketsUrl(p.name,title,p.booking)} target="_blank" rel="noreferrer" title={p.booking?undefined:'Η πηγή δεν δίνει σύνδεσμο κράτησης — αναζήτηση της σελίδας εισιτηρίων του σινεμά'}><Ticket/>Εισιτήρια</a>
      <button type="button" className="btn btn-secondary" onClick={()=>openPlan(p)}><PaperPlaneTilt/>{copied===p.name?'Αντιγράφηκε':'Πάμε μαζί'}</button>
      {p.v&&<Link className="btn btn-secondary" to={`/map?mode=film&film=${filmId}&cinema=${p.v.id}`} aria-label="Στον χάρτη"><MapTrifold/></Link>}
     </div>
    </div>)}</div>
    </>}
    {planFor&&<PlanSheet plan={planFor.plan} onLink={()=>sharePlan(planFor.p)} onClose={()=>setPlanFor(null)} onDone={notify}/>}
    {tab===0&&late&&<div className="footnote"><MoonStars/><span>Η προβολή {late.time} ({late.cinema}) ανήκει στο πρόγραμμα {wdGen(late.programmeDate)}, ξεκινά {shortDay(late.date)}.</span></div>}
   </div>
  </div>
 </div>;
}

/** Schematic map: pins placed by lng/lat inside the box (aspect-corrected). */
function MiniMap({pins,label,to}:{pins:{lng:number;lat:number}[];label:string;to:string}){
 const lo=pins.map(p=>p.lng),la=pins.map(p=>p.lat);
 const [lo0,lo1,la0,la1]=pins.length?[Math.min(...lo),Math.max(...lo),Math.min(...la),Math.max(...la)]:[0,1,0,1];
 const lr=Math.max(lo1-lo0,(la1-la0)*2.9,.001);
 return <Link data-a className="mini-map" to={to} aria-label={'Χάρτης: '+label}>
  {pins.map((p,i)=><span key={i} className="dot" style={{left:(50+((p.lng-(lo0+lo1)/2)/lr)*80)+'%',top:(45-((p.lat-(la0+la1)/2)/lr)*2.9*60)+'%'}}/>)}
  <span className="mpill" style={{left:10}}>{label}</span><span className="mpill" style={{right:10}}>Χάρτης<ArrowsOutSimple/></span>
 </Link>;
}
