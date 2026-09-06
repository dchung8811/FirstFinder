-- Adds the triage/publish trail to the in-app feedback table, so a piece of
-- feedback can be turned into a public GitHub issue without losing track of
-- which ones have already been handled.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- The machine-generated triage: type, severity, suggested labels, the proposed
-- approach, possible duplicates. Whole thing is stored as one document because
-- the shape is owned by the triage prompt's JSON schema and will change as that
-- prompt is tuned -- promoting fields to columns would mean a migration every
-- time. Nothing queries inside it; the review UI just renders it.
alter table public.feedback add column if not exists triage jsonb;

-- Where this feedback is in the pipeline:
--   new       -- submitted, not looked at
--   triaged   -- AI triage succeeded, waiting for a human to publish or dismiss
--   published -- a GitHub issue exists for it
--   dismissed -- reviewed and deliberately not filed
--   error     -- triage failed; triage_error says why
--
-- Deliberately a separate column from the pre-existing `status`, which is the
-- owner's own free-text triage note in the table editor. Overloading that would
-- have broken whatever is already written there.
alter table public.feedback add column if not exists triage_status text not null default 'new';

alter table public.feedback add column if not exists triage_error text;
alter table public.feedback add column if not exists triaged_at timestamptz;

-- Set together when an issue is filed. The number is what the review UI shows;
-- the url is stored rather than rebuilt so a repo rename doesn't break old rows.
alter table public.feedback add column if not exists github_issue_number integer;
alter table public.feedback add column if not exists github_issue_url text;
alter table public.feedback add column if not exists published_at timestamptz;

-- The review queue is always "oldest unhandled first", so index the two columns
-- it sorts and filters on.
create index if not exists feedback_triage_status_created_at_idx
  on public.feedback (triage_status, created_at);

-- No new RLS policies on purpose.
--
-- The existing policies scope users to their own rows, and that stays true: the
-- review queue is not a user-facing feature. It is read and written only by
-- app/api/feedback-review, which runs with the service role key (bypassing RLS)
-- after checking the caller against ADMIN_USER_IDS. Adding an "admins can read
-- all feedback" policy would mean encoding who is an admin in the database and
-- widening the anon key's reach for no benefit.
