-- Visto: accounts + synced favourites. Run once in Supabase → SQL Editor (or `supabase db push`).
-- Row-level security: every row is readable/writable only by its owner.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- A profile row is created automatically on sign-up (no personal data copied from the email).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists public.saved_films (
  user_id uuid not null references auth.users(id) on delete cascade,
  film_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, film_key)
);
alter table public.saved_films enable row level security;
create policy "saved_films: own" on public.saved_films for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.fav_cinemas (
  user_id uuid not null references auth.users(id) on delete cascade,
  cinema_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, cinema_id)
);
alter table public.fav_cinemas enable row level security;
create policy "fav_cinemas: own" on public.fav_cinemas for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- Visto: profile rules + in-app account deletion (required by the App Store).
-- Run in Supabase → SQL Editor after 20261023000000_init.sql.

alter table public.profiles
  add constraint profiles_username_format check (username is null or username ~ '^[a-z0-9_]{3,20}$');

-- Lets a signed-in user delete their own account; saved_films / fav_cinemas / profiles cascade.
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;


-- Visto: profile photos. Run in Supabase → SQL Editor after the two earlier migrations.
-- Public bucket (photos are shown to friends); each user may write only inside their own folder <user id>/.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- Fix: replacing a photo uses "upsert", which also needs a SELECT policy on storage.objects.
-- Each user can see only their own files; the photos themselves stay publicly viewable through the bucket's public URL.
create policy "avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


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
