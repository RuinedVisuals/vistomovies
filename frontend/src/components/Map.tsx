import {useEffect,useMemo,useRef,useState} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {MagnifyingGlass,ListBullets,SquaresFour,CalendarCheck,FilmSlate,Star,Crosshair,ArrowsIn,NavigationArrow,ArrowRight,X} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {setQuery,useRoute} from '../lib/router';
import {gsap,pop,reducedMotion} from '../lib/motion';
import {SYNTAGMA,directionsUrl,km,kmLabel} from '../lib/geo';
import {normalize} from '../lib/types';
import type {Venue} from '../lib/types';
import {cinemaInfo,cinemaRoute,filmRoute,groupBy,sortTimes,summarize} from '../lib/derive';
import {Link} from './ui';

const MODES=['all','today','film','fav'] as const;type Mode=typeof MODES[number];
const HOME={center:[23.735,37.99] as [number,number],zoom:11.2};
const FILM_SVG='<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 256 256" fill="currentColor"><path d="M216 40H40a16 16 0 0 0-16 16v144a16 16 0 0 0 16 16h176a16 16 0 0 0 16-16V56a16 16 0 0 0-16-16ZM56 200H40v-16h16Zm0-32H40v-16h16Zm0-32H40v-16h16Zm0-32H40V88h16Zm0-32H40V56h16Zm144 128H72V56h128Zm16 0h-16v-16h16Zm0-32h-16v-16h16Zm0-32h-16v-16h16Zm0-32h-16V88h16Zm0-32h-16V56h16Z"/></svg>';

