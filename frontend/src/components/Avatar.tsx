import {useEffect,useState} from 'react';
import type {Session} from '@supabase/supabase-js';
import {avatarOf,initialOf} from '../lib/auth';

/** Round profile photo with the user's initial as fallback. */
export default function Avatar({session,size=40,className=''}:{session:Session|null|undefined;size?:number;className?:string}){
 const url=avatarOf(session);const [bad,setBad]=useState(false);
 useEffect(()=>setBad(false),[url]);
 return <div className={'avatar '+className} style={{width:size,height:size,fontSize:Math.round(size*.4)}} aria-hidden="true">
  {url&&!bad?<img src={url} alt="" referrerPolicy="no-referrer" onError={()=>setBad(true)}/>:initialOf(session)}</div>;
}
