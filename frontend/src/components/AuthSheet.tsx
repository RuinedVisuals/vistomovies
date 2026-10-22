import {useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {AppleLogo,ArrowLeft,Eye,EyeSlash,EnvelopeSimple,Key} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {useApp} from '../lib/context';
import {authError,useProviders,validEmail} from '../lib/auth';
import {gsap,reducedMotion} from '../lib/motion';
import SheetShell from './SheetShell';

type Step='welcome'|'email'|'code'|'password'|'forgot'|'reset'|'notice'|'done';
const REDIRECT=()=>location.origin+'/saved';
// Supabase's built-in email only carries a link. Set VITE_AUTH_EMAIL_CODE=true once a custom SMTP template includes {{ .Token }}.
const EMAIL_CODE=import.meta.env.VITE_AUTH_EMAIL_CODE==='true';

const GoogleG=()=><svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.859-3.0477.859-2.3441 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"/><path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4545 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z"/></svg>;

/** One step of the flow: slides in from the side it was reached from. */
function StepView({dir,children}:{dir:number;children:ReactNode}){
 const r=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(reducedMotion()||!r.current)return;
  const t=gsap.fromTo(r.current,{x:26*dir,opacity:0},{x:0,opacity:1,duration:.38,ease:'power3.out',clearProps:'transform,opacity'});return()=>{t.kill()}},[]);// eslint-disable-line react-hooks/exhaustive-deps
 return <div ref={r} className="auth-step">{children}</div>;
}
const shake=(el:Element|null)=>{if(el&&!reducedMotion())gsap.fromTo(el,{x:0},{keyframes:[{x:-9},{x:8},{x:-6},{x:4},{x:0}],duration:.4,ease:'power1.inOut'})};

