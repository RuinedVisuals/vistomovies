-- Visto: plans ("Πάμε μαζί") — invite friends to a screening; each invitee answers going / maybe / declined.
-- Run in Supabase → SQL Editor after the friends migration.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  film_title text not null check (char_length(film_title) <= 200),
  film_route text not null check (char_length(film_route) <= 200),
  cinema_id text not null,
  cinema_name text not null check (char_length(cinema_name) <= 200),
  show_date date not null,
  show_time text not null check (show_time ~ '^[0-9]{2}:[0-9]{2}$'),
  note text check (note is null or char_length(note) <= 140),
  created_at timestamptz not null default now()
);
create table if not exists public.plan_invites (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'going', 'maybe', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (plan_id, user_id)
);
create index if not exists plan_invites_user on public.plan_invites (user_id);

-- Helpers are security definer so the two tables' policies can refer to each other without recursion.
create or replace function public.plan_owner_is_me(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plans where id = p and owner = auth.uid());
$$;
create or replace function public.plan_invited_me(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.plan_invites where plan_id = p and user_id = auth.uid());
$$;
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                 where status = 'accepted' and least(requester, addressee) = least(a, b) and greatest(requester, addressee) = greatest(a, b));
$$;

alter table public.plans enable row level security;
create policy "plans: see mine or invited" on public.plans for select to authenticated
  using (owner = auth.uid() or public.plan_invited_me(id));
create policy "plans: create" on public.plans for insert to authenticated with check (owner = auth.uid());
create policy "plans: delete own" on public.plans for delete to authenticated using (owner = auth.uid());

alter table public.plan_invites enable row level security;
create policy "invites: see in my plans" on public.plan_invites for select to authenticated
  using (user_id = auth.uid() or public.plan_owner_is_me(plan_id) or public.plan_invited_me(plan_id));
create policy "invites: owner invites friends" on public.plan_invites for insert to authenticated
  with check (public.plan_owner_is_me(plan_id) and public.are_friends(auth.uid(), user_id) and status = 'invited');
create policy "invites: answer mine" on public.plan_invites for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "invites: owner removes" on public.plan_invites for delete to authenticated
  using (public.plan_owner_is_me(plan_id));

-- Plans I own or am invited to, with the people involved (public fields only).
create or replace function public.my_plans()
returns table (id uuid, owner uuid, owner_name text, owner_avatar text, film_title text, film_route text, cinema_id text, cinema_name text,
               show_date date, show_time text, note text, created_at timestamptz, my_status text, people jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.owner,
         coalesce(op.display_name, ou.raw_user_meta_data ->> 'full_name', op.username, 'Χρήστης'),
         ou.raw_user_meta_data ->> 'avatar_url',
         p.film_title, p.film_route, p.cinema_id, p.cinema_name, p.show_date, p.show_time, p.note, p.created_at,
         case when p.owner = auth.uid() then 'owner'
              else (select i.status from public.plan_invites i where i.plan_id = p.id and i.user_id = auth.uid()) end,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'user_id', i.user_id,
                     'name', coalesce(pp.display_name, uu.raw_user_meta_data ->> 'full_name', pp.username, 'Χρήστης'),
                     'username', pp.username,
                     'avatar_url', uu.raw_user_meta_data ->> 'avatar_url',
                     'status', i.status))
                   from public.plan_invites i
                   join auth.users uu on uu.id = i.user_id
                   left join public.profiles pp on pp.id = i.user_id
                   where i.plan_id = p.id), '[]'::jsonb)
  from public.plans p
  join auth.users ou on ou.id = p.owner
  left join public.profiles op on op.id = p.owner
  where p.owner = auth.uid() or public.plan_invited_me(p.id)
  order by p.show_date, p.show_time;
$$;

revoke all on function public.plan_owner_is_me(uuid), public.plan_invited_me(uuid), public.are_friends(uuid, uuid), public.my_plans() from public, anon;
grant execute on function public.plan_owner_is_me(uuid), public.plan_invited_me(uuid), public.are_friends(uuid, uuid), public.my_plans() to authenticated;
