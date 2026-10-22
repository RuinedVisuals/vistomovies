import {useCallback,useEffect,useState} from 'react';
import {supabase} from './supabase';

export type PlanStatus='invited'|'going'|'maybe'|'declined';
export type PlanPerson={user_id:string;name:string;username:string|null;avatar_url:string|null;status:PlanStatus};
export type Plan={id:string;owner:string;owner_name:string;owner_avatar:string|null;film_title:string;film_route:string;cinema_id:string;cinema_name:string;
 show_date:string;show_time:string;note:string|null;created_at:string;my_status:'owner'|PlanStatus|null;people:PlanPerson[]};

export type PlansState={items:Plan[]|null;error:string;refresh:()=>Promise<void>;
 /** Invitations I haven't answered yet (drives the bell badge). */
 pending:Plan[]};

/** My plans; refreshes on focus and every 45 s while signed in. */
export function usePlans(userId:string|undefined,todayIso:string):PlansState{
 const [items,setItems]=useState<Plan[]|null>(null),[error,setError]=useState('');
 const refresh=useCallback(async()=>{
  if(!supabase||!userId){setItems(null);return}
  const {data,error:e}=await supabase.rpc('my_plans');
  if(e){setError(/function|schema cache|does not exist/i.test(e.message)?'Λείπει το SQL για τα σχέδια στο Supabase.':'Δεν φορτώθηκαν τα σχέδια.');setItems(prev=>prev||[]);return}
  setError('');setItems(data as Plan[]);
 },[userId]);
 useEffect(()=>{refresh();if(!userId)return;
  const t=setInterval(refresh,45000),vis=()=>{if(document.visibilityState==='visible')refresh()};
  document.addEventListener('visibilitychange',vis);return()=>{clearInterval(t);document.removeEventListener('visibilitychange',vis)}},[refresh,userId]);
 const pending=(items||[]).filter(p=>p.my_status==='invited'&&p.show_date>=todayIso);
 return {items,error,refresh,pending};
}

export type NewPlan={film_title:string;film_route:string;cinema_id:string;cinema_name:string;show_date:string;show_time:string;note?:string};
/** Creates the plan and invites the chosen friends. Returns an error message or ''. */
export async function createPlan(me:string,plan:NewPlan,friendIds:string[]){
 const {data,error}=await supabase!.from('plans').insert({...plan,note:plan.note?.trim()||null,owner:me}).select('id').single();
 if(error||!data)return 'Η πρόσκληση δεν δημιουργήθηκε. Δοκίμασε ξανά.';
 const {error:ie}=await supabase!.from('plan_invites').insert(friendIds.map(user_id=>({plan_id:data.id,user_id})));
 if(ie){await supabase!.from('plans').delete().eq('id',data.id);return 'Οι προσκλήσεις δεν στάλθηκαν. Δοκίμασε ξανά.'}
 return '';
}
export async function answerPlan(planId:string,me:string,status:Exclude<PlanStatus,'invited'>){
 const {error}=await supabase!.from('plan_invites').update({status,responded_at:new Date().toISOString()}).eq('plan_id',planId).eq('user_id',me);
 return error?'Η απάντηση δεν στάλθηκε. Δοκίμασε ξανά.':'';
}
export async function cancelPlan(planId:string){
 const {error}=await supabase!.from('plans').delete().eq('id',planId);return error?'Η ακύρωση δεν ολοκληρώθηκε.':'';
}
