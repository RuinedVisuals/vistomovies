import {useEffect,useRef,useState} from 'react';
import {Check,MagnifyingGlass,PaperPlaneTilt,UserPlus,X,Users} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {useApp} from '../lib/context';
import {acceptRequest,addFriend,inviteUrl,profileByUsername,removeFriendship,searchUsers,type Friendship,type Person,type useFriends} from '../lib/friends';
import {hueOf} from './ui';
import SheetShell from './SheetShell';

type Fr=ReturnType<typeof useFriends>;

/** Round photo for another user (photo, else initial on a hue derived from the name). */
export function Face({url,name,size=44}:{url:string|null|undefined;name:string;size?:number}){
 const [bad,setBad]=useState(false);useEffect(()=>setBad(false),[url]);
 return <div className="avatar" style={{width:size,height:size,fontSize:Math.round(size*.4),background:url&&!bad?undefined:`oklch(.34 .05 ${hueOf(name)})`}} aria-hidden="true">
  {url&&!bad?<img src={url} alt="" referrerPolicy="no-referrer" onError={()=>setBad(true)}/>:(name.trim().charAt(0)||'?').toUpperCase()}</div>;
}
const label=(p:{display_name:string|null;username:string|null})=>p.display_name||p.username||'Χρήστης';

/** Φίλοι tab: find by @username, share an invite link, answer requests, see friends. */
export default function FriendsTab({fr}:{fr:Fr}){
 const {session,openAccount}=useApp();const uid=session?.user.id;
 const [username,setUsername]=useState<string|null|undefined>(undefined);
 const [q,setQ]=useState(''),[results,setResults]=useState<Person[]|null>(null),[busy,setBusy]=useState(''),[msg,setMsg]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>{if(!supabase||!uid)return;let dead=false;
  supabase.from('profiles').select('username').eq('id',uid).maybeSingle().then(({data})=>{if(!dead)setUsername(data?.username||null)});
  return()=>{dead=true}},[uid,session?.user.updated_at]);
 // Debounced search; needs 3+ characters.
 useEffect(()=>{const t=q.replace(/^@/,'').trim();if(t.length<3){setResults(null);return}
  let dead=false;const id=setTimeout(async()=>{const r=await searchUsers(t);if(!dead)setResults(r)},300);return()=>{dead=true;clearTimeout(id)}},[q]);

 if(!supabase)return null;
 if(!session)return <div className="empty-card" style={{textAlign:'center'}}><Users size={26} color="var(--color-neutral-500)"/><strong>Συνδέσου για να βρεις φίλους</strong>
  <p>Με λογαριασμό μπορείς να προσθέσεις φίλους και να τους καλείς στο σινεμά.</p><button type="button" className="btn btn-primary" style={{marginTop:12}} onClick={openAccount}>Σύνδεση ή εγγραφή</button></div>;

 const act=async(key:string,fn:()=>Promise<string>)=>{setBusy(key);setMsg('');const e=await fn();if(e)setMsg(e);await fr.refresh();setBusy('')};
 const relation=(id:string)=>fr.items?.find(f=>f.user_id===id);
 const share=async()=>{if(!username)return;const url=inviteUrl(username),text='Πάμε σινεμά; Πρόσθεσέ με στο Visto:';
  try{if(navigator.share)await navigator.share({title:'Visto',text,url});else{await navigator.clipboard.writeText(`${text} ${url}`);setCopied(true);setTimeout(()=>setCopied(false),2500)}}catch{/* cancelled */}};

 const row=(f:Friendship,actions:React.ReactNode)=><div className="friend-row" key={f.friendship_id}>
  <Face url={f.avatar_url} name={label(f)}/><div className="body"><div className="t">{label(f)}</div><div className="s">{f.username?'@'+f.username:''}</div></div><div className="acts">{actions}</div></div>;
 const iconBtn=(cls:string,aria:string,on:()=>void,children:React.ReactNode,key:string)=><button type="button" className={'round-btn '+cls} aria-label={aria} disabled={busy===key} onClick={on}>{busy===key?<span className="spin"/>:children}</button>;

 return <div className="friends">
  <div className="invite-card">
   <div className="body"><div className="t">Κάλεσε φίλους</div>
    <div className="s">{username?<>Το προφίλ σου: <b>@{username}</b>. Στείλε τον σύνδεσμο και θα προστεθείτε με ένα πάτημα.</>:'Διάλεξε πρώτα ένα όνομα χρήστη, για να σε βρίσκουν οι φίλοι σου.'}</div></div>
   {username?<button type="button" className="btn btn-primary" onClick={share}><PaperPlaneTilt/>{copied?'Αντιγράφηκε':'Στείλε'}</button>
    :username===null?<button type="button" className="btn btn-primary" onClick={openAccount}>Όνομα χρήστη</button>:null}
  </div>

  <label className="search" style={{marginTop:12}}><MagnifyingGlass size={17}/><span className="sr-only">Αναζήτηση φίλου</span>
   <input type="search" value={q} placeholder="Βρες φίλο με @όνομα χρήστη" onChange={e=>setQ(e.target.value)} autoCapitalize="none" autoCorrect="off"/></label>
  {results&&<div className="friend-list">{results.length?results.map(p=>{const rel=relation(p.id);return <div className="friend-row" key={p.id}>
    <Face url={p.avatar_url} name={label(p)}/><div className="body"><div className="t">{label(p)}</div><div className="s">@{p.username}</div></div>
    <div className="acts">{rel?.status==='accepted'?<span className="tag tag-neutral">Φίλοι</span>
     :rel&&!rel.incoming?<span className="tag tag-outline">Εστάλη</span>
     :<button type="button" className="btn btn-primary small" disabled={busy===p.id} onClick={()=>act(p.id,()=>addFriend(uid!,p.id,fr.items))}>{busy===p.id?<span className="spin"/>:<><UserPlus/>{rel?'Αποδοχή':'Προσθήκη'}</>}</button>}</div></div>}):<div className="s" style={{padding:'12px 2px'}}>Δεν βρέθηκε κανείς με αυτό το όνομα χρήστη.</div>}</div>}
  {msg&&<div className="auth-error" role="alert">{msg}</div>}
  {fr.error&&<div className="auth-error" role="alert">{fr.error}</div>}

  {fr.incoming.length>0&&<><h3 className="sub-h" style={{marginTop:22}}>Αιτήματα ({fr.incoming.length})</h3><div className="friend-list">
   {fr.incoming.map(f=>row(f,<>{iconBtn('ok','Αποδοχή',()=>act(f.friendship_id,()=>acceptRequest(f.friendship_id)),<Check weight="bold"/>,f.friendship_id)}
    {iconBtn('no','Απόρριψη',()=>act('r'+f.friendship_id,()=>removeFriendship(f.friendship_id)),<X weight="bold"/>,'r'+f.friendship_id)}</>))}</div></>}

  <h3 className="sub-h" style={{marginTop:22}}>Φίλοι ({fr.friends.length})</h3>
  <div className="friend-list">{fr.items===null?<div className="skel" style={{height:60}}/>
   :fr.friends.length?fr.friends.map(f=>row(f,iconBtn('no','Αφαίρεση φίλου',()=>{if(confirm(`Αφαίρεση του ${label(f)} από τους φίλους;`))act(f.friendship_id,()=>removeFriendship(f.friendship_id))},<X/>,f.friendship_id)))
   :<div className="empty-card">Κανένας φίλος ακόμη. Στείλε τον σύνδεσμό σου ή ψάξε κάποιον με @όνομα χρήστη.</div>}</div>

  {fr.outgoing.length>0&&<><h3 className="sub-h" style={{marginTop:22}}>Σε αναμονή ({fr.outgoing.length})</h3><div className="friend-list">
   {fr.outgoing.map(f=>row(f,<button type="button" className="btn btn-secondary small" disabled={busy===f.friendship_id} onClick={()=>act(f.friendship_id,()=>removeFriendship(f.friendship_id))}>Ακύρωση</button>))}</div></>}
 </div>;
}