/** Sign-in / sign-up: Google, Apple, email code (default), password (with reset), then a success tick. */
export default function AuthSheet({initial='welcome',onClose,onDone}:{initial?:'welcome'|'reset';onClose:()=>void;onDone:(msg:string)=>void}){
 const providers=useProviders();const {session}=useApp();
 const [step,setStep]=useState<Step>(initial),dir=useRef(1);
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[password,setPassword]=useState(''),[signup,setSignup]=useState(false),[show,setShow]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[cooldown,setCooldown]=useState(0),[notice,setNotice]=useState({title:'',text:''});
 const closeRef=useRef<(()=>void)|null>(null),card=useRef<HTMLDivElement>(null),tick=useRef<SVGSVGElement>(null);
 const go=(s:Step,d=1)=>{dir.current=d;setError('');setStep(s)};
 useEffect(()=>{if(cooldown<=0)return;const t=setTimeout(()=>setCooldown(c=>c-1),1000);return()=>clearTimeout(t)},[cooldown]);
 const fail=(msg?:string)=>{setError(authError(msg));shake(card.current)};

 const oauth=async(provider:'google'|'apple')=>{setBusy(true);setError('');
  const {error:e}=await supabase!.auth.signInWithOAuth({provider,options:{redirectTo:REDIRECT()}});
  if(e){setBusy(false);fail(e.message)}};
 const sendCode=async(e?:FormEvent)=>{e?.preventDefault();if(!validEmail(email)){fail('invalid email');setError('Γράψε ένα έγκυρο email.');return}
  setBusy(true);setError('');
  const {error:er}=await supabase!.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:REDIRECT()}});
  setBusy(false);if(er)return fail(er.message);setCode('');setCooldown(30);go('code');};
 const verify=async(token:string)=>{setBusy(true);setError('');
  const {error:er}=await supabase!.auth.verifyOtp({email:email.trim(),token,type:'email'});
  setBusy(false);if(er){setCode('');return fail(er.message)}finish('Συνδέθηκες')};
 const pass=async(e:FormEvent)=>{e.preventDefault();if(!validEmail(email)){setError('Γράψε ένα έγκυρο email.');shake(card.current);return}
  if(password.length<8){setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');shake(card.current);return}
  setBusy(true);setError('');
  if(signup){const {data,error:er}=await supabase!.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:REDIRECT()}});
   setBusy(false);if(er)return fail(er.message);
   if(data.session)return finish('Ο λογαριασμός δημιουργήθηκε');
   setNotice({title:'Έλεγξε το email σου',text:`Στείλαμε σύνδεσμο επιβεβαίωσης στο ${email.trim()}. Άνοιξέ τον και μετά συνδέσου.`});return go('notice')}
  const {error:er}=await supabase!.auth.signInWithPassword({email:email.trim(),password});
  setBusy(false);if(er)return fail(er.message);finish('Συνδέθηκες')};
 const forgot=async(e:FormEvent)=>{e.preventDefault();if(!validEmail(email)){setError('Γράψε ένα έγκυρο email.');shake(card.current);return}
  setBusy(true);setError('');
  const {error:er}=await supabase!.auth.resetPasswordForEmail(email.trim(),{redirectTo:REDIRECT()});
  setBusy(false);if(er)return fail(er.message);
  setNotice({title:'Στείλαμε οδηγίες',text:`Αν υπάρχει λογαριασμός για ${email.trim()}, θα λάβεις σύνδεσμο για νέο κωδικό.`});go('notice')};
 const reset=async(e:FormEvent)=>{e.preventDefault();if(password.length<8){setError('Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.');shake(card.current);return}
  setBusy(true);setError('');const {error:er}=await supabase!.auth.updateUser({password});setBusy(false);
  if(er)return fail(er.message);finish('Ο κωδικός άλλαξε')};
 function finish(msg:string){go('done');setTimeout(()=>{onDone(msg);closeRef.current?.()},1500)}
 // The emailed link was opened in another tab of this browser: the session appears here too.
 useEffect(()=>{if(session&&(step==='code'||step==='email'||step==='welcome'))finish('Συνδέθηκες')},[session]);// eslint-disable-line react-hooks/exhaustive-deps

 // Success tick: the circle and check are drawn.
 useEffect(()=>{if(step!=='done'||!tick.current)return;
  const paths=tick.current.querySelectorAll<SVGGeometryElement>('[data-draw]');
  paths.forEach(p=>{const l=p.getTotalLength();p.style.strokeDasharray=String(l);p.style.strokeDashoffset=reducedMotion()?'0':String(l)});
  if(reducedMotion())return;
  const t=gsap.timeline();t.to(paths[0],{strokeDashoffset:0,duration:.5,ease:'power2.out'}).to(paths[1],{strokeDashoffset:0,duration:.35,ease:'power2.out'},'-=.1').fromTo(tick.current,{scale:.9},{scale:1,duration:.5,ease:'back.out(2.5)'},0);
  return()=>{t.kill()}},[step]);

 const back=(s:Step)=><button type="button" className="auth-back" onClick={()=>go(s,-1)} aria-label="Πίσω"><ArrowLeft/></button>;
 const err=error&&<div className="auth-error" role="alert">{error}</div>;
 const emailField=<label className="auth-field"><span>Email</span><input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="onoma@email.gr" value={email} onChange={e=>setEmail(e.target.value)} autoFocus={!email}/></label>;
 const passField=(label:string,auto:string)=><label className="auth-field"><span>{label}</span><div className="pw"><input type={show?'text':'password'} autoComplete={auto} placeholder="τουλάχιστον 8 χαρακτήρες" value={password} onChange={e=>setPassword(e.target.value)} autoFocus={step==='reset'}/>
  <button type="button" onClick={()=>setShow(v=>!v)} aria-label={show?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'}>{show?<EyeSlash/>:<Eye/>}</button></div></label>;
 const submit=(label:string)=><button type="submit" className="btn btn-primary auth-cta" disabled={busy}>{busy?<span className="spin" aria-label="Φόρτωση"/>:label}</button>;

 return <SheetShell label="Σύνδεση" onClose={onClose} closeRef={closeRef} locked={step==='done'}>
  <div className="auth-body" ref={card}>
   {step==='welcome'&&<StepView dir={dir.current}>
    <div className="auth-logo">visto<span>.</span></div>
    <h2 className="auth-title">Συνδέσου για να κρατάς τα πάντα μαζί</h2>
    <p className="auth-sub">Οι αγαπημένες ταινίες και τα σινεμά σου σε κάθε συσκευή, και προσκλήσεις σε φίλους.</p>
    <div className="auth-stack">
     <button type="button" className="oauth-btn google" disabled={busy||!providers?.google} onClick={()=>oauth('google')}><GoogleG/>Συνέχεια με Google{providers&&!providers.google&&<em>σύντομα</em>}</button>
     <button type="button" className="oauth-btn apple" disabled={busy||!providers?.apple} onClick={()=>oauth('apple')}><AppleLogo weight="fill" size={19}/>Συνέχεια με Apple{providers&&!providers.apple&&<em>σύντομα</em>}</button>
    </div>
    <div className="auth-or"><span>ή</span></div>
    <button type="button" className="oauth-btn mail" onClick={()=>go('email')}><EnvelopeSimple size={19}/>Συνέχεια με email</button>
    {err}
   </StepView>}

   {step==='email'&&<StepView dir={dir.current}>
    {back('welcome')}<h2 className="auth-title">Ποιο είναι το email σου;</h2>
    <p className="auth-sub">{EMAIL_CODE?'Θα σου στείλουμε έναν κωδικό 6 ψηφίων.':'Θα σου στείλουμε σύνδεσμο σύνδεσης.'} Χωρίς κωδικό πρόσβασης.</p>
    <form onSubmit={sendCode} noValidate>{emailField}{err}{submit(EMAIL_CODE?'Στείλε κωδικό':'Στείλε σύνδεσμο')}</form>
    <button type="button" className="auth-link" onClick={()=>go('password')}><Key/> Προτιμώ κωδικό πρόσβασης</button>
   </StepView>}

   {step==='code'&&<StepView dir={dir.current}>
    {back('email')}<h2 className="auth-title">Έλεγξε το email σου</h2>
    {EMAIL_CODE?<><p className="auth-sub">Στείλαμε κωδικό στο <b>{email.trim()}</b>. Γράψε τον εδώ.</p>
     <OtpInput value={code} onChange={v=>{setCode(v);if(v.length===6)verify(v)}} disabled={busy}/></>
    :<><p className="auth-sub">Στείλαμε σύνδεσμο στο <b>{email.trim()}</b>. Άνοιξέ τον σε αυτή τη συσκευή και θα συνδεθείς αυτόματα.</p>
     <div className="auth-icon" aria-hidden="true"><EnvelopeSimple size={30}/></div></>}
    {err}
    <div className="auth-resend">{busy?<span className="spin" aria-label="Έλεγχος"/>:cooldown>0?`Νέος κωδικός σε ${cooldown}″`:<button type="button" className="auth-link" onClick={()=>sendCode()}>Στείλε ξανά</button>}</div>
    <p className="auth-hint">Δεν έφτασε; Δες και στα ανεπιθύμητα.</p>
   </StepView>}

   {step==='password'&&<StepView dir={dir.current}>
    {back('email')}<h2 className="auth-title">{signup?'Δημιουργία λογαριασμού':'Σύνδεση με κωδικό'}</h2>
    <div className="seg" role="group" aria-label="Τρόπος" style={{margin:'12px 0 4px'}}>
     <button type="button" aria-pressed={!signup} onClick={()=>{setSignup(false);setError('')}}>Έχω λογαριασμό</button>
     <button type="button" aria-pressed={signup} onClick={()=>{setSignup(true);setError('')}}>Νέος λογαριασμός</button></div>
    <form onSubmit={pass} noValidate>{emailField}{passField('Κωδικός',signup?'new-password':'current-password')}{err}{submit(signup?'Δημιουργία':'Σύνδεση')}</form>
    {!signup&&<button type="button" className="auth-link" onClick={()=>go('forgot')}>Ξέχασα τον κωδικό μου</button>}
   </StepView>}

   {step==='forgot'&&<StepView dir={dir.current}>
    {back('password')}<h2 className="auth-title">Νέος κωδικός</h2>
    <p className="auth-sub">Γράψε το email του λογαριασμού σου και θα σου στείλουμε σύνδεσμο επαναφοράς.</p>
    <form onSubmit={forgot} noValidate>{emailField}{err}{submit('Στείλε σύνδεσμο')}</form>
   </StepView>}

   {step==='reset'&&<StepView dir={dir.current}>
    <h2 className="auth-title">Όρισε νέο κωδικό</h2>
    <p className="auth-sub">Επαληθεύτηκες. Διάλεξε τον νέο σου κωδικό πρόσβασης.</p>
    <form onSubmit={reset} noValidate>{passField('Νέος κωδικός','new-password')}{err}{submit('Αποθήκευση')}</form>
   </StepView>}

   {step==='notice'&&<StepView dir={dir.current}>
    <div className="auth-icon"><EnvelopeSimple size={30}/></div>
    <h2 className="auth-title" style={{textAlign:'center'}}>{notice.title}</h2><p className="auth-sub" style={{textAlign:'center'}}>{notice.text}</p>
    <button type="button" className="btn btn-secondary auth-cta" onClick={()=>closeRef.current?.()}>Εντάξει</button>
   </StepView>}

   {step==='done'&&<StepView dir={1}>
    <svg ref={tick} className="auth-tick" viewBox="0 0 52 52" aria-hidden="true"><circle data-draw cx="26" cy="26" r="23" fill="none" stroke="var(--color-accent)" strokeWidth="3"/><path data-draw d="M15 27l8 8 14-16" fill="none" stroke="var(--color-accent-200)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <h2 className="auth-title" style={{textAlign:'center'}}>Έτοιμο!</h2><p className="auth-sub" style={{textAlign:'center'}}>Οι λίστες σου συγχρονίζονται.</p>
   </StepView>}
  </div>
 </SheetShell>;
}

