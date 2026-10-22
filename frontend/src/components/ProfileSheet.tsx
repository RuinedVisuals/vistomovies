import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Camera,SignOut,Trash} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {USERNAME,authError,displayName,hasOwnAvatar,passwordStrength,squareJpeg,validEmail} from '../lib/auth';
import {useApp} from '../lib/context';
import SheetShell from './SheetShell';
import Avatar from './Avatar';

/** Signed-in account: photo, name, username, email, password, sign out, delete account (App Store requires in-app deletion). */
export default function ProfileSheet({onClose,onDone}:{onClose:()=>void;onDone:(msg:string)=>void}){
 const {session}=useApp();const uid=session?.user.id;
 const [name,setName]=useState(displayName(session)),[username,setUsername]=useState('');
 const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[error,setError]=useState(''),[confirmDelete,setConfirmDelete]=useState(false);
 const [newEmail,setNewEmail]=useState(''),[newPass,setNewPass]=useState(''),[secMsg,setSecMsg]=useState(''),[secErr,setSecErr]=useState('');
 const closeRef=useRef<(()=>void)|null>(null),file=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(!supabase||!uid)return;let dead=false;
  supabase.from('profiles').select('display_name,username').eq('id',uid).maybeSingle().then(({data})=>{
   if(dead)return;if(data){if(data.display_name)setName(data.display_name);setUsername(data.username||'')}setLoaded(true)});
  return()=>{dead=true}},[uid]);
 if(!session)return null;
 const path=`${uid}/avatar.jpg`;

 const pickPhoto=async(f?:File)=>{
  if(!f)return;if(!f.type.startsWith('image/')){setError('Διάλεξε μια εικόνα.');return}
  setPhotoBusy(true);setError('');
  try{
   const blob=await squareJpeg(f);
   const {error:up}=await supabase!.storage.from('avatars').upload(path,blob,{upsert:true,contentType:'image/jpeg',cacheControl:'3600'});
   if(up)throw up;
   const url=supabase!.storage.from('avatars').getPublicUrl(path).data.publicUrl+'?v='+Date.now();
   const {error:ue}=await supabase!.auth.updateUser({data:{avatar_url:url}});if(ue)throw ue;
  }catch(e){setError(String((e as {message?:string}).message||'').includes('Bucket')?'Λείπει ο χώρος αποθήκευσης φωτογραφιών. Τρέξε το SQL των avatars στο Supabase.':'Η φωτογραφία δεν ανέβηκε. Δοκίμασε άλλη εικόνα.')}
  setPhotoBusy(false);if(file.current)file.current.value='';
 };
 const removePhoto=async()=>{setPhotoBusy(true);setError('');
  await supabase!.storage.from('avatars').remove([path]);
  const {error:ue}=await supabase!.auth.updateUser({data:{avatar_url:null}});if(ue)setError(authError(ue.message));setPhotoBusy(false)};

 const save=async(e:FormEvent)=>{e.preventDefault();
  const u=username.trim().toLowerCase();
  if(u&&!USERNAME.test(u)){setError('Το όνομα χρήστη θέλει 3–20 λατινικά γράμματα, αριθμούς ή _');return}
  setBusy(true);setError('');
  const {error:er}=await supabase!.from('profiles').upsert({id:uid,display_name:name.trim()||null,username:u||null});
  if(er){setBusy(false);setError(er.code==='23505'?'Αυτό το όνομα χρήστη υπάρχει ήδη.':authError(er.message));return}
  await supabase!.auth.updateUser({data:{full_name:name.trim()}});
  setBusy(false);onDone('Αποθηκεύτηκε');closeRef.current?.()};
 const changePass=async(e:FormEvent)=>{e.preventDefault();setSecMsg('');setSecErr('');
  if(newPass.length<8){setSecErr('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');return}
  setBusy(true);const {error:er}=await supabase!.auth.updateUser({password:newPass});setBusy(false);
  if(er)setSecErr(authError(er.message));else{setNewPass('');setSecMsg('Ο κωδικός άλλαξε.')}};
 const changeEmail=async(e:FormEvent)=>{e.preventDefault();setSecMsg('');setSecErr('');
  if(!validEmail(newEmail)){setSecErr('Γράψε ένα έγκυρο email.');return}
  setBusy(true);const {error:er}=await supabase!.auth.updateUser({email:newEmail.trim()},{emailRedirectTo:location.origin+'/saved'});setBusy(false);
  if(er)setSecErr(authError(er.message));else{setNewEmail('');setSecMsg('Στείλαμε επιβεβαίωση στο νέο email. Άνοιξε τον σύνδεσμο για να ολοκληρωθεί.')}};
 const signOut=async()=>{await supabase!.auth.signOut();onDone('Αποσυνδέθηκες');closeRef.current?.()};
 const del=async()=>{setBusy(true);setError('');
  await supabase!.storage.from('avatars').remove([path]);
  const {error:er}=await supabase!.rpc('delete_my_account');
  if(er){setBusy(false);setError('Η διαγραφή δεν ολοκληρώθηκε. Έχεις τρέξει το SQL του λογαριασμού στο Supabase;');return}
  await supabase!.auth.signOut();onDone('Ο λογαριασμός διαγράφηκε');closeRef.current?.()};
 const st=passwordStrength(newPass);
 return <SheetShell label="Λογαριασμός" onClose={onClose} closeRef={closeRef}>
  <div className="auth-body">
   <div className="prof-head">
    <div className="avatar-edit"><Avatar session={session} size={72}/>
     <button type="button" className="cam" onClick={()=>file.current?.click()} disabled={photoBusy} aria-label="Αλλαγή φωτογραφίας">{photoBusy?<span className="spin"/>:<Camera weight="fill"/>}</button>
     <input ref={file} type="file" accept="image/*" hidden onChange={e=>pickPhoto(e.target.files?.[0])}/></div>
    <div style={{minWidth:0}}><div className="t">{name||displayName(session)}</div><div className="s">{session.user.email}</div>
     {hasOwnAvatar(session)&&<button type="button" className="auth-link" style={{margin:0,minHeight:28,fontSize:12}} onClick={removePhoto} disabled={photoBusy}>Αφαίρεση φωτογραφίας</button>}</div>
   </div>
   <form onSubmit={save} noValidate>
    <label className="auth-field"><span>Όνομα</span><input value={name} maxLength={40} onChange={e=>setName(e.target.value)} placeholder="Πώς θα σε βλέπουν οι φίλοι σου" autoComplete="name"/></label>
    <label className="auth-field"><span>Όνομα χρήστη <em>για να σε βρίσκουν οι φίλοι</em></span>
     <div className="pw"><b className="at">@</b><input value={username} maxLength={20} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="onoma_xrhsth" autoCapitalize="none" autoCorrect="off" disabled={!loaded}/></div></label>
    {error&&<div className="auth-error" role="alert">{error}</div>}
    <button type="submit" className="btn btn-primary auth-cta" disabled={busy||!loaded}>{busy?<span className="spin" aria-label="Φόρτωση"/>:'Αποθήκευση'}</button>
   </form>

   <details className="auth-details"><summary>Ασφάλεια και email</summary>
    <form onSubmit={changePass} noValidate>
     <label className="auth-field"><span>Νέος κωδικός</span><input type="password" autoComplete="new-password" placeholder="τουλάχιστον 8 χαρακτήρες" value={newPass} onChange={e=>setNewPass(e.target.value)}/></label>
     {newPass&&<div className={'strength s'+st.score}><div className="bars">{[1,2,3,4].map(i=><i key={i} className={i<=st.score?'on':''}/>)}</div><span>{st.label}</span></div>}
     <button type="submit" className="btn btn-secondary auth-cta" disabled={busy||!newPass}>Αλλαγή κωδικού</button>
    </form>
    <form onSubmit={changeEmail} noValidate>
     <label className="auth-field"><span>Νέο email</span><input type="email" autoComplete="email" placeholder={session.user.email||'onoma@email.gr'} value={newEmail} onChange={e=>setNewEmail(e.target.value)}/></label>
     <button type="submit" className="btn btn-secondary auth-cta" disabled={busy||!newEmail}>Αλλαγή email</button>
    </form>
    {secMsg&&<div className="auth-ok" role="status">{secMsg}</div>}{secErr&&<div className="auth-error" role="alert">{secErr}</div>}
   </details>

   <button type="button" className="btn btn-secondary auth-cta" onClick={signOut} disabled={busy}><SignOut/>Αποσύνδεση</button>
   <div className="danger">
    {confirmDelete?<><p>Θα διαγραφούν ο λογαριασμός, η φωτογραφία και οι συγχρονισμένες λίστες σου. Δεν αναιρείται.</p>
     <div className="row"><button type="button" className="btn btn-secondary" onClick={()=>setConfirmDelete(false)} disabled={busy}>Άκυρο</button>
      <button type="button" className="btn btn-danger" onClick={del} disabled={busy}>Ναι, διαγραφή</button></div></>
     :<button type="button" className="auth-link danger-link" onClick={()=>setConfirmDelete(true)}><Trash/> Διαγραφή λογαριασμού</button>}
   </div>
  </div>
 </SheetShell>;
}
