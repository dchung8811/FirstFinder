-- A per-user daily cap on scan-to-fill (app/api/scan-book), kept separate
-- from the photo-identification cap in identify-daily-limit.sql.
--
-- They are separate because they cost wildly different amounts. A scan is a
-- small vision model copying printed text off a cover or a copyright page --
-- about a twentieth of a cent -- while an identification is a reasoning model
-- running live web searches. Sharing one counter would mean either a scan cap
-- of two a day, which defeats the point of a cheap way in, or an
-- identification cap high enough to cost real money. The cap here is generous
-- and exists only so a script hammering the endpoint can't run up a bill.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: everything here is create-if-not-exists or create-or-replace.
-- Until it is run, the route falls back to a per-instance counter of the same
-- size and logs that it did.

create table if not exists public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- RLS on with no policies, so only the service role -- which only the route
-- holds -- can read or move a counter. Same reasoning as identify_usage.
alter table public.scan_usage enable row level security;

-- Claims one scan and reports the count, atomically. The check sits in the
-- ON CONFLICT ... WHERE clause for the same reason as claim_identify_call: two
-- requests arriving together can't both read "under the cap" and both proceed.
create or replace function public.claim_scan_call(p_user_id uuid, p_limit integer)
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

  insert into public.scan_usage as usage (user_id, usage_date, call_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set call_count = usage.call_count + 1,
        updated_at = now()
    where usage.call_count < p_limit
  returning usage.call_count into v_used;

  if v_used is null then
    return query select false, p_limit, p_limit;
    return;
  end if;

  return query select true, v_used, p_limit;
end;
$$;

revoke all on function public.claim_scan_call(uuid, integer) from public;
revoke all on function public.claim_scan_call(uuid, integer) from anon;
revoke all on function public.claim_scan_call(uuid, integer) from authenticated;

-- Who is scanning the most today (a dashboard query, not used by the app):
--
--   select u.email, s.call_count
--   from public.scan_usage s join auth.users u on u.id = s.user_id
--   where s.usage_date = (now() at time zone 'utc')::date
--   order by s.call_count desc;
