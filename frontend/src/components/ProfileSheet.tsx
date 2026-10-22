import {useEffect,useRef,useState,type FormEvent} from 'react';
import {SignOut,Trash} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {USERNAME,authError,displayName,initialOf} from '../lib/auth';
import {useApp} from '../lib/context';
import SheetShell from './SheetShell';

/** Signed-in account: name, username, sign out, delete account (App Store requires in-app deletion). */
export default function ProfileSheet({onClose,onDone}:{onClose:()=>void;onDone:(msg:string)=>void}){
 const {session}=useApp();const uid=session?.user.id;
 const [name,setName]=useState(displayName(session)),[username,setUsername]=useState('');
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const closeRef=useRef<(()=>void)|null>(null);
 useEffect(()=>{if(!supabase||!uid)return;let dead=false;
  supabase.from('profiles').select('display_name,username').eq('id',uid).maybeSingle().then(({data})=>{
   if(dead)return;if(data){if(data.display_name)setName(data.display_name);setUsername(data.username||'')}setLoaded(true)});
  return()=>{dead=true}},[uid]);
 if(!session)return null;
 const save=async(e:FormEvent)=>{e.preventDefault();
  const u=username.trim().toLowerCase();
  if(u&&!USERNAME.test(u)){setError('Το όνομα χρήστη θέλει 3–20 λατινικά γράμματα, αριθμούς ή _');return}
  setBusy(true);setError('');
  const {error:er}=await supabase!.from('profiles').upsert({id:uid,display_name:name.trim()||null,username:u||null});
  if(er){setBusy(false);setError(er.code==='23505'?'Αυτό το όνομα χρήστη υπάρχει ήδη.':authError(er.message));return}
  await supabase!.auth.updateUser({data:{full_name:name.trim()}});
  setBusy(false);onDone('Αποθηκεύτηκε');closeRef.current?.()};
 const signOut=async()=>{await supabase!.auth.signOut();onDone('Αποσυνδέθηκες');closeRef.current?.()};
 const del=async()=>{setBusy(true);setError('');
  const {error:er}=await supabase!.rpc('delete_my_account');
  if(er){setBusy(false);setError('Η διαγραφή δεν ολοκληρώθηκε. Έχεις τρέξει το SQL του λογαριασμού στο Supabase;');return}
  await supabase!.auth.signOut();onDone('Ο λογαριασμός διαγράφηκε');closeRef.current?.()};
 return <SheetShell label="Λογαριασμός" onClose={onClose} closeRef={closeRef}>
  <div className="auth-body">
   <div className="prof-head"><div className="avatar big" aria-hidden="true">{initialOf(session)}</div>
    <div><div className="t">{name||displayName(session)}</div><div className="s">{session.user.email}</div></div></div>
   <form onSubmit={save} noValidate>
    <label className="auth-field"><span>Όνομα</span><input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="Πώς θα σε βλέπουν οι φίλοι σου" autoComplete="name"/></label>
    <label className="auth-field"><span>Όνομα χρήστη <em>για να σε βρίσκουν οι φίλοι</em></span>
     <div className="pw"><b className="at">@</b><input value={username} maxLength={20} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="onoma_xrhsth" autoCapitalize="none" autoCorrect="off" disabled={!loaded}/></div></label>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <button type="submit" className="btn btn-primary auth-cta" disabled={busy||!loaded}>{busy?<span className="spin" aria-label="Φόρτωση"/>:'Αποθήκευση'}</button>
   </form>
   <button type="button" className="btn btn-secondary auth-cta" onClick={signOut} disabled={busy}><SignOut/>Αποσύνδεση</button>
   <div className="danger">
    {confirmDelete?<><p>Θα διαγραφούν ο λογαριασμός και οι συγχρονισμένες λίστες σου. Δεν αναιρείται.</p>
     <div className="row"><button type="button" className="btn btn-secondary" onClick={()=>setConfirmDelete(false)} disabled={busy}>Άκυρο</button>
      <button type="button" className="btn btn-danger" onClick={del} disabled={busy}>Ναι, διαγραφή</button></div></>
     :<button type="button" className="auth-link danger-link" onClick={()=>setConfirmDelete(true)}><Trash/> Διαγραφή λογαριασμού</button>}
   </div>
  </div>
 </SheetShell>;
}
