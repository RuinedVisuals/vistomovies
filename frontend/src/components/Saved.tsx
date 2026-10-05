import {useEffect,useMemo,useRef} from 'react';
import {CaretRight,ProjectorScreen,BellRinging} from '@phosphor-icons/react';
import type {CSSProperties} from 'react';
import {useApp} from '../lib/context';
import {setQuery,useRoute} from '../lib/router';
import {gsap,useEntrance,reducedMotion} from '../lib/motion';
import {tmdbImage} from '../lib/data';
import {venueHue} from '../lib/geo';
import {cinemaInfo,cinemaRoute,filmRoute,groupBy,sortTimes,uniq} from '../lib/derive';
import {filmKey} from '../lib/types';
import {Link,Poster,Segmented} from './ui';
import {nextTime} from '../ShowtimesApp';

/** 07 Η λίστα μου — saved items never disappear when not playing. */
export default function Saved(){
 const {rows,films,catalog,todayIso,savedFilms,favCinemas,venueById}=useApp();
 const {query}=useRoute();const tab=query.get('tab')==='cinemas'?1:0;
 const ref=useRef<HTMLElement>(null),list=useRef<HTMLDivElement>(null),first=useRef(true);
 const now=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());
 const todayRows=useMemo(()=>rows.filter(r=>r.programmeDate===todayIso),[rows,todayIso]);
 const byKey=useMemo(()=>groupBy(rows,r=>filmKey(r)),[rows]);
 const filmItems=savedFilms.items.map(key=>{
  const any=byKey.get(key)?.[0];
  const title=any?.movie||catalog.movies[key]?.title||(key.startsWith('http')?decodeURIComponent(key.split('/').filter(Boolean).pop()||'').replace(/-\d+$/,'').replace(/_/g,' '):key);
  const m=films[title];const rs=todayRows.filter(r=>filmKey(r)===key);
  const times=sortTimes(rs.map(r=>r.time));const route=filmRoute({movie:title,movieSourceUrl:key.startsWith('http')?key:null});
  return {key,title,m,to:`/movies/${route.id}/${route.slug}`,poster:tmdbImage(m?.posterPath,'w185')||catalog.movies[key]?.poster||null,
   sub:m?[m.year,m.vote!=null?'TMDB '+m.vote.toFixed(1):null].filter(Boolean).join(' · '):catalog.movies[key]?.genre||'Ταινία',
   on:rs.length>0,status:rs.length?`Σήμερα σε ${uniq(rs.map(r=>r.cinema)).length} σινεμά · επόμενη ${nextTime(times,todayIso,todayIso,now)}`
    :byKey.has(key)?'Δεν παίζει σήμερα · παίζει αυτή την εβδομάδα':'Δεν παίζει αυτή την εβδομάδα'};
 }).sort((a,b)=>Number(b.on)-Number(a.on));
 const cinemaItems=favCinemas.items.map(id=>venueById.get(id)).filter(Boolean).map(v=>{const i=cinemaInfo(v!,todayRows.filter(r=>r.cinema===v!.name));
  return {v:v!,on:i.has,status:i.has?i.today:'Χωρίς πρόγραμμα σήμερα'}}).sort((a,b)=>Number(b.on)-Number(a.on)||a.v.name.localeCompare(b.v.name,'el'));
 useEntrance(ref,[]);
 useEffect(()=>{if(first.current){first.current=false;return}
  const items=list.current?.children;if(!items?.length)return;
  gsap.fromTo(items,{x:reducedMotion()?0:tab?20:-20,opacity:0},{x:0,opacity:1,duration:.4,stagger:.05,ease:'power3.out',clearProps:'transform,opacity'});
 },[tab]);
 const lit=(on:boolean,text:string)=><div className={'st'+(on?' on':'')}><i/>{text}</div>;
 return <main className="screen" ref={ref}>
  <div data-a className="page-head"><div className="over">Αποθηκεύεται σε αυτή τη συσκευή</div><h1>Η λίστα μου</h1></div>
  <div data-a style={{padding:'14px 20px 0'}}><Segmented label="Λίστα" options={['Ταινίες · '+filmItems.length,'Σινεμά · '+cinemaItems.length]} value={tab} onChange={i=>setQuery({tab:i?'cinemas':null})}/></div>
  <div ref={list} data-a style={{display:'flex',flexDirection:'column',gap:10,padding:'16px 20px 0'}}>
   {tab===0?filmItems.map(f=><Link key={f.key} to={f.to} className="saved-item">
    <Poster src={f.poster} title={f.title} striped={f.m===null}/>
    <div className="body"><div className="t">{f.title}</div><div className="s">{f.sub}</div>{lit(f.on,f.status)}</div><CaretRight/></Link>)
   :cinemaItems.map(({v,on,status})=><Link key={v.id} to={cinemaRoute(v)} className="saved-item">
    <div className="tile" style={{'--hue':venueHue(v.id)} as CSSProperties}><ProjectorScreen/></div>
    <div className="body"><div className="t">{v.name}</div><div className="s">{v.area} · {v.addrShort}</div>{lit(on,status)}</div><CaretRight/></Link>)}
   {(tab===0?!filmItems.length:!cinemaItems.length)&&<div className="empty-card">{tab===0?'Πάτησε την καρδιά σε μια ταινία για να την κρατήσεις εδώ.':'Πάτησε το αστέρι σε ένα σινεμά για να το κρατήσεις εδώ.'}</div>}
  </div>
  <div data-a className="info-card"><BellRinging/><span>Ειδοποίηση όταν μια αποθηκευμένη ταινία μπει σε πρόγραμμα κοντά σου — αργότερα, στο native app.</span></div>
 </main>;
}
