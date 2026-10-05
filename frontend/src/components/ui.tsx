import {useState,type AnchorHTMLAttributes,type CSSProperties,type ReactNode} from 'react';
import {FilmStrip,ProjectorScreen,MapTrifold,Heart,Star} from '@phosphor-icons/react';
import {navigate} from '../lib/router';
import {pop} from '../lib/motion';
import {addDays} from '../lib/types';
import {wd} from '../lib/derive';

/** In-app link: real href (open in new tab works), client-side navigation on plain click. */
export function Link({to,replace,children,...rest}:{to:string;replace?:boolean;children?:ReactNode}&AnchorHTMLAttributes<HTMLAnchorElement>){
 return <a href={to} {...rest} onClick={e=>{rest.onClick?.(e);if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button!==0)return;e.preventDefault();navigate(to,{replace})}}>{children}</a>;
}

const NAV=[{to:'/movies',label:'Ταινίες',Icon:FilmStrip},{to:'/cinemas',label:'Σινεμά',Icon:ProjectorScreen},{to:'/map',label:'Χάρτης',Icon:MapTrifold},{to:'/saved',label:'Αγαπημένα',Icon:Heart}];
export function BottomNav({active}:{active:number}){
 return <nav className="bottom-nav" aria-label="Κύρια πλοήγηση">{NAV.map((n,i)=><Link key={n.to} to={n.to} aria-current={i===active?'page':undefined}>
  <span className="pill"><n.Icon weight={i===active?'fill':'regular'}/></span>{n.label}</Link>)}</nav>;
}

/** 7 day chips from today. Days past the coverage week are dimmed but still selectable. */
export function DateStrip({value,onPick,todayIso,weekStart,weekEnd,className=''}:{value:string;onPick:(d:string)=>void;todayIso:string;weekStart?:string;weekEnd?:string;className?:string}){
 const days=Array.from({length:7},(_,i)=>addDays(todayIso,i));
 return <div className={'hscroll date-strip '+className} role="group" aria-label="Ημερομηνία προβολών">{days.map(d=>{
  const outside=!!weekEnd&&(d>weekEnd||(!!weekStart&&d<weekStart));
  return <button key={d} type="button" className={'date-chip'+(outside?' outside':'')} aria-pressed={d===value}
   aria-label={d+(outside?' · εκτός κάλυψης προγράμματος':'')} onClick={e=>{onPick(d);pop(e.currentTarget,.88)}}>
   <span className="wd">{d===todayIso?'Σήμ':wd(d)}</span><span className="n">{d.slice(8)}</span></button>})}</div>;
}

export const hueOf=(s:string)=>{let h=0;for(const c of s)h=(h*33+c.charCodeAt(0))%360;return h};
/** Poster with TMDB/catalog image, hue placeholder, or striped "no TMDB" placeholder. */
export function Poster({src,title,striped,label,className='',style}:{src:string|null;title:string;striped?:boolean;label?:string;className?:string;style?:CSSProperties}){
 const [failed,setFailed]=useState(false);const show=src&&!failed;
 return <div className={'poster '+(striped&&!show?'striped ':'')+className} style={{'--hue':hueOf(title),...style} as CSSProperties}>
  {show?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:label&&<span className="plabel">{label}</span>}</div>;
}

export function HeartButton({on,onToggle,title,className='heart'}:{on:boolean;onToggle:()=>void;title:string;className?:string}){
 return <button type="button" className={className} aria-pressed={on} aria-label={(on?'Αφαίρεση από τη λίστα: ':'Αποθήκευση: ')+title}
  onClick={e=>{e.stopPropagation();onToggle();pop(e.currentTarget.firstElementChild)}}><Heart weight={on?'fill':'regular'}/></button>;
}
export function StarButton({on,onToggle,title,className='star'}:{on:boolean;onToggle:()=>void;title:string;className?:string}){
 return <button type="button" className={className} aria-pressed={on} aria-label={(on?'Αφαίρεση από αγαπημένα: ':'Αγαπημένο σινεμά: ')+title}
  onClick={e=>{e.stopPropagation();onToggle();pop(e.currentTarget.firstElementChild)}}><Star weight={on?'fill':'regular'}/></button>;
}

export function Segmented({options,value,onChange,label}:{options:string[];value:number;onChange:(i:number)=>void;label:string}){
 return <div className="seg" role="group" aria-label={label}>{options.map((o,i)=><button type="button" key={i} aria-pressed={i===value} onClick={()=>onChange(i)}>{o}</button>)}</div>;
}

export function SkeletonRows({n=5,poster=[82,122]}:{n?:number;poster?:[number,number]}){
 return <div aria-busy="true" aria-label="Φόρτωση">{Array.from({length:n},(_,i)=><div key={i} className="film-row">
  <div className="skel" style={{width:poster[0],height:poster[1],flex:'none'}}/>
  <div className="body"><div className="skel" style={{height:16,width:'70%'}}/><div className="skel" style={{height:12,width:'50%'}}/>
   <div style={{display:'flex',gap:6,marginTop:'auto'}}>{[0,1,2].map(j=><div key={j} className="skel" style={{width:58,height:32,borderRadius:8}}/>)}</div></div></div>)}</div>;
}
