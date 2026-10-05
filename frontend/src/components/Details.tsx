import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {CaretLeft,ShareNetwork,Play,ArrowUpRight,Translate,NavigationArrow,Sun,Armchair,Ticket,MapTrifold,ArrowsOutSimple,MoonStars,CalendarDots} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {back,setQuery,useRoute} from '../lib/router';
import {gsap,useEntrance,reducedMotion} from '../lib/motion';
import {tmdbImage} from '../lib/data';
import {SYNTAGMA,km,kmLabel} from '../lib/geo';
import {VERSION_SHORT,HALL_LABEL,clock,dayScope,filmRoute,groupBy,hallType,runtimeLabel,shortDay,uniq,version,wdGen,cinemaRoute} from '../lib/derive';
import {filmKey} from '../lib/types';
import {DateStrip,HeartButton,Link,hueOf} from './ui';

const regionName=new Intl.DisplayNames(['el'],{type:'region'}),langName=new Intl.DisplayNames(['el'],{type:'language'});
const safe=(f:()=>string|undefined)=>{try{return f()}catch{return undefined}};
const cap=(s?:string)=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

/** 02 Ταινία — opens as a bottom sheet over the feed. */
export default function Details({id}:{id:string}){
 const app=useApp();const {query}=useRoute();
 const {rows,films,catalog,todayIso,week,venueByName,userLoc,savedFilms}=app;
 const page=useRef<HTMLDivElement>(null),body=useRef<HTMLDivElement>(null),bg=useRef<HTMLImageElement>(null);
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
 const filmId=id;

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
    <div data-a className="kicker">{programme.length?`Στις αίθουσες · ${programme.length} σινεμά ${scope}`:`Χωρίς προβολές ${scope}`}</div>
    {meta===null&&<div data-a className="kicker" style={{marginTop:4,color:'var(--color-neutral-500)'}}>Χωρίς στοιχεία TMDB</div>}
    <h1 data-a>{title||'Η ταινία δεν βρέθηκε'}</h1>
    <div data-a className="detail-sub">{subtitle}</div>
    {meta&&meta.genres.length>0&&<div data-a style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>{meta.genres.map(g=><span key={g} className="tag tag-neutral">{g}</span>)}</div>}
    {meta&&<div data-a className="stat-grid">
     <div className="stat"><div className="v">{meta.vote!=null?meta.vote.toFixed(1):'—'}</div><div className="l">TMDB · {meta.voteCount.toLocaleString('el-GR')}</div></div>
     {meta.imdbId?<a className="stat" href={'https://www.imdb.com/title/'+meta.imdbId+'/'} target="_blank" rel="noreferrer"><div className="v link">IMDb<ArrowUpRight size={13}/></div><div className="l">{meta.imdbId}</div></a>
      :<div className="stat"><div className="v link">IMDb</div><div className="l">—</div></div>}
     <a className="stat" href={'https://letterboxd.com/tmdb/'+meta.tmdbId} target="_blank" rel="noreferrer"><div className="v link">Letterboxd<ArrowUpRight size={13}/></div><div className="l">/tmdb/{meta.tmdbId}</div></a>
    </div>}
    {meta?.overview&&<><p data-a className="overview">{meta.overview}</p>
     <div data-a className="source-line"><Translate/>{meta.overviewLanguage==='en'?'Περίληψη στα αγγλικά · δεν υπάρχει ελληνική στο TMDB':'Ελληνική περίληψη · TMDB'}</div></>}
    {meta&&meta.cast.length>0&&<div data-a className="cast-row">{meta.cast.map((c,i)=><div className="cast" key={c.name+i}>
     <div className="av" style={{background:`oklch(.34 .03 ${[270,30,200,120,330][i%5]})`}}>{c.profile?<img src={tmdbImage(c.profile,'w185')!} alt="" loading="lazy"/>:c.name.split(/[\s.]+/).filter(Boolean).map(w=>w[0]).join('').slice(0,3).toUpperCase()}</div>
     <div className="n">{c.name}</div><div className="r">{c.role}</div></div>)}</div>}

    <div data-a className="section-head" style={{margin:'28px 0 10px'}}><h2 style={{fontSize:20}}>Πρόγραμμα</h2><span className="aside">ενημ. {clock(week?.checkedAt)} · Αθηνόραμα</span></div>
    <div data-a style={{margin:'0 -20px'}}><DateStrip className="pad" value={day} todayIso={todayIso} weekStart={week?.weekStart} weekEnd={week?.weekEnd} onPick={d=>setQuery({date:d===todayIso?null:d})}/></div>
    {programme.length>0&&<MiniMap pins={pins} label={`${programme.length} σινεμά · ${shortDay(day)}`} to={`/map?mode=film&film=${filmId}`}/>}
    {!programme.length&&<div data-a className="empty-card" style={{marginTop:12}}><CalendarDots size={22} color="var(--color-neutral-500)"/>
     <div style={{marginTop:6}}>{outside||!filmRows.length?'Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτή την ημερομηνία ακόμη. Το πρόγραμμα της νέας εβδομάδας δημοσιεύεται την Πέμπτη.':'Η ταινία δεν έχει προβολές αυτή την ημέρα. Δοκίμασε άλλη ημερομηνία.'}</div></div>}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:12}}>{programme.map(p=><div data-a key={p.name} className="prog-card">
     <div className="top"><div style={{minWidth:0}}>{p.v?<Link className="name" to={cinemaRoute(p.v)}>{p.name}</Link>:<span className="name">{p.name}</span>}
      <div className="addr">{p.v?`${p.v.addrShort} · ${p.v.area}`:''}</div></div>
      <span className="dist" title={userLoc?'Από την τοποθεσία σου':'Από Σύνταγμα'}><NavigationArrow/>{kmLabel(p.k)}</span></div>
     <div className="hall">{p.types[0]==='summer'?<Sun/>:<Armchair/>}{(p.screens.join(', ')||'Αίθουσα')+' · '+p.types.map(t=>HALL_LABEL[t].toLowerCase()).join('/')}</div>
     <div className="times">{p.times.map(r=><span key={r.id||r.date+r.time} className="time-chip stack"><span>{r.time}</span>
      <small className={r.afterMidnight?'late':''}>{r.afterMidnight?shortDay(r.date):VERSION_SHORT[version(r)]}</small></span>)}</div>
     <div className="actions">
      {p.booking&&<a className="btn btn-primary" href={p.booking} target="_blank" rel="noreferrer"><Ticket/>Εισιτήρια</a>}
      {p.v&&<Link className="btn btn-secondary" to={`/map?mode=film&film=${filmId}&cinema=${p.v.id}`}><MapTrifold/>Στον χάρτη</Link>}
     </div>
    </div>)}</div>
    {late&&<div className="footnote"><MoonStars/><span>Η προβολή {late.time} ({late.cinema}) ανήκει στο πρόγραμμα {wdGen(late.programmeDate)}, ξεκινά {shortDay(late.date)}.</span></div>}
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
