import {useRef,useState} from 'react';
import {Check,Clock,PaperPlaneTilt,Question,Trash,X,Users} from '@phosphor-icons/react';
import {useApp} from '../lib/context';
import {useEntrance} from '../lib/motion';
import {answerPlan,cancelPlan,createPlan,type NewPlan,type Plan,type PlanStatus} from '../lib/plans';
import {useFriends} from '../lib/friends';
import {shortDay} from '../lib/derive';
import {Link} from './ui';
import {Face} from './Friends';
import SheetShell from './SheetShell';

const STATUS:Record<PlanStatus,{label:string;Icon:typeof Check}>={invited:{label:'Περιμένει',Icon:Clock},going:{label:'Έρχεται',Icon:Check},maybe:{label:'Ίσως',Icon:Question},declined:{label:'Δεν μπορεί',Icon:X}};
const short=(s:string)=>s.split(',')[0];

/** "Πάμε μαζί": choose friends and send the invitation for one screening. */
export function PlanSheet({plan,onLink,onClose,onDone}:{plan:NewPlan;onLink:()=>void;onClose:()=>void;onDone:(m:string)=>void}){
 const {session,plans}=useApp();const uid=session!.user.id;
 const fr=useFriends(uid);
 const [picked,setPicked]=useState<string[]>([]),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const closeRef=useRef<(()=>void)|null>(null);
 const toggle=(id:string)=>setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
 const send=async()=>{setBusy(true);setError('');const e=await createPlan(uid,{...plan,note},picked);setBusy(false);
  if(e)return setError(e);await plans.refresh();onDone(picked.length===1?'Η πρόσκληση στάλθηκε':`Στάλθηκαν ${picked.length} προσκλήσεις`);closeRef.current?.()};
 return <SheetShell label="Πάμε μαζί" onClose={onClose} closeRef={closeRef}>
  <div className="auth-body"><div className="auth-step">
   <h2 className="auth-title">Πάμε μαζί;</h2>
   <div className="plan-what"><b>{plan.film_title}</b><span>{shortDay(plan.show_date)} {plan.show_time} · {short(plan.cinema_name)}</span></div>
   {fr.items===null?<div className="skel" style={{height:56}}/>
   :fr.friends.length?<div className="pick-list" role="group" aria-label="Φίλοι">{fr.friends.map(f=>{const on=picked.includes(f.user_id);return <button type="button" key={f.user_id} className={'pick'+(on?' on':'')} aria-pressed={on} onClick={()=>toggle(f.user_id)}>
     <Face url={f.avatar_url} name={f.display_name||f.username||'?'} size={40}/><span className="n">{f.display_name||f.username}</span><span className="chk">{on&&<Check weight="bold"/>}</span></button>})}</div>
   :<div className="empty-card"><Users size={22} color="var(--color-neutral-500)"/><strong>Δεν έχεις φίλους ακόμη</strong><p>Πρόσθεσε φίλους από τα Αγαπημένα → Φίλοι, ή μοιράσου σύνδεσμο.</p></div>}
   {fr.friends.length>0&&<label className="auth-field"><span>Μήνυμα (προαιρετικό)</span><input value={note} maxLength={140} onChange={e=>setNote(e.target.value)} placeholder="π.χ. φεύγουμε μαζί από το Σύνταγμα"/></label>}
   {error&&<div className="auth-error" role="alert">{error}</div>}
   {fr.friends.length>0&&<button type="button" className="btn btn-primary auth-cta" disabled={busy||!picked.length} onClick={send}>
    {busy?<span className="spin"/>:<><PaperPlaneTilt/>{picked.length?`Στείλε σε ${picked.length}`:'Διάλεξε φίλους'}</>}</button>}
   <button type="button" className="auth-link" onClick={()=>{onLink();closeRef.current?.()}}>Ή μοιράσου σύνδεσμο</button>
  </div></div>
 </SheetShell>;
}

