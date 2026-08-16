-- Phase 7 foundation: profiles + trips, RLS deny-by-default, server-enforced
-- CAS revision counter. See PLATFORM_PLAN.md §3, §5 (Phase 7) and the plan
-- at the time this was written for the full design rationale.

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No insert/delete policy: insert is owned by the trigger below (security
-- definer, bypasses RLS) — the client never inserts a profile row itself.
-- Delete is unscoped (no account-deletion UX yet) — true deny-by-default,
-- not a policy for semantics nobody's designed yet.

-- Auto-provision a profile row at signup so trips.owner_id's FK never 23503s
-- on a brand-new account's first trip save.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── trips ───────────────────────────────────────────────────────────────────
create table public.trips (
  id             uuid primary key,        -- client-generated UUIDv7; NEVER gen_random_uuid()
  owner_id       uuid not null references public.profiles(user_id) on delete cascade,
  doc            jsonb not null,
  schema_version int not null,
  revision       bigint not null default 1,
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  constraint trips_doc_size_check
    check (octet_length(doc::text) <= 1048576),  -- ~1MB, matches PLATFORM_PLAN §5
  -- `is not null and` matters: Postgres CHECK passes when the expression
  -- evaluates to NULL (not just TRUE), so a doc missing the key entirely
  -- (doc->>'id' is NULL) would otherwise satisfy "= id::text" vacuously and
  -- slip the whole point of these two constraints.
  constraint trips_doc_id_check
    check ((doc->>'id') is not null and (doc->>'id') = id::text),
  -- The digits-only regex guards the ::int cast: a non-numeric value would
  -- otherwise raise a raw 22P02 error (AND short-circuits, so the cast never
  -- runs unless the regex already matched) instead of cleanly failing this
  -- constraint like a malformed doc should.
  constraint trips_doc_schema_version_check
    check (
      (doc->>'schemaVersion') is not null
      and (doc->>'schemaVersion') ~ '^[0-9]+$'
      and (doc->>'schemaVersion')::int = schema_version
    )
);

create index trips_owner_id_idx on public.trips (owner_id) where deleted_at is null;

alter table public.trips enable row level security;

create policy trips_select_own on public.trips
  for select using (owner_id = auth.uid());
create policy trips_insert_own on public.trips
  for insert with check (owner_id = auth.uid());
create policy trips_update_own on public.trips
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- No delete policy this pass — see the plan's "known gaps" section. "Start
-- over" only clears the local copy; a signed-in user's remote row is
-- orphaned (still fully RLS-protected, just unreachable from the UI) until
-- a trip-list/account-management screen exists.

-- Server-enforced CAS counter — the ONLY writer of the increment, so a
-- client can't fake or skip it. The client's UPDATE ... WHERE revision = ?
-- is the concurrency guard; this trigger clobbers whatever the client sent
-- for `revision` (if anything) with old.revision + 1.
create function public.trips_bump_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trips_bump_revision_trigger
  before update on public.trips
  for each row execute function public.trips_bump_revision();
