-- The "you added your first book" email: one row per collector, claimed before
-- the email is sent so it goes out once and only once.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Apply it just before deploying the code that uses it: the
-- backfill at the bottom marks everyone who already has items, and anyone who
-- adds a first item in the gap between the two is the only person it misses.
--
-- A table of its own rather than a column, because there is no per-user
-- profile row to put a column on: accounts live in auth.users, which this
-- project does not alter, and every other per-user record here is a table
-- keyed by user_id.
--
-- status is the claim:
--   sending  -- claimed by app/api/first-item-email; the send is in flight
--   sent     -- delivered to Gmail
--   existing -- the collector had items before this email existed, so they
--               never get it (written by the backfill below)
-- A failed send deletes the row, so the next item they add tries again.

create table if not exists public.first_item_emails (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null check (status in ('sending', 'sent', 'existing')),
  claimed_at timestamptz not null default now(),
  sent_at timestamptz
);

-- RLS on with no policies, and every API-key privilege revoked: only the
-- route, through the service role, reads or writes this. A collector able to
-- delete their own row could have the email sent to them as often as they
-- liked, from the project's one Gmail account.
alter table public.first_item_emails enable row level security;
revoke all on public.first_item_emails from anon, authenticated;
grant select, insert, update, delete on public.first_item_emails to service_role;

-- The atomic claim. True means this caller won and must send (then mark the
-- row sent, or delete it on failure); false means someone else already has.
--
-- The conditional update covers a claim whose sender died between claiming
-- and either finishing or releasing -- a function timeout, a deploy. Without
-- it that collector would be stuck at 'sending' forever. Fifteen minutes is
-- far longer than any real send, so it never steals a claim that is still
-- working.
create or replace function public.claim_first_item_email(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with claimed as (
    insert into public.first_item_emails as f (user_id, status, claimed_at)
    values (p_user_id, 'sending', now())
    on conflict (user_id) do update
      set status = 'sending', claimed_at = now()
      where f.status = 'sending' and f.claimed_at < now() - interval '15 minutes'
    returning 1
  )
  select exists (select 1 from claimed);
$$;

revoke all on function public.claim_first_item_email(uuid) from public;
revoke all on function public.claim_first_item_email(uuid) from anon;
revoke all on function public.claim_first_item_email(uuid) from authenticated;
grant execute on function public.claim_first_item_email(uuid) to service_role;

-- Everyone who already has items has added their first book long ago. Sending
-- them "you added your first book" on their fiftieth would be wrong, so they
-- are marked as never getting it.
insert into public.first_item_emails (user_id, status)
select distinct user_id, 'existing'
from public.inventory_items
on conflict (user_id) do nothing;
