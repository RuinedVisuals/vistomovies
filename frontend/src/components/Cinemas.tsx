import {useMemo,useRef} from 'react';
import {MagnifyingGlass,MapTrifold,X,Sun,Armchair,SunHorizon,ProjectorScreen,FilmStrip,CalendarDots,CaretLeft,NavigationArrow,Globe,Phone,Ticket,SealCheck,MapPinSimpleArea} from '@phosphor-icons/react';
import type {CSSProperties} from 'react';
import {useApp} from '../lib/context';
import {back,setQuery,useRoute} from '../lib/router';
import {useEntrance} from '../lib/motion';
import {tmdbImage} from '../lib/data';
import {directionsUrl,ticketsUrl,venueHue} from '../lib/geo';
import {normalize} from '../lib/types';
import {HALL_LABEL,VERSION_SHORT,cinemaInfo,cinemaRoute,dayScope,filmRoute,groupBy,hallType,shortDay,sortTimes,timeKey,uniq,updatedLabel,version} from '../lib/derive';
import {DateStrip,Link,Poster,Segmented,StarButton} from './ui';

const TABS=['all','programme','fav'] as const;

/** 04 Σινεμά — every cinema stays listed; "no data" is not "closed". */
export function Cinemas(){
 const {venues,rows,todayIso,favCinemas,loading}=useApp();const {query}=useRoute();const ref=useRef<HTMLElement>(null);
 const q=query.get('q')||'';const tab=Math.max(0,TABS.indexOf((query.get('show')||'all') as typeof TABS[number]));
 const todayBy=useMemo(()=>groupBy(rows.filter(r=>r.programmeDate===todayIso),r=>r.cinema),[rows,todayIso]);
 const all=useMemo(()=>venues.map(v=>({v,i:cinemaInfo(v,todayBy.get(v.name)||[])})).sort((a,b)=>Number(b.i.has)-Number(a.i.has)||a.v.name.localeCompare(b.v.name,'el')),[venues,todayBy]);
 const list=all.filter(({v,i})=>(tab===0||(tab===1?i.has:favCinemas.has(v.id)))&&(!q||normalize(v.name+' '+v.area+' '+v.address).includes(normalize(q))));
 useEntrance(ref,[venues.length>0,tab]);
 return <main className="screen" ref={ref}>
  <div data-a className="page-head"><div className="over">{venues.length} χώροι · {all.filter(x=>x.i.has).length} με πρόγραμμα σήμερα</div><h1>Σινεμά</h1></div>
  <div data-a style={{display:'flex',gap:8,padding:'14px 20px 0'}}>
   <label className="search"><MagnifyingGlass size={17}/><span className="sr-only">Αναζήτηση κινηματογράφου</span><input type="search" value={q} placeholder="Όνομα ή γειτονιά" onChange={e=>setQuery({q:e.target.value})}/>
    {q&&<button type="button" className="clear" aria-label="Καθαρισμός" onClick={()=>setQuery({q:null})}><X size={15}/></button>}</label>
   <Link to="/map" className="icon-btn" aria-label="Χάρτης" style={{color:'var(--color-text)'}}><MapTrifold/></Link>
  </div>
  <div data-a style={{padding:'12px 20px 0'}}><Segmented label="Εμφάνιση" options={['Όλα','Με πρόγραμμα','Αγαπημένα']} value={tab} onChange={i=>setQuery({show:i?TABS[i]:null})}/></div>
  <div style={{display:'flex',flexDirection:'column',gap:10,padding:'16px 20px 0'}}>
   {list.map(({v,i})=><article data-a key={v.id} className="cine-card">
    <div className="row">
     <div className="tile" style={{'--hue':venueHue(v.id)} as CSSProperties}>{i.types[0]==='summer'?<SunHorizon/>:<ProjectorScreen/>}</div>
     <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:6}}><Link className="name" to={cinemaRoute(v)}>{v.name}</Link>
       <StarButton on={favCinemas.has(v.id)} onToggle={()=>favCinemas.toggle(v.id)} title={v.name}/></div>
      <div className="addr">{v.area} · {v.addrShort}</div>
      <div className="tags"><span className={i.statusClass}>{i.status}</span>{i.types.map(t=><span key={t} className="tag tag-outline">{t==='summer'?<Sun/>:<Armchair/>}{HALL_LABEL[t]}</span>)}</div>
     </div>
    </div>
    <div className={'today'+(i.has?'':' none')}>{i.has?<FilmStrip/>:<CalendarDots/>}<span>{i.today}</span></div>
   </article>)}
   {!loading&&!list.length&&<div className="empty-card">{tab===2?'Πάτησε το αστέρι σε ένα σινεμά για να το κρατήσεις εδώ.':'Δεν βρέθηκαν κινηματογράφοι.'}</div>}
  </div>
 </main>;
}

