-- Let the dashboard's pause warning see signed-in visits, not just sign-ins.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- admin_platform_metrics (from admin-metrics.sql) worked out "last activity"
-- from item edits and fresh sign-ins only. Supabase decides whether to pause a
-- free project from database requests, reads included, so a maintainer who
-- stayed signed in and browsed was shown a red pause warning on a project that
-- was nowhere near pausing. The only change below is two more inputs to
-- capacity.last_activity_at; the rest of the function is repeated unchanged
-- because a SQL function can only be replaced whole.

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
      -- Free projects can pause after a week of low activity, which for a
      -- quiet project is a likelier outage than any quota. The most recent of
      -- the things a real visit produces is the best proxy we have for it.
      --
      -- The session rows are what make it see visits. A collector who stays
      -- signed in never produces a new last_sign_in_at or login_events row,
      -- but the client refreshes its access token whenever it opens the app
      -- with an expired one and hourly while it stays open, and every refresh
      -- touches auth.sessions and mints a row in auth.refresh_tokens. Without
      -- these the dashboard reported "idle 8 of 7 days" on a project that had
      -- been used that same hour. Signing out deletes the session rows, which
      -- is why they are added to the other signals rather than replacing them.
      'last_activity_at', greatest(
        (select max(created_at) from public.inventory_items),
        (select max(updated_at) from public.inventory_items),
        (select max(last_sign_in_at) from auth.users),
        (select max(created_at) from public.login_events),
        (select max(updated_at) from auth.sessions),
        (select max(created_at) from auth.refresh_tokens)
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
