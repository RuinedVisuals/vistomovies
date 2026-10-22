import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';

export type Person={id:string;username:string|null;display_name:string|null;avatar_url:string|null};
export type Friendship={friendship_id:string;status:'pending'|'accepted';incoming:boolean;user_id:string;username:string|null;display_name:string|null;avatar_url:string|null;created_at:string};

/** My friends and requests (null while loading / signed out). */
export function useFriends(userId:string|undefined){
 const [items,setItems]=useState<Friendship[]|null>(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!supabase||!userId){setItems(null);return}
  const {data,error:e}=await supabase.rpc('list_friends');
  if(e){setError(/function|schema cache|does not exist/i.test(e.message)?'Λείπει το SQL για τους φίλους στο Supabase.':'Δεν φορτώθηκαν οι φίλοι.');setItems([]);return}
  setError('');setItems(data as Friendship[]);
 },[userId]);
 useEffect(()=>{refresh()},[refresh]);
 return {items,error,refresh,
  friends:(items||[]).filter(f=>f.status==='accepted'),
  incoming:(items||[]).filter(f=>f.status==='pending'&&f.incoming),
  outgoing:(items||[]).filter(f=>f.status==='pending'&&!f.incoming)};
}

export const searchUsers=async(q:string):Promise<Person[]>=>{
 const {data}=await supabase!.rpc('search_users',{q:q.replace(/^@/,'').trim()});return (data as Person[])||[];
};
export const profileByUsername=async(u:string):Promise<Person|null>=>{
 const {data}=await supabase!.rpc('profile_by_username',{u});return (data as Person[])?.[0]||null;
};
/** Sends a request; if they already asked us, accepts instead. Returns an error message or ''. */
export async function addFriend(me:string,other:string,existing:Friendship[]|null){
 const theirs=existing?.find(f=>f.user_id===other&&f.status==='pending'&&f.incoming);
 if(theirs)return acceptRequest(theirs.friendship_id);
 const {error}=await supabase!.from('friendships').insert({requester:me,addressee:other});
 if(error&&error.code!=='23505')return 'Το αίτημα δεν στάλθηκε. Δοκίμασε ξανά.';
 return '';
}
export async function acceptRequest(id:string){
 const {error}=await supabase!.from('friendships').update({status:'accepted'}).eq('id',id);return error?'Δεν ολοκληρώθηκε. Δοκίμασε ξανά.':'';
}
export async function removeFriendship(id:string){
 const {error}=await supabase!.from('friendships').delete().eq('id',id);return error?'Δεν ολοκληρώθηκε. Δοκίμασε ξανά.':'';
}
export const inviteUrl=(username:string)=>`${location.origin}/add/${username}`;