/** 05 Κινηματογράφος */
export function CinemaPage({id}:{id:string}){
 const {venueById,rows,films,catalog,todayIso,week,favCinemas,venues}=useApp();const {query}=useRoute();const ref=useRef<HTMLDivElement>(null);
 const v=venueById.get(id);const day=query.get('date')||todayIso;
 const weekRows=useMemo(()=>v?rows.filter(r=>r.cinema===v.name):[],[rows,v]);
 const dayRows=weekRows.filter(r=>r.programmeDate===day);
 const info=v?cinemaInfo(v,weekRows.filter(r=>r.programmeDate===todayIso)):null;
 useEntrance(ref,[!!v,day]);
 if(!v)return <main className="screen no-nav"><div className="page-head"><h1>{venues.length?'Ο κινηματογράφος δεν βρέθηκε':'Φόρτωση…'}</h1></div><p className="pad" style={{marginTop:12}}><Link to="/cinemas">Όλα τα σινεμά</Link></p></main>;
 const scope=dayScope(day,todayIso);
 const halls=uniq(weekRows.map(r=>r.screen||'')).sort((a,b)=>a.localeCompare(b,'el',{numeric:true})).map(sc=>{
  const n=uniq(dayRows.filter(r=>(r.screen||'')===sc).map(r=>r.movie)).length;const t=hallType({screen:sc||null},v);
  return {label:sc||'Κύρια αίθουσα',t,note:HALL_LABEL[t]+' · '+(n?`${n} ${n===1?'ταινία':'ταινίες'} ${scope}`:'χωρίς προβολές '+scope)};
 });
 const programme=[...groupBy(dayRows,r=>r.movie)].map(([title,rs])=>{const m=films[title];const route=filmRoute(rs[0]);
  return {title,route,m,poster:tmdbImage(m?.posterPath,'w185')||catalog.movies[rs[0].movieSourceUrl||title]?.poster||null,times:sortTimes(rs.map(r=>r.time)),
   sub:uniq(rs.map(r=>r.screen).filter(Boolean)).join(', ')+(rs[0].screen?' · ':'')+(m===null?'χωρίς στοιχεία TMDB':[m?.badge,uniq(rs.map(r=>VERSION_SHORT[version(r)])).join('/')].filter(Boolean).join(' · '))};
 }).sort((a,b)=>timeKey(a.times[0]).localeCompare(timeKey(b.times[0])));
 const booking=weekRows.find(r=>r.bookingUrl)?.bookingUrl;const sourceUrl=weekRows[0]?.sourceUrl;
 const actions=[
  {label:'Οδηγίες',Icon:NavigationArrow,href:directionsUrl(v)},
  {label:'Website',Icon:Globe,href:v.website||sourceUrl},
  {label:'Κλήση',Icon:Phone,href:v.phone?'tel:'+v.phone.replace(/\s/g,''):undefined},
  {label:'Εισιτήρια',Icon:Ticket,href:ticketsUrl(v.name,undefined,booking)},
 ];
 const types=uniq(weekRows.map(r=>hallType(r,v)));
 return <main className="screen no-nav" style={{paddingTop:0}} ref={ref}>
  <div className="float-bar" style={{position:'sticky',top:0}}><div>
   <button type="button" className="glass-round" aria-label="Πίσω" onClick={()=>back('/cinemas')}><CaretLeft/></button>
   <StarButton className="glass-round" on={favCinemas.has(v.id)} onToggle={()=>favCinemas.toggle(v.id)} title={v.name}/>
  </div></div>
  <div className="photo-head" aria-hidden="true">{/* Only licensed photos may go here. */}<div className="label">{(types[0]||(v.summer?'summer':'indoor'))==='summer'?<SunHorizon size={44} opacity={.5}/>:<ProjectorScreen size={44} opacity={.5}/>}</div><div className="shade"/></div>
  <div className="cine-body">
   <div data-a style={{display:'flex',gap:6}}><span className={info!.statusClass}>{info!.status}</span><span className="tag tag-neutral">{v.area}</span></div>
   <h1 data-a>{v.name}</h1>
   <div data-a style={{fontSize:13,color:'var(--color-neutral-400)'}}>{v.address}</div>
   <div data-a className="action-grid">{actions.map(a=><a key={a.label} href={a.href||undefined} target={a.href?.startsWith('http')?'_blank':undefined} rel="noreferrer" aria-disabled={!a.href}
    title={!a.href?'Δεν υπάρχει διαθέσιμο':a.label==='Website'&&!v.website?'Σελίδα του σινεμά στο Αθηνόραμα':undefined}><a.Icon/>{a.label}</a>)}</div>
   {halls.length>0&&<div data-a className="halls">{halls.map(h=><div key={h.label}><span>{h.t==='summer'?<Sun color="var(--color-neutral-400)"/>:<Armchair color="var(--color-neutral-400)"/>}{h.label}</span><span className="note">{h.note}</span></div>)}</div>}
   <div data-a className="geo-line">{v.verified?<><SealCheck/>Θέση επιβεβαιωμένη · OSM</>:<><MapPinSimpleArea/>{v.lng!=null?'Θέση κατά προσέγγιση · εκκρεμεί επιβεβαίωση OSM':'Χωρίς θέση στον χάρτη · εκκρεμεί γεωκωδικοποίηση'}</>}</div>
   <div data-a className="section-head" style={{margin:'26px 0 10px'}}><h2 style={{fontSize:20}}>Πρόγραμμα</h2><span className="aside">{week?'έως '+shortDay(week.weekEnd):''}</span></div>
   <div data-a style={{margin:'0 -20px'}}><DateStrip className="pad" value={day} todayIso={todayIso} weekStart={week?.weekStart} weekEnd={week?.weekEnd} onPick={d=>setQuery({date:d===todayIso?null:d})}/></div>
   {programme.length?<div style={{marginTop:6}}>{programme.map(p=>{const to=`/movies/${p.route.id}/${p.route.slug}${day!==todayIso?'?date='+day:''}`;
    return <div data-a key={p.title} className="cine-film">
     <Link to={to} tabIndex={-1} aria-hidden="true"><Poster src={p.poster} title={p.title} striped={p.m===null} style={{width:56,height:82,borderRadius:8}}/></Link>
     <div style={{flex:1,minWidth:0}}><Link className="t" to={to}>{p.title}</Link><div className="s">{p.sub}</div>
      <div className="times">{p.times.map(t=><span key={t} className="time-chip">{t}</span>)}</div></div>
    </div>})}</div>
   :<div data-a className="empty-card" style={{marginTop:14,padding:'22px 18px'}}><CalendarDots size={24} color="var(--color-neutral-500)"/>
     <strong>Δεν υπάρχει διαθέσιμο πρόγραμμα για αυτή την ημερομηνία.</strong>
     <p>Αυτό δεν σημαίνει απαραίτητα ότι ο κινηματογράφος είναι κλειστός. {(v.website||sourceUrl)?<a href={v.website||sourceUrl} target="_blank" rel="noreferrer">Δες την επίσημη σελίδα.</a>:'Δες την επίσημη σελίδα.'}</p></div>}
   <div data-a className="source-line" style={{marginTop:16}}>Πηγή προγράμματος: Αθηνόραμα · ενημ. {updatedLabel(week?.checkedAt,todayIso)}</div>
  </div>
 </main>;
}
