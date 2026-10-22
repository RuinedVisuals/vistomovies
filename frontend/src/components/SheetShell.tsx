import {useEffect,useRef,type MutableRefObject,type ReactNode} from 'react';
import {gsap,reducedMotion} from '../lib/motion';

/** Bottom sheet with scrim: slides up, Escape / scrim / grabber close it, focus returns to the opener. */
export default function SheetShell({label,onClose,children,locked=false,closeRef}:{label:string;onClose:()=>void;children:ReactNode;locked?:boolean;closeRef?:MutableRefObject<(()=>void)|null>}){
 const sheet=useRef<HTMLDivElement>(null),scrim=useRef<HTMLDivElement>(null),closing=useRef(false),lock=useRef(locked);lock.current=locked;
 const close=()=>{
  if(closing.current||lock.current)return;closing.current=true;
  if(reducedMotion())return onClose();
  gsap.to(scrim.current,{opacity:0,duration:.25});gsap.to(sheet.current,{yPercent:100,duration:.32,ease:'power2.in',onComplete:onClose});
 };
 if(closeRef)closeRef.current=()=>{lock.current=false;close()};
 useEffect(()=>{
  const prev=document.activeElement as HTMLElement|null;
  const tl=gsap.timeline();tl.fromTo(scrim.current,{opacity:0},{opacity:1,duration:.3}).fromTo(sheet.current,{yPercent:reducedMotion()?0:100,opacity:reducedMotion()?0:1},{yPercent:0,opacity:1,duration:.6,ease:'expo.out'},0);
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};document.addEventListener('keydown',key);
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{tl.kill();document.removeEventListener('keydown',key);document.body.style.overflow=overflow;prev?.focus?.()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 return <>
  <div ref={scrim} className="scrim" onClick={close}/>
  <div ref={sheet} className="auth-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
   <button type="button" className="grabber" aria-label="Κλείσιμο" onClick={close}/>
   {children}
  </div>
 </>;
}
