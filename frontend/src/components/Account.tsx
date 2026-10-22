import {useState} from 'react';
import {SignOut,UserCircle,EnvelopeSimple,GoogleLogo,AppleLogo} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {useApp} from '../lib/context';

// Providers enabled in the Supabase dashboard, e.g. VITE_AUTH_PROVIDERS=google,apple (email always works).
const PROVIDERS=((import.meta.env.VITE_AUTH_PROVIDERS as string|undefined)||'').split(',').map(s=>s.trim()).filter((s):s is 'google'|'apple'=>s==='google'||s==='apple');
const LABEL={google:{name:'Google',Icon:GoogleLogo},apple:{name:'Apple',Icon:AppleLogo}};

/** Sign-in card (OAuth buttons + email magic link). Hidden when Supabase isn't configured. */
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
  {PROVIDERS.length>0&&<div className="oauth">{PROVIDERS.map(p=>{const {name,Icon}=LABEL[p];
   return <button key={p} type="button" className="btn btn-secondary" onClick={()=>supabase!.auth.signInWithOAuth({provider:p,options:{redirectTo:location.origin+'/saved'}})}><Icon weight="fill"/>Συνέχεια με {name}</button>})}
   <div className="s" style={{textAlign:'center'}}>ή με email</div></div>}
  {state==='sent'?<div className="s ok">Σου στείλαμε σύνδεσμο στο {email}. Άνοιξέ τον από αυτή τη συσκευή.</div>
   :<div className="row"><input type="email" required autoComplete="email" placeholder="το email σου" value={email} onChange={e=>setEmail(e.target.value)} aria-label="Email"/>
    <button type="submit" className="btn btn-primary" disabled={state==='sending'}>{state==='sending'?'…':'Σύνδεση'}</button></div>}
  {state==='error'&&<div className="s err" role="alert">{msg}</div>}
 </form>;
}
