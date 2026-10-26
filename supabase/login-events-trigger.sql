-- Record every sign-in in login_events, including Google and email-link ones.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- admin-metrics.sql had the browser insert a login_events row when the app's
-- auth listener saw SIGNED_IN. Sign-ins that come back through a redirect --
-- Google, and the email confirmation link every new collector's first sign-in
-- goes through -- are completed by supabase-js before the app mounts, and by
-- the time the listener hears about them the app has already loaded that user
-- from getSession and skips them as a restored session. Of ten Google users,
-- nine had no login rows at all; no signup in the thirty days before this
-- patch had one.
--
-- This moves the write into the database, onto the column Supabase itself
-- updates when it completes a sign-in. last_sign_in_at moves on every real
-- sign-in and never on a token refresh, so the count keeps meaning what it
-- did. Sign-ins already missed cannot be recovered; the history is complete
-- from this patch on.
--
-- Run this before deploying the app change that removes recordLogin. In the
-- window between the two, the old client's insert is refused by the revoke
-- below and silently dropped, so nothing is counted twice.

create or replace function public.record_login_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is null then
    return new;
  end if;
  -- Nested rather than one OR: OLD has no row on insert, and an OR is not
  -- guaranteed to skip reading it.
  if tg_op = 'UPDATE' then
    if new.last_sign_in_at is not distinct from old.last_sign_in_at then
      return new;
    end if;
  end if;

  -- This runs inside the auth.users update that completes the sign-in, so an
  -- error here would lock a collector out over a missing metric. One lost row
  -- is the better failure.
  begin
    insert into public.login_events (user_id, created_at)
    values (new.id, new.last_sign_in_at);
  exception when others then
    raise warning 'login event not recorded for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.record_login_event() from public;
revoke all on function public.record_login_event() from anon;
revoke all on function public.record_login_event() from authenticated;

drop trigger if exists on_auth_user_sign_in on auth.users;
create trigger on_auth_user_sign_in
  after insert or update of last_sign_in_at on auth.users
  for each row execute function public.record_login_event();

-- Nothing in the browser writes this table any more. With the policy gone and
-- RLS still on, the API keys can neither read nor write it -- which also stops
-- a signed-in user inserting rows that inflate the dashboard.
drop policy if exists "Users can record own logins" on public.login_events;
revoke insert on public.login_events from authenticated;
