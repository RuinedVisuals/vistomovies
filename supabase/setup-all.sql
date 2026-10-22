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