/** 06 Χάρτης — one Mapbox instance, clustered GeoJSON source; modes filter the source itself. */
export default function MapScreen(){
 const {venues,rows,films,catalog,todayIso,favCinemas,userLoc,locate}=useApp();
 const {query}=useRoute();
 const token=import.meta.env.VITE_MAPBOX_TOKEN||'';
 const mode=(MODES.includes(query.get('mode') as Mode)?query.get('mode'):'today') as Mode;
 const todayRows=useMemo(()=>rows.filter(r=>r.programmeDate===todayIso),[rows,todayIso]);
 const todayBy=useMemo(()=>groupBy(todayRows,r=>r.cinema),[todayRows]);
 // Film mode: the film in the URL, else today's most widely shown film.
 const film=useMemo(()=>{const id=query.get('film');const r=id?rows.find(r=>filmRoute(r).id===id):null;
  return r?{id:id!,title:r.movie}:(()=>{const top=summarize(todayRows,films,catalog)[0];return top?{id:top.id,title:top.title}:null})()},[query.get('film'),rows,todayRows]);
 const from=userLoc||SYNTAGMA;
 const matches=(v:Venue)=>{const rs=todayBy.get(v.name)||[];
  return mode==='all'||(mode==='today'&&rs.length>0)||(mode==='film'&&!!film&&rs.some(r=>r.movie===film.title))||(mode==='fav'&&favCinemas.has(v.id))};
 const points=venues.filter(v=>v.lng!=null&&v.lat!=null&&matches(v));
 const pointKey=points.map(p=>p.id).join();
 const selId=query.get('cinema');
 const selected=(selId&&venues.find(v=>v.id===selId))||[...points].sort((a,b)=>Number((todayBy.get(b.name)||[]).length>0)-Number((todayBy.get(a.name)||[]).length>0)||(km(a,from)??99)-(km(b,from)??99))[0]||null;

 const box=useRef<HTMLDivElement>(null),mapRef=useRef<mapboxgl.Map|null>(null),card=useRef<HTMLDivElement>(null);
 const markers=useRef(new Map<string,{marker:mapboxgl.Marker;el:HTMLButtonElement}>());
 const selRef=useRef<string|null>(null);selRef.current=selected?.id||null;
 const areaRef=useRef(new Map<string,string>());
 const [mapError,setMapError]=useState(''),[zoomed,setZoomed]=useState(false),[q,setQ]=useState('');
 const userMarker=useRef<mapboxgl.Marker|null>(null);

 const select=(id:string)=>setQuery({cinema:id});
 const selectRef=useRef(select);selectRef.current=select;

 // ---- map lifecycle (once) ----
 useEffect(()=>{
  if(!token.startsWith('pk.')||!box.current)return;
  let map:mapboxgl.Map;
  try{map=new mapboxgl.Map({container:box.current,accessToken:token,style:'mapbox://styles/mapbox/dark-v11',center:HOME.center,zoom:HOME.zoom,attributionControl:false,pitchWithRotate:false,dragRotate:false})}
  catch{setMapError('Ο browser δεν μπόρεσε να ανοίξει τον χάρτη.');return}
  map.addControl(new mapboxgl.AttributionControl({compact:true}),'bottom-left');
  mapRef.current=map;
  map.setPadding({top:120,bottom:330,left:0,right:0});map.jumpTo(HOME);
  map.on('error',()=>setMapError('Ο χάρτης δεν φόρτωσε πλήρως. Έλεγξε σύνδεση και ρύθμιση Mapbox.'));
  map.on('style.load',()=>{
   tune(map);
   map.addSource('cinemas',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:46,clusterMaxZoom:15});
   map.addLayer({id:'cinemas-hit',type:'circle',source:'cinemas',paint:{'circle-radius':1,'circle-opacity':0}});
   map.fire('visto:ready');
  });
  map.on('zoomend',()=>setZoomed(map.getZoom()>HOME.zoom+.6));
  map.on('render',()=>sync(map));
  return()=>{markers.current.forEach(m=>m.marker.remove());markers.current.clear();map.remove();mapRef.current=null};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[token]);

 // ---- feed the clustered source (mode filter) ----
 useEffect(()=>{
  const map=mapRef.current;if(!map)return;
  const data={type:'FeatureCollection',features:points.map(v=>({type:'Feature',id:v.id,geometry:{type:'Point',coordinates:[v.lng!,v.lat!]},
   properties:{id:v.id,name:v.name,area:v.area}}))} as Parameters<mapboxgl.GeoJSONSource['setData']>[0];
  const apply=()=>{(map.getSource('cinemas') as mapboxgl.GeoJSONSource|undefined)?.setData(data);areaRef.current.clear()};
  if(map.getSource('cinemas'))apply();else map.once('visto:ready' as 'load',apply);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[pointKey,mapRef.current]);

 // ---- selection: restyle markers, nudge card ----
 useEffect(()=>{
  const map=mapRef.current;if(map)sync(map);
  if(card.current&&!reducedMotion())gsap.fromTo(card.current,{y:16,opacity:.4},{y:0,opacity:1,duration:.4,ease:'power3.out'});
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected?.id]);

 /** Mirror rendered clusters/points as HTML markers (Mapbox "HTML clusters" pattern). */
 function sync(map:mapboxgl.Map){
  if(!map.getSource('cinemas')||!map.isSourceLoaded('cinemas'))return;
  const seen=new Set<string>(),fresh:HTMLElement[]=[];const zoom=map.getZoom();
  for(const raw of map.querySourceFeatures('cinemas')){
   const f=raw as unknown as {properties:Record<string,unknown>;geometry:{coordinates:number[]}};
   const p=f.properties as unknown as {cluster?:boolean;cluster_id?:number;point_count?:number;id?:string;name?:string;area?:string};
   const key=p.cluster?'c'+p.cluster_id:'p'+p.id;if(seen.has(key))continue;seen.add(key);
   const coords=f.geometry.coordinates as [number,number];
   let m=markers.current.get(key);
   if(!m){
    const el=document.createElement('button');el.type='button';el.className='mk'+(p.cluster?' cl':'');
    el.innerHTML='<span class="dot"></span><span class="lbl"></span>';
    if(p.cluster){
     el.querySelector('.dot')!.textContent=String(p.point_count);el.setAttribute('aria-label',`${p.point_count} σινεμά — μεγέθυνση`);
     el.onclick=()=>map.easeTo({center:coords,zoom:map.getZoom()+Math.log2(2.5),duration:reducedMotion()?0:600});
     const src=map.getSource('cinemas') as mapboxgl.GeoJSONSource;const cid=p.cluster_id!;
     src.getClusterLeaves(cid,Infinity,0,(err,leaves)=>{if(err||!leaves)return;const c=new Map<string,number>();
      for(const l of leaves){const a=(l.properties as {area:string}).area;c.set(a,(c.get(a)||0)+1)}
      const top=[...c].sort((a,b)=>b[1]-a[1])[0]?.[0]||'';areaRef.current.set(key,top);el.querySelector('.lbl')!.textContent=top;
      el.dataset.ids=leaves.map(l=>(l.properties as {id:string}).id).join();el.classList.toggle('has-sel',!!selRef.current&&el.dataset.ids.split(',').includes(selRef.current));
     });
    }else{
     el.querySelector('.dot')!.innerHTML=FILM_SVG;el.setAttribute('aria-label',p.name||'');
     el.onclick=()=>{selectRef.current(p.id!);pop(el.querySelector('.dot'),.5)};
    }
    m={el,marker:new mapboxgl.Marker({element:el,anchor:'top',offset:[0,-17]}).setLngLat(coords).addTo(map)};
    markers.current.set(key,m);fresh.push(el.querySelector('.dot')!);
   }
   if(!p.cluster){
    const sel=p.id===selRef.current;m.el.classList.toggle('sel',sel);
    const short=(p.name||'').replace(/^(Village Cinemas|Δημ\. Κιν\.)\s*/,'').split(/,| - /)[0].replace(/\s*\(.*\)$/,'').trim();
    m.el.querySelector('.lbl')!.textContent=sel||zoom>=14?(short.length>18?short.split(' ').slice(0,2).join(' '):short):'';
    m.el.style.zIndex=sel?'3':'1';
   }else if(m.el.dataset.ids){m.el.classList.toggle('has-sel',!!selRef.current&&m.el.dataset.ids.split(',').includes(selRef.current))}
  }
  for(const [k,m] of markers.current)if(!seen.has(k)){m.marker.remove();markers.current.delete(k)}
  if(fresh.length&&!reducedMotion())gsap.fromTo(fresh,{scale:0},{scale:1,duration:.45,stagger:.03,ease:'back.out(2.5)'});
 }

 const fly=(v:Venue)=>{if(v.lng!=null&&mapRef.current)mapRef.current.flyTo({center:[v.lng,v.lat!],zoom:Math.max(14,mapRef.current.getZoom()),duration:reducedMotion()?0:900})};
 async function locateOrReset(){
  const map=mapRef.current;
  if(zoomed){map?.flyTo({...HOME,duration:reducedMotion()?0:800});return}
  const loc=await locate();if(!loc||!map)return;
  if(!userMarker.current){const el=document.createElement('div');el.style.cssText='width:14px;height:14px;border-radius:50%;background:var(--color-accent-200);box-shadow:0 0 0 5px color-mix(in srgb,var(--color-accent) 35%,transparent)';userMarker.current=new mapboxgl.Marker({element:el})}
  userMarker.current.setLngLat(loc).addTo(map);map.flyTo({center:loc,zoom:13.5});
 }

 const info=selected?cinemaInfo(selected,todayBy.get(selected.name)||[]):null;
 const selRows=info?[...groupBy(info.rows.filter(r=>mode!=='film'||r.movie===film?.title),r=>r.movie)].map(([title,rs])=>({title,times:sortTimes(rs.map(r=>r.time)).slice(0,3).join(' · ')})):[];
 const results=q?venues.filter(v=>normalize(v.name+' '+v.area+' '+v.address).includes(normalize(q))).slice(0,8):[];
 const modeBtns=[{m:'all',label:'Όλα',Icon:SquaresFour},{m:'today',label:'Σήμερα',Icon:CalendarCheck},{m:'film',label:film?(film.title.length>12?film.title.slice(0,10).trim()+'…':film.title):'Ταινία',Icon:FilmSlate},{m:'fav',label:'Αγαπημένα',Icon:Star}] as const;

 return <main className="map-screen">
  <div ref={box} className="map-canvas" aria-label="Χάρτης κινηματογράφων"/>
  {!token.startsWith('pk.')&&<div className="map-fallback">Ο χάρτης χρειάζεται ρύθμιση Mapbox (VITE_MAPBOX_TOKEN στο frontend/.env.local). Η λίστα και η κάρτα παρακάτω λειτουργούν κανονικά.</div>}
  <div className="map-top">
   <div style={{display:'flex',gap:8}}>
    <label className="search"><MagnifyingGlass size={17}/><span className="sr-only">Αναζήτηση στον χάρτη</span><input type="search" value={q} placeholder="Περιοχή ή σινεμά" onChange={e=>setQ(e.target.value)}/>
     {q&&<button type="button" className="clear" aria-label="Καθαρισμός" onClick={()=>setQ('')}><X size={15}/></button>}</label>
    <Link to="/cinemas" className="icon-btn" aria-label="Λίστα κινηματογράφων" style={{color:'var(--color-text)'}}><ListBullets/></Link>
   </div>
   {results.length>0&&<div className="map-results">{results.map(v=><button key={v.id} type="button" onClick={()=>{setQ('');
    setQuery({cinema:v.id,mode:v.lng!=null&&!matches(v)?'all':mode});fly(v)}}>{v.name}<small>{v.area} · {v.lng==null?'χωρίς θέση στον χάρτη':kmLabel(km(v,from))}</small></button>)}</div>}
   <div className="hscroll chip-row">{modeBtns.map(b=><button key={b.m} type="button" className="chip" aria-pressed={mode===b.m} disabled={b.m==='film'&&!film}
    onClick={e=>{setQuery({mode:b.m==='today'?null:b.m,film:b.m==='film'?film?.id:query.get('film')});pop(e.currentTarget,.9)}}><b.Icon/>{b.label}</button>)}</div>
  </div>
  {mapError&&<div className="notice" style={{position:'absolute',top:'calc(var(--safe-top) + 120px)',left:0,right:0,zIndex:5}}>{mapError}</div>}
  <div className="map-bottom">
   <button type="button" className="locate" onClick={locateOrReset} aria-label={zoomed?'Σμίκρυνση στην Αθήνα':'Η τοποθεσία μου'}>{zoomed?<ArrowsIn/>:<Crosshair/>}</button>
   {selected&&info?<div ref={card} className="map-card">
    <div style={{display:'flex',justifyContent:'space-between',gap:8}}><div style={{minWidth:0}}><div className="name">{selected.name}</div>
     <div className="sub">{[selected.addrShort,selected.area,kmLabel(km(selected,from))].join(' · ')}{selected.precision==='approximate'?' · θέση κατά προσέγγιση':selected.precision==='address'?' · θέση από διεύθυνση':''}</div></div>
     <span className={info.has?'tag tag-accent':'tag tag-outline'} style={{alignSelf:'flex-start'}}>{info.has?'Προβολές σήμερα':'Χωρίς πρόγραμμα'}</span></div>
    <div className="rows">{selRows.slice(0,3).map(r=><div key={r.title} className="r"><span>{r.title}</span><span>{r.times}</span></div>)}
     {!selRows.length&&<div style={{fontSize:13,color:'var(--color-neutral-500)'}}>Δεν υπάρχει διαθέσιμο πρόγραμμα για σήμερα.</div>}</div>
    <div className="actions"><a className="btn btn-primary" href={directionsUrl(selected)} target="_blank" rel="noreferrer"><NavigationArrow/>Οδηγίες</a>
     <Link className="btn btn-secondary" to={cinemaRoute(selected)}>Πρόγραμμα<ArrowRight/></Link></div>
   </div>:<div ref={card} className="map-card"><div className="sub">Κανένα σινεμά σε αυτή τη λειτουργία.</div></div>}
  </div>
 </main>;
}

/** Retint Mapbox dark-v11 toward Nocturne: land neutral-900, roads 4–9% text tint, water bg-tinted. */
function tune(map:mapboxgl.Map){
 for(const l of map.getStyle()?.layers||[]){
  const set=(p:string,v:unknown)=>{try{map.setPaintProperty(l.id,p as never,v as never)}catch{/* layer lacks prop */}};
  const id=l.id;
  if(l.type==='background')set('background-color','#292b31');
  else if(l.type==='fill'){if(/water/.test(id))set('fill-color','#161826');else if(/building/.test(id))set('fill-color','#2e3038');else set('fill-color','#2b2d34')}
  else if(l.type==='line'){
   if(/water/.test(id))set('line-color','#161826');
   else if(/motorway|trunk|primary/.test(id))set('line-color','rgba(233,233,237,0.09)');
   else if(/road|street|bridge|tunnel|path|link|secondary|tertiary|rail/.test(id))set('line-color','rgba(233,233,237,0.045)');
   else if(/admin|boundary/.test(id))set('line-color','rgba(233,233,237,0.08)');
  }else if(l.type==='symbol'){
   if(/poi|transit|airport|road-number|road-exit/.test(id)){try{map.setLayoutProperty(id,'visibility','none')}catch{/* */}continue}
   set('text-color','#75798c');set('text-halo-color','#292b31');
   try{if(map.getLayoutProperty(id,'text-field'))map.setLayoutProperty(id,'text-field',['coalesce',['get','name_el'],['get','name']])}catch{/* */}
  }
 }
}
