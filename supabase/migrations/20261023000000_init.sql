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
