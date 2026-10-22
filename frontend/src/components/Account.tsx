import {UserCircle} from '@phosphor-icons/react';
import {supabase} from '../lib/supabase';
import {displayName} from '../lib/auth';
import Avatar from './Avatar';
import {useApp} from '../lib/context';

/** Account card on the saved list: opens the sign-in sheet, or the profile when signed in. Hidden when Supabase isn't configured. */
export default function Account(){
 const {session,openAccount}=useApp();
 if(!supabase||session===undefined)return null;
 if(session)return <button type="button" data-a className="account-card" onClick={openAccount}><Avatar session={session}/>
  <div className="body"><div className="t">{displayName(session)}</div><div className="s">Οι λίστες σου συγχρονίζονται · Λογαριασμός</div></div></button>;
 return <button type="button" data-a className="account-card" onClick={openAccount}><UserCircle size={26}/>
  <div className="body"><div className="t">Σύνδεση ή εγγραφή</div><div className="s">Κράτα τις λίστες σου σε κάθε συσκευή και κάλεσε φίλους στο σινεμά.</div></div></button>;
}
