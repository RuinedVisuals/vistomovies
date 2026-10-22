-- Visto: friends. Run in Supabase → SQL Editor after the earlier migrations.
-- A friendship is a request (pending) that the addressee accepts. Rows are visible only to the two people involved.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
-- One row per pair, whichever side asked first.
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee);

alter table public.friendships enable row level security;
create policy "friendships: see own" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "friendships: request" on public.friendships for insert to authenticated
  with check (auth.uid() = requester and status = 'pending');
create policy "friendships: accept" on public.friendships for update to authenticated
  using (auth.uid() = addressee) with check (auth.uid() = addressee and status = 'accepted');
create policy "friendships: remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- Search by @username prefix. Returns only public-facing fields, never email.
create or replace function public.search_users(q text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username,
         coalesce(p.display_name, u.raw_user_meta_data ->> 'full_name', p.username),
         u.raw_user_meta_data ->> 'avatar_url'
  from public.profiles p join auth.users u on u.id = p.id
  where auth.uid() is not null and p.id <> auth.uid() and p.username is not null
    and length(q) >= 3 and starts_with(p.username, lower(q))
  order by p.username limit 10;
$$;

-- Exact lookup for invite links (/add/<username>).
create or replace function public.profile_by_username(u text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username,
         coalesce(p.display_name, x.raw_user_meta_data ->> 'full_name', p.username),
         x.raw_user_meta_data ->> 'avatar_url'
  from public.profiles p join auth.users x on x.id = p.id
  where auth.uid() is not null and p.username = lower(u) limit 1;
$$;

-- My friends and requests, with the other person's public fields.
create or replace function public.list_friends()
returns table (friendship_id uuid, status text, incoming boolean, user_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.status, f.addressee = auth.uid(), o.id, p.username,
         coalesce(p.display_name, o.raw_user_meta_data ->> 'full_name', p.username),
         o.raw_user_meta_data ->> 'avatar_url', f.created_at
  from public.friendships f
  join auth.users o on o.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join public.profiles p on p.id = o.id
  where auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

revoke all on function public.search_users(text), public.profile_by_username(text), public.list_friends() from public, anon;
grant execute on function public.search_users(text), public.profile_by_username(text), public.list_friends() to authenticated;
