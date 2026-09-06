-- A persisted per-user daily cap on photo identification, replacing the
-- in-process counter the route used to rely on. That counter lived in a
-- module-level Map, which on serverless means per-instance: a caller who
-- landed on a cold instance got a fresh allowance, so it stopped runaway
-- retries but was never a real spend cap. This is the counter the README has
-- been asking for.
--
-- Every identification is a paid, search-grounded model call, so the cap is
-- what keeps the feature affordable to leave switched on.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: everything here is create-if-not-exists or create-or-replace.

create table if not exists public.identify_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- Per-user overrides of the app's default cap. A user with no row here gets
-- whatever the route passes in (IDENTIFY_DAILY_LIMIT, default 2), so this table
-- stays empty until someone actually needs a different number.
--
-- daily_limit 0 switches identification off for that account entirely.
create table if not exists public.identify_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_limit integer not null check (daily_limit >= 0),
  note text,
  updated_at timestamptz not null default now()
);

-- RLS on with no policies at all, which denies every anon and authenticated
-- request by default. Only the service role -- which bypasses RLS, and which
-- only the server route holds -- reads or writes these. A user being able to
-- see or edit their own allowance is precisely what this is guarding against.
alter table public.identify_usage enable row level security;
alter table public.identify_limits enable row level security;

-- Claims one call and reports what the caller has used, in a single atomic
-- statement.
--
-- The check lives in the ON CONFLICT ... WHERE clause rather than in a
-- read-then-write pair in application code, because two requests from the same
-- user arriving together would both read "one used" and both proceed. Here the
-- second one finds the row already at the limit, updates nothing, and returns
-- no row -- so exactly one of them gets the call.
--
-- p_limit is the app's default, used only when the user has no row in
-- identify_limits. The limit actually applied comes back as day_limit so the
-- route can quote the right number to the right person.
create or replace function public.claim_identify_call(p_user_id uuid, p_limit integer)
returns table (allowed boolean, used integer, day_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_limit integer;
  v_used integer;
begin
  select limits.daily_limit into v_limit
  from public.identify_limits as limits
  where limits.user_id = p_user_id;

  v_limit := coalesce(v_limit, p_limit);

  if v_limit <= 0 then
    return query select false, 0, v_limit;
    return;
  end if;

  insert into public.identify_usage as usage (user_id, usage_date, call_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set call_count = usage.call_count + 1,
        updated_at = now()
    where usage.call_count < v_limit
  returning usage.call_count into v_used;

  -- No row came back, so the ON CONFLICT guard refused: the user is already at
  -- the cap. Read the current count for the message the route shows them.
  if v_used is null then
    select usage.call_count into v_used
    from public.identify_usage as usage
    where usage.user_id = p_user_id and usage.usage_date = v_today;

    return query select false, coalesce(v_used, v_limit), v_limit;
    return;
  end if;

  return query select true, v_used, v_limit;
end;
$$;

-- Only the service role should be able to move someone's counter. Without this
-- revoke, a logged-in user holding the anon key could call the function
-- directly -- which would only ever spend their own allowance, but there is no
-- reason to leave it reachable.
revoke all on function public.claim_identify_call(uuid, integer) from public;
revoke all on function public.claim_identify_call(uuid, integer) from anon;
revoke all on function public.claim_identify_call(uuid, integer) from authenticated;


-- ---------------------------------------------------------------------------
-- Running the caps day to day. All of these are dashboard queries -- there is
-- no admin UI for this, on purpose: raising someone's cap costs real money and
-- should take a deliberate act.
-- ---------------------------------------------------------------------------

-- Give one person a different daily cap (takes effect on their next call --
-- no deploy, no restart):
--
--   insert into public.identify_limits (user_id, daily_limit, note)
--   select id, 25, 'beta tester' from auth.users where email = 'them@example.com'
--   on conflict (user_id) do update
--     set daily_limit = excluded.daily_limit,
--         note = excluded.note,
--         updated_at = now();
--
-- Switch identification off for one account (0 is honoured as a real zero,
-- not as "fall back to the default"):
--
--   insert into public.identify_limits (user_id, daily_limit, note)
--   select id, 0, 'abuse' from auth.users where email = 'them@example.com'
--   on conflict (user_id) do update set daily_limit = 0, updated_at = now();
--
-- Put someone back on the app default -- delete the row rather than setting it
-- to 2, so they follow IDENTIFY_DAILY_LIMIT if that ever changes:
--
--   delete from public.identify_limits
--   where user_id = (select id from auth.users where email = 'them@example.com');
--
-- See who has an override, and who is using their allowance today:
--
--   select u.email, l.daily_limit, l.note
--   from public.identify_limits l join auth.users u on u.id = l.user_id
--   order by l.daily_limit desc;
--
--   select u.email, x.call_count
--   from public.identify_usage x join auth.users u on u.id = x.user_id
--   where x.usage_date = (now() at time zone 'utc')::date
--   order by x.call_count desc;
--
-- Give one person their day back after a failed call burned an allowance:
--
--   delete from public.identify_usage
--   where usage_date = (now() at time zone 'utc')::date
--     and user_id = (select id from auth.users where email = 'them@example.com');
--
-- Old usage rows are dead weight once their day has passed; nothing reads a
-- date other than today. Safe to run whenever, not required for correctness:
--
--   delete from public.identify_usage where usage_date < current_date - 30;