function PlanCard({p,uid,busy,act}:{p:Plan;uid:string;busy:string;act:(key:string,fn:()=>Promise<string>)=>void}){
 const mine=p.owner===uid;const href=`/movies/${p.film_route}?date=${p.show_date}&cinema=${p.cinema_id}&time=${p.show_time}`;
 const answers=['going','maybe','declined'] as const;
 return <article className="plan-card" data-a>
  <div className="who">{mine?<span>Εσύ καλείς</span>:<><Face url={p.owner_avatar} name={p.owner_name} size={26}/><span><b>{p.owner_name}</b> σε καλεί</span></>}</div>
  <Link className="film" to={href}>{p.film_title}</Link>
  <div className="when">{shortDay(p.show_date)} · {p.show_time} · {short(p.cinema_name)}</div>
  {p.note&&<div className="note">«{p.note}»</div>}
  {p.people.length>0&&<div className="people">{p.people.filter(x=>x.user_id!==uid||mine).map(x=>{const {label,Icon}={label:STATUS[x.status].label,Icon:STATUS[x.status].Icon};
   return <span key={x.user_id} className={'person '+x.status} title={`${x.name}: ${label}`}><Face url={x.avatar_url} name={x.name} size={28}/><i><Icon weight="bold"/></i></span>})}
   <span className="sum">{p.people.filter(x=>x.status==='going').length} έρχονται</span></div>}
  {!mine&&<div className="answers" role="group" aria-label="Απάντηση">{answers.map(s=><button type="button" key={s} className={'ans '+s+(p.my_status===s?' on':'')} aria-pressed={p.my_status===s} disabled={busy===p.id+s}
   onClick={()=>act(p.id+s,()=>answerPlan(p.id,uid,s))}>{s==='going'?'Έρχομαι':s==='maybe'?'Ίσως':'Δεν μπορώ'}</button>)}</div>}
  {mine&&<button type="button" className="auth-link danger-link" style={{margin:'6px 0 0'}} disabled={busy===p.id+'x'} onClick={()=>{if(confirm('Ακύρωση της πρόσκλησης;'))act(p.id+'x',()=>cancelPlan(p.id))}}><Trash/> Ακύρωση πρόσκλησης</button>}
 </article>;
}

/** Σχέδια: invitations waiting for my answer, then upcoming plans. */
export default function Plans(){
 const {session,plans,todayIso,openAccount,notify}=useApp();const uid=session?.user.id;
 const ref=useRef<HTMLElement>(null);const [busy,setBusy]=useState(''),[msg,setMsg]=useState('');
 useEntrance(ref,[plans.items===null]);
 const act=async(key:string,fn:()=>Promise<string>)=>{setBusy(key);setMsg('');const e=await fn();if(e)setMsg(e);else notify('Αποθηκεύτηκε');await plans.refresh();setBusy('')};
 const all=(plans.items||[]).filter(p=>p.show_date>=todayIso);
 const invited=all.filter(p=>p.my_status==='invited'),rest=all.filter(p=>p.my_status!=='invited');
 return <main className="screen" ref={ref}>
  <div data-a className="page-head"><div className="over">Με φίλους</div><h1>Σχέδια</h1></div>
  <div className="pad" style={{paddingTop:16,display:'flex',flexDirection:'column',gap:10}}>
   {!session?<div className="empty-card" style={{textAlign:'center'}}><Users size={26} color="var(--color-neutral-500)"/><strong>Συνδέσου για να δεις τα σχέδιά σου</strong>
    <button type="button" className="btn btn-primary" style={{marginTop:12}} onClick={openAccount}>Σύνδεση ή εγγραφή</button></div>
   :plans.items===null?<div className="skel" style={{height:120}}/>:<>
    {plans.error&&<div className="auth-error" role="alert">{plans.error}</div>}{msg&&<div className="auth-error" role="alert">{msg}</div>}
    {invited.length>0&&<h3 className="sub-h" data-a>Προσκλήσεις ({invited.length})</h3>}
    {invited.map(p=><PlanCard key={p.id} p={p} uid={uid!} busy={busy} act={act}/>)}
    {rest.length>0&&<h3 className="sub-h" data-a style={{marginTop:invited.length?12:0}}>Επερχόμενα</h3>}
    {rest.map(p=><PlanCard key={p.id} p={p} uid={uid!} busy={busy} act={act}/>)}
    {!all.length&&!plans.error&&<div className="empty-card" data-a><strong>Κανένα σχέδιο ακόμη</strong><p>Άνοιξε μια ταινία, διάλεξε ώρα και πάτα «Πάμε μαζί» για να καλέσεις φίλους.</p></div>}
   </>}
  </div>
 </main>;
}
