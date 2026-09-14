-- Students are not shown their scores.
--
-- The app no longer shows students their results: no results page, no score
-- after submitting, none on the tests list. The database would still hand the
-- score to anyone who asked for it directly, in two ways: `authenticated`
-- could read submissions.score (0002), and submit_test returned the score to
-- the student who called it (0003). This closes both.
--
-- Column grants belong to a role, not a person, and every signed-in user is
-- `authenticated`, so staff lose direct read access to the column as well.
-- That costs nothing: every page that shows scores (admin/results,
-- teacher/[testId]/results) reads them with the service role, which this does
-- not touch.

begin;

revoke select (score) on public.submissions from authenticated;

-- Grading is exactly as in 0003; only the reply changes. CREATE OR REPLACE
-- cannot change a function's return type, hence the drop. The app only checks
-- whether the call failed, never what it returned.
drop function if exists public.submit_test(uuid);

create function public.submit_test(p_submission_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_test_id uuid;
  v_marks   integer;
  v_total   integer;
  v_correct integer;
begin
  select s.test_id into v_test_id
  from public.submissions s
  where s.id = p_submission_id
    and s.student_id = auth.uid()
    and s.status = 'in_progress';

  if v_test_id is null then
    raise exception 'No open submission for you';
  end if;

  select t.marks_per_question into v_marks from public.test t where t.id = v_test_id;

  update public.answers a
     set is_correct = coalesce(o.is_correct, false)
    from public.question_options o
   where a.submission_id = p_submission_id
     and o.id = a.selected_option_id;

  update public.answers a
     set is_correct = false
   where a.submission_id = p_submission_id and a.selected_option_id is null;

  select count(*) into v_total   from public.questions where test_id = v_test_id;
  select count(*) into v_correct from public.answers
   where submission_id = p_submission_id and is_correct;

  update public.submissions s
     set status = 'submitted',
         submitted_at = now(),
         score = v_correct * v_marks,
         total_questions = v_total
   where s.id = p_submission_id;
end $$;

-- A new function is executable by everyone by default. Only signed-in users
-- need it, as before.
revoke all on function public.submit_test(uuid) from public, anon;
grant execute on function public.submit_test(uuid) to authenticated;

commit;