/** Opened from an invite link (/add/<username>): confirm adding that person. */
export function InviteSheet({username,fr,onClose,onDone}:{username:string;fr:Fr;onClose:()=>void;onDone:(m:string)=>void}){
 const {session}=useApp();const uid=session?.user.id;
 const [person,setPerson]=useState<Person|null|undefined>(undefined),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const closeRef=useRef<(()=>void)|null>(null);
 useEffect(()=>{let dead=false;profileByUsername(username).then(p=>{if(!dead)setPerson(p)});return()=>{dead=true}},[username]);
 const rel=person?fr.items?.find(f=>f.user_id===person.id):undefined;
 const self=!!person&&person.id===uid;
 const add=async()=>{if(!person||!uid)return;setBusy(true);setError('');
  const e=await addFriend(uid,person.id,fr.items);setBusy(false);
  if(e)return setError(e);await fr.refresh();onDone(rel?.incoming?'Είστε φίλοι!':'Το αίτημα στάλθηκε');closeRef.current?.()};
 return <SheetShell label="Πρόσκληση φίλου" onClose={onClose} closeRef={closeRef}>
  <div className="auth-body"><div className="auth-step" style={{alignItems:'center',textAlign:'center'}}>
   {person===undefined?<div className="spin" style={{margin:'30px 0'}}/>
   :person===null?<><h2 className="auth-title">Δεν βρέθηκε ο χρήστης</h2><p className="auth-sub">Ο σύνδεσμος μπορεί να είναι λάθος ή ο χρήστης να άλλαξε όνομα.</p></>
   :<><Face url={person.avatar_url} name={label(person)} size={84}/>
    <h2 className="auth-title">{label(person)}</h2><p className="auth-sub">@{person.username}</p>
    {self?<p className="auth-sub">Αυτός είναι ο δικός σου σύνδεσμος πρόσκλησης.</p>
    :rel?.status==='accepted'?<p className="auth-sub">Είστε ήδη φίλοι.</p>
    :rel&&!rel.incoming?<p className="auth-sub">Έχεις ήδη στείλει αίτημα. Περιμένει αποδοχή.</p>
    :<button type="button" className="btn btn-primary auth-cta" disabled={busy} onClick={add}>{busy?<span className="spin"/>:<><UserPlus/>{rel?'Αποδοχή αιτήματος':'Προσθήκη φίλου'}</>}</button>}
    {error&&<div className="auth-error" role="alert">{error}</div>}</>}
   <button type="button" className="auth-link" onClick={()=>closeRef.current?.()}>Κλείσιμο</button>
  </div></div>
 </SheetShell>;
}
