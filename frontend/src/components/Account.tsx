import {useState} from 'react';
import {SignOut,UserCircle,EnvelopeSimple} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {useApp} from '../lib/context';

/** Sign-in card (email magic link). Hidden when Supabase isn't configured. */
export default function Account(){
 const {session}=useApp();
 const [email,setEmail]=useState(''),[state,setState]=useState<'idle'|'sending'|'sent'|'error'>('idle'),[msg,setMsg]=useState('');
 if(!supabase||session===undefined)return null;
 if(session)return <div data-a className="account-card"><UserCircle size={22}/>
  <div className="body"><div className="t">Συνδεδεμένος</div><div className="s">{session.user.email} · οι λίστες σου συγχρονίζονται</div></div>
  <button type="button" className="text-btn" onClick={()=>supabase!.auth.signOut()}><SignOut/> Έξοδος</button></div>;
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();if(!email.trim())return;setState('sending');
  const {error}=await supabase!.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin+'/saved'}});
  if(error){setState('error');setMsg(error.message)}else setState('sent');
 };
 return <form data-a className="account-card col" onSubmit={send}>
  <div className="row"><EnvelopeSimple size={22}/><div className="body"><div className="t">Σύνδεση</div><div className="s">Κράτα τις λίστες σου σε όλες τις συσκευές και κάλεσε φίλους στο σινεμά.</div></div></div>
  {state==='sent'?<div className="s ok">Σου στείλαμε σύνδεσμο στο {email}. Άνοιξέ τον από αυτή τη συσκευή.</div>
   :<div className="row"><input type="email" required autoComplete="email" placeholder="το email σου" value={email} onChange={e=>setEmail(e.target.value)} aria-label="Email"/>
    <button type="submit" className="btn btn-primary" disabled={state==='sending'}>{state==='sending'?'…':'Σύνδεση'}</button></div>}
  {state==='error'&&<div className="s err" role="alert">{msg}</div>}
 </form>;
}