/** Six single-digit boxes: auto-advance, backspace goes back, pasting a full code fills all. */
function OtpInput({value,onChange,disabled}:{value:string;onChange:(v:string)=>void;disabled:boolean}){
 const refs=useRef<(HTMLInputElement|null)[]>([]);
 useEffect(()=>{refs.current[Math.min(value.length,5)]?.focus()},[value.length]);
 const set=(i:number,ch:string)=>{const d=ch.replace(/\D/g,'');if(!d)return;
  if(d.length>1){onChange(d.slice(0,6));return}
  onChange((value.slice(0,i)+d+value.slice(i+1)).slice(0,6))};
 return <div className="otp" role="group" aria-label="Κωδικός επαλήθευσης">{Array.from({length:6},(_,i)=>
  <input key={i} ref={el=>{refs.current[i]=el}} className={'otp-box'+(value[i]?' filled':'')} inputMode="numeric" autoComplete={i===0?'one-time-code':'off'} maxLength={6} disabled={disabled}
   value={value[i]||''} aria-label={`Ψηφίο ${i+1}`}
   onChange={e=>set(i,e.target.value)} onPaste={e=>{e.preventDefault();onChange(e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6))}}
   onKeyDown={e=>{if(e.key==='Backspace'){e.preventDefault();onChange(value.slice(0,value[i]?i:Math.max(0,i-1)))}}} onFocus={e=>e.target.select()}/>)}</div>;
}
