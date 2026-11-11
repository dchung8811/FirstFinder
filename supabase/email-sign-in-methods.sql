-- The sign-in card's email lookup.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Until it has run, /api/email-lookup answers "unknown" and
-- the card falls back to asking for a password, so the code can ship first.
--
-- The trade-off -- this tells anyone whether an address has an account -- is
-- written up in src/utils/emailLookup.js.

-- email_sign_in_methods: the sign-in card's first step. Given an address, the
-- sign-in methods on its account ('email', 'google', 'apple'), or null when
-- there is no account, so the card can ask for a password, offer to create an
-- account, or point at the right button. Classified in
-- src/utils/emailLookup.js; called only by /api/email-lookup, which rate
-- limits it.
--
-- security definer so it can read auth.users and auth.identities, which is
-- why who may call it matters: only the service role. Anyone holding the anon
-- key could otherwise check addresses as fast as they liked. It returns
-- provider names and nothing else -- no ids, names or dates.
create or replace function public.email_sign_in_methods(p_email text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct i.provider order by i.provider) filter (where i.provider is not null),
    '{}'
  )
  from auth.users u
  left join auth.identities i on i.user_id = u.id
  where lower(u.email) = lower(trim(p_email))
  having count(u.id) > 0;
$$;

revoke all on function public.email_sign_in_methods(text) from public;
revoke all on function public.email_sign_in_methods(text) from anon;
revoke all on function public.email_sign_in_methods(text) from authenticated;
grant execute on function public.email_sign_in_methods(text) to service_role;
