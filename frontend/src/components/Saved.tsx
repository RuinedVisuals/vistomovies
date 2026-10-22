import {useEffect,useMemo,useRef} from 'react';
import {CaretRight,ProjectorScreen,BellRinging} from '@phosphor-icons/react';
import type {CSSProperties} from 'react';
import {useApp} from '../lib/context';
import {setQuery,useRoute} from '../lib/router';
import {gsap,useEntrance,reducedMotion} from '../lib/motion';
import {tmdbImage} from '../lib/data';
import {SYNTAGMA,km,kmLabel,venueHue} from '../lib/geo';
import {cinemaInfo,cinemaRoute,filmFlags,filmRoute,groupBy,isPast,shortDay,uniq} from '../lib/derive';
import {filmKey,nowTime} from '../lib/types';
import type {Showtime} from '../lib/types';
import {Link,Poster,Segmented} from './ui';
import Account from './Account';

const short=(name:string)=>name.split(',')[0];
type Status={kind:'tonight'|'over'|'later'|'gone';text:string;sub?:string};
/** What a saved film means for the user right now: playing tonight (nearest cinema), done today, later this week, or gone. */
function statusOf(rs:Showtime[],todayIso:string,now:string,from:[number,number],venues:Map<string,{lng:number|null;lat:number|null}>):Status{
 if(!rs.length)return {kind:'gone',text:'Δεν παίζει αυτή την εβδομάδα'};
 const up=rs.filter(r=>!isPast(r,todayIso,now)).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
 const tonight=up.filter(r=>r.programmeDate===todayIso);
 if(tonight.length){
  const by=[...groupBy(tonight,r=>r.cinema)].map(([name,x])=>{const v=venues.get(name);return {name,k:v?km(v,from):null,time:x[0].time}}).sort((a,b)=>(a.k??99)-(b.k??99));
  const best=by[0];
  return {kind:'tonight',text:`Απόψε σε ${by.length} σινεμά · επόμενη ${tonight[0].time}`,sub:`Κοντινότερο: ${short(best.name)} ${best.time}${best.k!=null?' · '+kmLabel(best.k):''}`};
 }
 const over=rs.some(r=>r.programmeDate===todayIso);
 if(up.length){const n=up[0];return {kind:over?'over':'later',text:(over?'Τέλος για σήμερα · ':'Δεν παίζει σήμερα · ')+'επόμενη '+shortDay(n.programmeDate)+' '+n.time,sub:short(n.cinema)}}
 return {kind:'over',text:'Τέλος προβολών για αυτή την εβδομάδα'};
}

/** 07 Η λίστα μου — saved items never disappear when not playing. */
export default function Saved(){
 const {rows,films,catalog,history,week,todayIso,userLoc,savedFilms,favCinemas,venueById,venueByName}=useApp();
 const {query}=useRoute();const tab=query.get('tab')==='cinemas'?1:0;
 const ref=useRef<HTMLElement>(null),list=useRef<HTMLDivElement>(null),first=useRef(true);
 const now=nowTime();const from=userLoc||SYNTAGMA;
 const todayRows=useMemo(()=>rows.filter(r=>r.programmeDate===todayIso),[rows,todayIso]);
 const byKey=useMemo(()=>groupBy(rows,r=>filmKey(r)),[rows]);
 const filmItems=savedFilms.items.map(key=>{
  const rs=byKey.get(key)||[];const any=rs[0];
  const title=any?.movie||catalog.movies[key]?.title||(key.startsWith('http')?decodeURIComponent(key.split('/').filter(Boolean).pop()||'').replace(/-\d+$/,'').replace(/_/g,' '):key);
  const m=films[title];const route=filmRoute({movie:title,movieSourceUrl:key.startsWith('http')?key:null});
  const st=statusOf(rs,todayIso,now,from,venueByName);
  return {key,title,m,to:`/movies/${route.id}/${route.slug}`,poster:tmdbImage(m?.posterPath,'w185')||catalog.movies[key]?.poster||null,
   sub:m?[m.year,m.vote!=null?'TMDB '+m.vote.toFixed(1):null].filter(Boolean).join(' · '):catalog.movies[key]?.genre||'Ταινία',
   st,on:st.kind==='tonight',flags:filmFlags(title,rs,week,todayIso,history,m)};
 }).sort((a,b)=>['tonight','later','over','gone'].indexOf(a.st.kind)-['tonight','later','over','gone'].indexOf(b.st.kind));
 const tonightN=filmItems.filter(f=>f.on).length;
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
  <div className="pad" style={{paddingTop:14}}><Account/></div>
  <div data-a style={{padding:'14px 20px 0'}}><Segmented label="Λίστα" options={['Ταινίες · '+filmItems.length,'Σινεμά · '+cinemaItems.length]} value={tab} onChange={i=>setQuery({tab:i?'cinemas':null})}/></div>
  {tab===0&&filmItems.length>0&&<div data-a className="pad" style={{paddingTop:12,fontSize:13,color:'var(--color-neutral-300)'}}>{tonightN?`${tonightN} από τις ${filmItems.length} παίζ${tonightN===1?'ει':'ουν'} απόψε.`:'Καμία από τις αποθηκευμένες δεν παίζει άλλο απόψε.'}</div>}
  <div ref={list} data-a style={{display:'flex',flexDirection:'column',gap:10,padding:'16px 20px 0'}}>
   {tab===0?filmItems.map(f=><Link key={f.key} to={f.to} className="saved-item">
    <Poster src={f.poster} title={f.title} striped={f.m===null}/>
    <div className="body"><div className="t">{f.title}</div><div className="s">{f.sub}</div>{lit(f.on,f.st.text)}
     {f.st.sub&&<div className="s st-sub">{f.st.sub}</div>}
     {f.flags.length>0&&<div className="st-flags">{f.flags.map(x=><span key={x.kind} className={'flag '+x.kind}>{x.label}</span>)}</div>}</div><CaretRight/></Link>)
   :cinemaItems.map(({v,on,status})=><Link key={v.id} to={cinemaRoute(v)} className="saved-item">
    <div className="tile" style={{'--hue':venueHue(v.id)} as CSSProperties}><ProjectorScreen/></div>
    <div className="body"><div className="t">{v.name}</div><div className="s">{v.area} · {v.addrShort}</div>{lit(on,status)}</div><CaretRight/></Link>)}
   {(tab===0?!filmItems.length:!cinemaItems.length)&&<div className="empty-card">{tab===0?'Πάτησε την καρδιά σε μια ταινία για να την κρατήσεις εδώ.':'Πάτησε το αστέρι σε ένα σινεμά για να το κρατήσεις εδώ.'}</div>}
  </div>
  <div data-a className="info-card"><BellRinging/><span>Ειδοποίηση όταν μια αποθηκευμένη ταινία μπει σε πρόγραμμα κοντά σου — αργότερα, στο native app.</span></div>
 </main>;
}
