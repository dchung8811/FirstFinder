-- The admin dashboard's data layer: platform-wide counts, a login history, and
-- the one timestamp the share table was missing.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Everything here is read through the service role from app/api/admin/stats,
-- never from the browser. That is the whole security model: there is no admin
-- RLS policy anywhere below, because a policy that says "this user may read
-- everyone's rows" is a permanent, database-level hole that outlives whatever
-- the app currently believes about who is an admin. The service role already
-- bypasses RLS, it only exists on the server, and the route gates it on an
-- explicit id allowlist -- so the privilege lives in one route, in one file,
-- and can be revoked by editing an environment variable.

-- ---------------------------------------------------------------------------
-- login_events: the login history Supabase does not keep for us.
-- ---------------------------------------------------------------------------
-- auth.audit_log_entries is where GoTrue records sign-ins, and on this project
-- it is empty -- those rows are pruned, and nothing we do makes them stay. The
-- other two candidates are worse: auth.sessions holds live sessions (a logout
-- erases the evidence), and auth.users.last_sign_in_at is a single overwritten
-- timestamp, so it can answer "who is active" but never "how many logins".
--
-- Hence our own append-only table. One row per sign-in, written by the client
-- from onAuthStateChange. It starts empty and only counts forward: the logins
-- that happened before this migration are not recoverable from anywhere.
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Every query against this table is "how many, over what window", so the sort
-- key is the index. user_id is included for the distinct-users-per-window count.
create index if not exists login_events_created_at_idx
  on public.login_events (created_at desc);
create index if not exists login_events_user_id_created_at_idx
  on public.login_events (user_id, created_at desc);

alter table public.login_events enable row level security;

-- Insert-own and nothing else. Deliberately no select policy, for anyone: a
-- user reading this table learns when other people signed in, and a user who
-- can read their own rows gains nothing the app would ever show them. The
-- dashboard reads it through the service role, which ignores policies.
--
-- Worth being clear about what this insert policy can and cannot do. It stops
-- one user writing a login row attributed to another, because with check pins
-- user_id to auth.uid(). It does NOT stop a signed-in user inserting extra
-- rows for themselves -- they hold the anon key and could POST in a loop. That
-- is acceptable for a metric that informs nobody but the maintainer, and the
-- alternative (a server route per login) buys accuracy against an adversary
-- who gains nothing by lying. If this number ever drives something that
-- matters, move the write server-side rather than trying to patch it here.
drop policy if exists "Users can record own logins" on public.login_events;
create policy "Users can record own logins"
on public.login_events for insert to authenticated
with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- shared_collections.first_published_at: when the page actually went live.
-- ---------------------------------------------------------------------------
-- created_at is stamped when the share dialog first writes a row, which
-- happens on the first save regardless of visibility -- so it answers "when did
-- someone look at sharing", not "when did a page go public". updated_at moves
-- on every later edit. Neither can support "new shares this week", which is the
-- number the dashboard is actually asked for.
--
-- Set once, on the first transition away from 'off', and never cleared again --
-- unpublishing does not un-happen the publish, and clearing it would make the
-- history flap as collectors toggle their page.
alter table public.shared_collections
  add column if not exists first_published_at timestamptz;

-- Backfill: any page already live was first published at some unknown point at
-- or before its last edit, and updated_at is the closest honest upper bound.
-- Only touches rows that are live and unstamped, so re-running is a no-op.
update public.shared_collections
  set first_published_at = updated_at
  where visibility <> 'off' and first_published_at is null;

-- Stamped by a trigger rather than by the app for three reasons: the share
-- dialog writes this row with an upsert that would have to read the old value
-- back to know whether to set it (a read-then-write two callers can race), any
-- future write path would have to remember the same rule, and doing it in the
-- statement that changes visibility makes "published" and "first published at"
-- impossible to get out of step.
create or replace function public.stamp_first_published()
returns trigger
language plpgsql
-- Pinned for the same reason admin_platform_metrics pins it: a function whose
-- search_path follows the caller's can be pointed at objects the author did not
-- intend. Nothing here resolves an unqualified name today, so this is
-- hardening rather than a fix, and it keeps the two functions consistent.
set search_path = public
as $$
begin
  -- Set once, on the first write that leaves it live, and never cleared:
  -- unpublishing does not un-happen the publish. Without the null check a
  -- collector toggling their page off and on would keep resetting the date and
  -- reappear as a new share every time.
  if new.visibility <> 'off' and new.first_published_at is null then
    new.first_published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists shared_collections_stamp_first_published on public.shared_collections;
