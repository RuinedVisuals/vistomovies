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
