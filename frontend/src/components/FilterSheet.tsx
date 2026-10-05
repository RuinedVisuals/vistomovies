import {useEffect,useMemo,useRef,type ReactNode} from 'react';
import {Check,Sun,Armchair,Crosshair} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {setQuery} from '../lib/router';
import {gsap,pop,countTo,reducedMotion} from '../lib/motion';
import {addDays} from '../lib/types';
import {REGIONS} from '../lib/geo';
import {EMPTY_FILTERS,VERSION_LABEL,matchRow,scopeDays,shortDay,uniq,type Filters,type HallType} from '../lib/derive';
import {filtersQuery} from '../ShowtimesApp';

/** 03 Φίλτρα — every change is written to the URL immediately; counts come from the same rows as the feed. */
export default function FilterSheet({filters:f,day,onClose}:{filters:Filters;day:string;onClose:()=>void}){
 const {rows,week,films,todayIso,venueByName,userLoc,locate}=useApp();
 const sheet=useRef<HTMLDivElement>(null),scrim=useRef<HTMLDivElement>(null),count=useRef<HTMLSpanElement>(null),closing=useRef(false);
 const weekEnd=week?.weekEnd||todayIso;
 const ctx=useMemo(()=>({venues:venueByName,films,todayIso,userLoc}),[venueByName,films,todayIso,userLoc]);
 const days=scopeDays(f,day,todayIso,weekEnd);
 const result=rows.filter(r=>days.includes(r.programmeDate)&&matchRow(r,f,ctx));
 const n=uniq(result.map(r=>r.movie)).length;
 const genres=useMemo(()=>{const c=new Map<string,number>();for(const t of uniq(rows.map(r=>r.movie)))for(const g of films[t]?.genres||[])c.set(g,(c.get(g)||0)+1);
  return [...c].sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0])},[rows,films]);

 useEffect(()=>{countTo(count.current,n)},[n]);
 useEffect(()=>{
  const prev=document.activeElement as HTMLElement|null;sheet.current?.focus();
  const tl=gsap.timeline();tl.fromTo(scrim.current,{opacity:0},{opacity:1,duration:.3}).fromTo(sheet.current,{yPercent:reducedMotion()?0:100,opacity:reducedMotion()?0:1},{yPercent:0,opacity:1,duration:.7,ease:'expo.out'},0);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',key);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{tl.kill();document.removeEventListener('keydown',key);document.body.style.overflow=overflow;prev?.focus?.()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 function close(){
  if(closing.current)return;closing.current=true;
  if(reducedMotion())return onClose();
  gsap.to(scrim.current,{opacity:0,duration:.3});gsap.to(sheet.current,{yPercent:100,duration:.35,ease:'power2.in',onComplete:onClose});
 }
 const write=(next:Partial<Filters>,extra:Record<string,string|null>={})=>setQuery({...filtersQuery({...f,...next}),...extra});
 const multi=<K extends 'area'|'type'|'ver'|'genre'>(key:K,v:Filters[K][number])=>{const cur=f[key] as string[];write({[key]:cur.includes(v)?cur.filter(x=>x!==v):[...cur,v]} as Partial<Filters>)};
 const tomorrow=addDays(todayIso,1);
 return <>
  <div ref={scrim} className="scrim" onClick={close}/>
  <div ref={sheet} className="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filters-title" tabIndex={-1}>
   <button type="button" className="grabber" aria-label="Κλείσιμο φίλτρων" onClick={close}/>
   <div className="sheet-head"><h2 id="filters-title">Φίλτρα</h2>
    <button type="button" className="text-btn" onClick={()=>setQuery({...filtersQuery(EMPTY_FILTERS),date:null})}>Καθαρισμός</button></div>
   <div className="sheet-scroll">
    <Group label="Ημερομηνία">
     <Opt on={!f.range&&day===todayIso} onPick={()=>write({range:false},{date:null})}>Σήμερα</Opt>
     <Opt on={!f.range&&day===tomorrow} onPick={()=>write({range:false},{date:tomorrow})}>Αύριο</Opt>
     <Opt on={f.range} onPick={()=>write({range:true},{date:null})}>Έως {shortDay(weekEnd)}</Opt>
    </Group>
    <Group label="Περιοχή">{REGIONS.map(r=><Opt key={r} on={f.area.includes(r)} onPick={()=>multi('area',r)}>{r}</Opt>)}</Group>
    <Group label="Ώρα">{([['all','Όλες'],['now','Από τώρα'],['20','Μετά 20:00'],['22','Μετά 22:00']] as const).map(([k,l])=><Opt key={k} on={f.time===k} onPick={()=>write({time:k})}>{l}</Opt>)}</Group>
    <Group label="Τύπος αίθουσας">{([['summer','Θερινή',Sun],['indoor','Κλειστή',Armchair]] as const).map(([k,l,I])=><Opt key={k} on={f.type.includes(k as HallType)} icon={<I/>} onPick={()=>multi('type',k)}>{l}</Opt>)}</Group>
    <Group label="Έκδοση">{(['subtitled','dubbed','3d'] as const).map(k=><Opt key={k} on={f.ver.includes(k)} onPick={()=>multi('ver',k)}>{VERSION_LABEL[k]}</Opt>)}</Group>
    <Group label="Είδος">{genres.length?genres.map(g=><Opt key={g} on={f.genre.includes(g)} onPick={()=>multi('genre',g)}>{g}</Opt>)
     :<span style={{fontSize:13,color:'var(--color-neutral-500)'}}>Τα είδη εμφανίζονται όταν φορτώσουν τα στοιχεία TMDB.</span>}</Group>
    <div>
     <div className="fgroup-label"><span>Απόσταση</span><span className="val">{f.maxKm&&userLoc?`έως ${f.maxKm} χλμ`:'χωρίς όριο'}</span></div>
     <input className="range" type="range" min={1} max={16} step={1} disabled={!userLoc} aria-label="Μέγιστη απόσταση σε χιλιόμετρα"
      value={f.maxKm||16} onChange={e=>{const v=Number(e.target.value);write({maxKm:v>=16?null:v})}}/>
     {!userLoc&&<button type="button" className="range-note" onClick={()=>locate()}><Crosshair/>Χρειάζεται άδεια τοποθεσίας — προαιρετικό</button>}
    </div>
   </div>
   <div className="sheet-foot"><button type="button" className="btn btn-primary btn-block" onClick={close}>
    Δες <span ref={count} className="tnum"/> {n===1?'ταινία':'ταινίες'}<span className="shows">· {result.length} {result.length===1?'προβολή':'προβολές'}</span></button></div>
  </div>
 </>;
}
function Group({label,children}:{label:string;children:ReactNode}){
 return <div role="group" aria-label={label}><div className="fgroup-label">{label}</div><div className="fgroup-opts">{children}</div></div>;
}
function Opt({on,onPick,icon,children}:{on:boolean;onPick:()=>void;icon?:ReactNode;children:ReactNode}){
 return <button type="button" className="chip rect" aria-pressed={on} onClick={e=>{onPick();pop(e.currentTarget,.9)}}>{icon||(on&&<Check size={13}/>)}{children}</button>;
}
