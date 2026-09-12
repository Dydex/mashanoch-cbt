-- Drop the duplicate student-options view, and strip the anon role.
--
-- question_options_for_students predates these migrations and is now identical
-- in purpose to exam_options. To restore it:
--   create view public.question_options_for_students with (security_invoker=true)
--     as select id, question_id, option_text from public.question_options;
--
-- anon is the pre-login role. This app never queries as anon (login runs
-- server-side against the service role), so it needs no table access at all.
-- RLS already blocked it; this removes the grants behind the policies too.

begin;

drop view if exists public.question_options_for_students;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- The revokes above only touch objects that exist right now. Without this,
-- any table created later picks up Supabase's default grants and anon is
-- back. This makes the rule stand for future tables too.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

commit;
