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
