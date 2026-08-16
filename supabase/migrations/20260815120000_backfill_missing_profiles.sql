-- Backfill profiles for any auth.users row created before the
-- on_auth_user_created trigger existed (20260815000000_profiles_and_trips.sql)
-- — that trigger only fires on new signups going forward, so an account that
-- signed in even once before this migration landed has no profiles row, and
-- its first trips insert 23503s on trips_owner_id_fkey. One-time, idempotent
-- backfill — a no-op against a project where every existing user already has
-- a profiles row.
insert into public.profiles (user_id)
select id from auth.users
where id not in (select user_id from public.profiles)
on conflict (user_id) do nothing;
