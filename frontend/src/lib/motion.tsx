import {useEffect,type DependencyList,type RefObject} from 'react';
import gsap from 'gsap';

export const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export {gsap};

/** Screen entrance: [data-a] elements stagger in (y 14→0, fade). Reduced motion keeps only the fade. */
export function useEntrance(ref:RefObject<HTMLElement|null>,deps:DependencyList){
 useEffect(()=>{
  const el=ref.current;if(!el)return;
  const items=el.querySelectorAll('[data-a]');if(!items.length)return;
  const tween=gsap.fromTo(items,{y:reducedMotion()?0:14,opacity:0},{y:0,opacity:1,duration:.55,ease:'power3.out',stagger:{each:.03,amount:Math.min(.9,items.length*.03)},clearProps:'transform,opacity'});
  return()=>{tween.kill();gsap.set(items,{clearProps:'transform,opacity'})};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },deps);
}
/** Tap feedback for chips/hearts/pins. */
export function pop(el:Element|null|undefined,from=.6){
 if(!el||reducedMotion())return;
 gsap.fromTo(el,{scale:from},{scale:1,duration:.45,ease:'back.out(3)',overwrite:true,clearProps:'scale'});
}
/** Tween a number inside an element (filter CTA count). */
export function countTo(el:HTMLElement|null,n:number){
 if(!el)return;if(reducedMotion()){el.textContent=String(n);return}
 counters.get(el)?.kill();
 const o={v:Number(el.textContent)||0};
 counters.set(el,gsap.to(o,{v:n,duration:.4,ease:'power2.out',onUpdate:()=>{el.textContent=String(Math.round(o.v))}}));
}
const counters=new WeakMap<HTMLElement,gsap.core.Tween>();
