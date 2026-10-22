import {useEffect,useRef,useState} from 'react';
import {FilmStrip,MapPin,UsersThree} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {tmdbImage} from '../lib/data';
import {gsap,reducedMotion} from '../lib/motion';
import {Poster} from './ui';

const KEY='visto.onboarded';
export const onboardingSeen=()=>{try{return localStorage.getItem(KEY)==='1'}catch{return true}};
const markSeen=()=>{try{localStorage.setItem(KEY,'1')}catch{/* private mode: shown again next visit */}};

const STEPS=[
 {Icon:FilmStrip,title:'Τι παίζει απόψε',text:'Όλες οι προβολές της Αθήνας σε ένα μέρος, με ωράριο, αίθουσα και εκδοχή.'},
 {Icon:MapPin,title:'Κοντά σου',text:'Με την τοποθεσία σου βλέπεις πρώτα τα κοντινότερα σινεμά και πόσο μακριά είναι.'},
 {Icon:UsersThree,title:'Πάμε μαζί',text:'Κάλεσε φίλους σε μια προβολή και δες ποιος έρχεται, με ένα tap.'},
];

/** First-run intro: three slides over the feed. Finishing or skipping never asks again. */
export default function Onboarding({onDone}:{onDone:()=>void}){
 const {films,locate,session,openAccount}=useApp();
 const [step,setStep]=useState(0);const root=useRef<HTMLDivElement>(null),slide=useRef<HTMLDivElement>(null),fan=useRef<HTMLDivElement>(null);
 const posters=Object.entries(films).filter(([,m])=>m?.posterPath).slice(0,3).map(([t,m])=>({title:t,src:tmdbImage(m!.posterPath,'w342')}));
 const last=step===STEPS.length-1;
 const finish=()=>{markSeen();if(reducedMotion())return onDone();gsap.to(root.current,{opacity:0,duration:.3,onComplete:onDone})};
 useEffect(()=>{
  const prev=document.body.style.overflow;document.body.style.overflow='hidden';
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')finish()};document.addEventListener('keydown',key);
  root.current?.focus();
  const t=gsap.fromTo(root.current,{opacity:0},{opacity:1,duration:.4});
  return()=>{t.kill();document.body.style.overflow=prev;document.removeEventListener('keydown',key)};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{// slide content in; poster fan springs open
  const items=slide.current?.querySelectorAll('[data-s]');
  const tl=gsap.timeline();
  if(items?.length)tl.fromTo(items,{y:reducedMotion()?0:18,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out',stagger:.07,clearProps:'transform,opacity'});
  const cards=fan.current?.children;
  if(cards?.length&&!reducedMotion())tl.fromTo(cards,{y:40,x:0,rotate:0,opacity:0},{y:0,x:(i:number)=>[-56,0,56][i]??0,rotate:(i:number)=>[-9,0,9][i]??0,opacity:1,duration:.7,ease:'back.out(1.6)',stagger:.08},0);
  return()=>{tl.kill()};
 },[step]);
 const next=async()=>{if(step===1)await locate();if(last)return finish();setStep(s=>s+1)};
 const {Icon,title,text}=STEPS[step];
 return <div ref={root} className="onboard" role="dialog" aria-modal="true" aria-label="Καλώς ήρθες" tabIndex={-1}>
  <button type="button" className="onb-skip" onClick={finish}>Παράλειψη</button>
  <div className="onb-art" aria-hidden="true">
   {step===0&&posters.length>0?<div ref={fan} className="onb-fan">{posters.map(p=><Poster key={p.title} src={p.src} title={p.title}/>)}</div>
    :<div className="onb-icon"><Icon weight="duotone"/></div>}
  </div>
  <div ref={slide} className="onb-body">
   <h1 data-s>{title}</h1>
   <p data-s>{text}</p>
  </div>
  <div className="onb-foot">
   <div className="onb-dots" aria-hidden="true">{STEPS.map((_,i)=><i key={i} className={i===step?'on':''}/>)}</div>
   <button type="button" className="btn btn-primary onb-cta" onClick={next}>{step===1?'Χρήση τοποθεσίας':last?'Ξεκίνα':'Συνέχεια'}</button>
   {step===1&&<button type="button" className="auth-link" onClick={()=>setStep(2)}>Όχι τώρα</button>}
   {last&&!session&&<button type="button" className="auth-link" onClick={()=>{finish();openAccount()}}>Έχω ήδη λογαριασμό · Σύνδεση</button>}
  </div>
 </div>;
}
