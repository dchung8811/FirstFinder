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

create table if not exists public.identify_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- RLS on with no policies at all, which denies every anon and authenticated
-- request by default. Only the service role -- which bypasses RLS, and which
-- only the server route holds -- reads or writes this table. A user being able
-- to see or edit their own allowance is precisely what this is guarding
-- against.
alter table public.identify_usage enable row level security;

-- Claims one call and reports what the caller has used, in a single atomic
-- statement.
--
-- The check lives in the ON CONFLICT ... WHERE clause rather than in a
-- read-then-write pair in application code, because two requests from the same
-- user arriving together would both read "1 used" and both proceed. Here the
-- second one finds the row already at the limit, updates nothing, and returns
-- no row -- so exactly one of them gets the call.
create or replace function public.claim_identify_call(p_user_id uuid, p_limit integer)
returns table (allowed boolean, used integer, day_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if p_limit <= 0 then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.identify_usage as usage (user_id, usage_date, call_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set call_count = usage.call_count + 1,
        updated_at = now()
    where usage.call_count < p_limit
  returning usage.call_count into v_used;

  -- No row came back, so the ON CONFLICT guard refused: the user is already at
  -- the cap. Read the current count for the message the route shows them.
  if v_used is null then
    select usage.call_count into v_used
    from public.identify_usage as usage
    where usage.user_id = p_user_id and usage.usage_date = v_today;

    return query select false, coalesce(v_used, p_limit), p_limit;
    return;
  end if;

  return query select true, v_used, p_limit;
end;
$$;

-- Only the service role should be able to move someone's counter. Without this
-- revoke, a logged-in user holding the anon key could call the function
-- directly -- which would only ever spend their own allowance, but there is no
-- reason to leave it reachable.
revoke all on function public.claim_identify_call(uuid, integer) from public;
revoke all on function public.claim_identify_call(uuid, integer) from anon;
revoke all on function public.claim_identify_call(uuid, integer) from authenticated;

-- Old rows are dead weight once their day has passed; nothing reads a date
-- other than today. Deleting them is safe to run whenever, and is not required
-- for correctness:
--
--   delete from public.identify_usage where usage_date < current_date - 30;