create trigger shared_collections_stamp_first_published
  before insert or update on public.shared_collections
  for each row execute function public.stamp_first_published();

-- ---------------------------------------------------------------------------
-- admin_platform_metrics: every dashboard number, in one round trip.
-- ---------------------------------------------------------------------------
-- Why a database function rather than a dozen supabase-js count() calls:
--
--   1. auth.users is not in the API's exposed schema, so PostgREST cannot
--      count it. The alternative is auth.admin.listUsers(), which paginates
--      every user into the route just to take a length -- fine at six users,
--      absurd at six thousand.
--   2. The owner-exclusion has to be applied identically to a dozen counts.
--      Expressed once here, it cannot drift between them.
--   3. One round trip instead of a dozen, which is what makes a 60-second
--      poll cost nothing.
--
-- p_exclude is the admin id list: the maintainer's own account dominates every
-- count on a young platform (192 of 193 items at the time of writing), so each
-- figure is returned twice -- once whole, once with those ids removed. The
-- dashboard leads with the excluding number and keeps the total beside it, so
-- the honest total is never hidden, just demoted.
--
-- Returns jsonb rather than a wide row on purpose: this shape changes every
-- time a metric is added, and a jsonb return means adding one is an edit here
-- plus an edit in the UI, with no signature change and no migration to keep in
-- step. Nothing queries inside it -- same reasoning as feedback.triage.
create or replace function public.admin_platform_metrics(p_exclude uuid[] default '{}')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),

    'users', (
      select jsonb_build_object(
        'total', count(*),
        'excluding_admins', count(*) filter (where not (u.id = any(p_exclude))),
        'new_7d', count(*) filter (where u.created_at > now() - interval '7 days' and not (u.id = any(p_exclude))),
        'new_30d', count(*) filter (where u.created_at > now() - interval '30 days' and not (u.id = any(p_exclude))),
        -- last_sign_in_at is a single overwritten timestamp, so this is "came
        -- back at least once in the window", not a visit count. It is the one
        -- activity figure that has history behind it today; the login_events
        -- counts below only start from this migration.
        'active_7d', count(*) filter (where u.last_sign_in_at > now() - interval '7 days' and not (u.id = any(p_exclude))),
        'active_30d', count(*) filter (where u.last_sign_in_at > now() - interval '30 days' and not (u.id = any(p_exclude))),
        -- Signed up and never came back: the clearest single signal of whether
        -- the front door works. Counted as "one sign-in ever", since the
        -- account-creating login itself sets last_sign_in_at.
        'never_returned', count(*) filter (
          where not (u.id = any(p_exclude))
            and (u.last_sign_in_at is null or u.last_sign_in_at <= u.created_at + interval '5 minutes')
        )
      )
      from auth.users u
    ),

    'items', (
      select jsonb_build_object(
        'total', count(*),
        'excluding_admins', count(*) filter (where not (i.user_id = any(p_exclude))),
        'new_7d', count(*) filter (where i.created_at > now() - interval '7 days' and not (i.user_id = any(p_exclude))),
        'new_30d', count(*) filter (where i.created_at > now() - interval '30 days' and not (i.user_id = any(p_exclude))),
        'with_photos', count(*) filter (where i.item_photo_count > 0 and not (i.user_id = any(p_exclude))),
        -- Collectors who hold at least one item, which is the number that says
        -- whether signups are turning into use.
        'collectors', count(distinct i.user_id) filter (where not (i.user_id = any(p_exclude)))
      )
      from public.inventory_items i
    ),

    'shares', (
      select jsonb_build_object(
        'rows', count(*) filter (where not (s.user_id = any(p_exclude))),
        'published', count(*) filter (where s.visibility <> 'off' and not (s.user_id = any(p_exclude))),
        'listed', count(*) filter (where s.visibility = 'listed' and not (s.user_id = any(p_exclude))),
        'unlisted', count(*) filter (where s.visibility = 'unlisted' and not (s.user_id = any(p_exclude))),
        'new_30d', count(*) filter (where s.first_published_at > now() - interval '30 days' and not (s.user_id = any(p_exclude))),
        -- Opened the dialog, saved, and left it off. A visible drop-off point.
        'started_not_published', count(*) filter (where s.visibility = 'off' and not (s.user_id = any(p_exclude)))
      )
      from public.shared_collections s
    ),

    'feedback', (
      select jsonb_build_object(
        'total', count(*),
        'new_7d', count(*) filter (where f.created_at > now() - interval '7 days'),
        'filed_to_github', count(*) filter (where f.github_issue_number is not null),
        -- Anything stuck in 'error' is feedback a person took the trouble to
        -- write that never reached the tracker, so it is worth surfacing.
        'errored', count(*) filter (where f.triage_status = 'error')
      )
      from public.feedback f
    ),

    'identify', (
      select jsonb_build_object(
        -- The only metric here attached to a per-call bill, which is why it is
        -- on the dashboard at all: every identification is a paid, search-
        -- grounded model call.
        'calls_today', coalesce(sum(x.call_count) filter (where x.usage_date = (now() at time zone 'utc')::date), 0),
        'calls_7d', coalesce(sum(x.call_count) filter (where x.usage_date > (now() at time zone 'utc')::date - 7), 0),
        'calls_30d', coalesce(sum(x.call_count) filter (where x.usage_date > (now() at time zone 'utc')::date - 30), 0),
        'users_today', count(distinct x.user_id) filter (where x.usage_date = (now() at time zone 'utc')::date),
        'overrides', (select count(*) from public.identify_limits)
      )
      from public.identify_usage x
    ),

    'logins', (
      select jsonb_build_object(
        'total', count(*),
        'd7', count(*) filter (where l.created_at > now() - interval '7 days'),
        'd30', count(*) filter (where l.created_at > now() - interval '30 days'),
        'users_7d', count(distinct l.user_id) filter (where l.created_at > now() - interval '7 days'),
        -- Lets the UI say "since <date>" instead of quietly presenting a
        -- partial count as a lifetime total. Null until the first login lands.
        'tracked_since', min(l.created_at)
      )
      from public.login_events l
      where not (l.user_id = any(p_exclude))
    ),

    -- The capacity half: what the free plan meters, read from the database
    -- itself. Thresholds and plan limits live in application code
    -- (src/utils/platformLimits.js), not here -- they are a published price
    -- list that changes without warning, and editing a constant is a deploy
    -- while editing this function is a migration.
    'capacity', jsonb_build_object(
      'db_bytes', pg_database_size(current_database()),
      'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
      'storage_objects', (select count(*) from storage.objects),
      -- Supabase bills monthly active users across the whole project, so this
      -- one is deliberately NOT owner-excluded: it must match what they meter.
      'mau_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      -- Free projects pause after a week of inactivity, which for a quiet
      -- project is a likelier outage than any quota. The most recent of the
      -- things a real visit produces is the best proxy we have for it.
      'last_activity_at', greatest(
        (select max(created_at) from public.inventory_items),
        (select max(updated_at) from public.inventory_items),
        (select max(last_sign_in_at) from auth.users),
        (select max(created_at) from public.login_events)
      )
    )
  );
$$;

-- security definer means this function runs as its owner and can read
-- auth.users, so who may call it matters more than usual. Only the service
-- role should -- revoke the default grant from everyone else. Without this, any
-- holder of the anon key could call it directly and read the entire platform's
-- shape, which is exactly the leak the whole design above is avoiding.
revoke all on function public.admin_platform_metrics(uuid[]) from public;
revoke all on function public.admin_platform_metrics(uuid[]) from anon;
revoke all on function public.admin_platform_metrics(uuid[]) from authenticated;
