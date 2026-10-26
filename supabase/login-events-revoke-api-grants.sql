-- Take every API-key privilege off login_events.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- login-events-trigger.sql moved the writes into a trigger and revoked the one
-- grant this repo had made, insert for authenticated. Checking production
-- afterwards turned up more: anon could insert and authenticated could select,
-- from the default grants Supabase gave new public tables when this project
-- was created. Nothing could use them -- RLS is on and the table has no
-- policies -- but they would come alive the moment anyone added a policy for
-- some other purpose, and a readable login_events tells anyone when everyone
-- else signs in.
--
-- service_role keeps its explicit grant from admin-metrics.sql; the admin
-- dashboard and the trigger (which runs as the table's owner) are the only
-- readers and writers.

revoke all on public.login_events from anon, authenticated;
