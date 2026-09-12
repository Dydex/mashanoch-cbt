-- Mashnock CBT — RLS policies and column-level grants.
-- Principle: the answer key and anything score-bearing never reaches a client
-- token. Those paths go through server routes using the service role.

begin;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can view own profile"   on public.profiles;

create policy "profiles_select_own"   on public.profiles for select
  using (id = auth.uid());
create policy "profiles_select_staff" on public.profiles for select
  using (public.is_staff());
create policy "profiles_write_admin"  on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------
drop policy if exists "Admins can create subjects" on public.subjects;
drop policy if exists "Admins can update subjects" on public.subjects;

create policy "subjects_select_auth"  on public.subjects for select
  to authenticated using (true);
create policy "subjects_write_admin"  on public.subjects for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------
-- test
-- ---------------------------------------------------------------
drop policy if exists "Creators can update their tests"              on public.test;
drop policy if exists "Students can view active tests for their class" on public.test;
drop policy if exists "Teachers and admins can create tests"         on public.test;
drop policy if exists "Teachers and admins can view all tests"       on public.test;

create policy "test_select_staff"   on public.test for select
  using (public.is_staff());
create policy "test_select_student" on public.test for select
  using (
    public.my_role() = 'student'
    and class = public.my_class()
    and now() >= start_time and now() <= end_time
  );
create policy "test_insert_staff"   on public.test for insert
  with check (public.is_staff() and created_by = auth.uid());
create policy "test_update_owner"   on public.test for update
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());
create policy "test_delete_owner"   on public.test for delete
  using (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------
drop policy if exists "Students view questions for active tests" on public.questions;
drop policy if exists "Teachers and admins manage questions"     on public.questions;

create policy "questions_select_student" on public.questions for select
  using (
    exists (
      select 1 from public.test t
      where t.id = questions.test_id
        and public.my_role() = 'student'
        and t.class = public.my_class()
        and now() >= t.start_time and now() <= t.end_time
    )
  );
create policy "questions_manage_owner" on public.questions for all
  using (public.owns_test(test_id)) with check (public.owns_test(test_id));

-- ---------------------------------------------------------------
-- question_options — the answer key lives here.
-- No client role may read this table directly; students read the
-- exam_options view below, staff author through server routes.
-- ---------------------------------------------------------------
drop policy if exists "Students view options for active tests" on public.question_options;
drop policy if exists "Teachers and admins manage options"     on public.question_options;

create policy "options_select_student" on public.question_options for select
  using (
    exists (
      select 1 from public.questions q join public.test t on t.id = q.test_id
      where q.id = question_options.question_id
        and public.my_role() = 'student'
        and t.class = public.my_class()
        and now() >= t.start_time and now() <= t.end_time
    )
  );
create policy "options_manage_owner" on public.question_options for all
  using (
    exists (select 1 from public.questions q
            where q.id = question_options.question_id and public.owns_test(q.test_id))
  )
  with check (
    exists (select 1 from public.questions q
            where q.id = question_options.question_id and public.owns_test(q.test_id))
  );

revoke all on public.question_options from anon, authenticated;

-- Students see options with is_correct stripped. security_invoker keeps the
-- RLS policy above in force for whoever queries it.
create or replace view public.exam_options
  with (security_invoker = true) as
  select id, question_id, option_text, created_at
  from public.question_options;

grant select on public.exam_options to authenticated;

-- ---------------------------------------------------------------
-- submissions — score and status are server-owned.
-- ---------------------------------------------------------------
drop policy if exists "Students create own submission"        on public.submissions;
drop policy if exists "Students update own submission"        on public.submissions;
drop policy if exists "Students view own submission"          on public.submissions;
drop policy if exists "Teachers and admins view all submissions" on public.submissions;

create policy "submissions_select_own"   on public.submissions for select
  using (student_id = auth.uid());
create policy "submissions_select_staff" on public.submissions for select
  using (public.is_staff());

revoke all on public.submissions from anon, authenticated;
grant select (id, test_id, student_id, score, total_questions,
              started_at, submitted_at, status)
  on public.submissions to authenticated;

-- ---------------------------------------------------------------
-- answers — students may record a choice, never its correctness.
-- ---------------------------------------------------------------
drop policy if exists "Students manage own answers"          on public.answers;
drop policy if exists "Teachers and admins view all answers" on public.answers;

create policy "answers_select_own"   on public.answers for select
  using (exists (select 1 from public.submissions s
                 where s.id = answers.submission_id and s.student_id = auth.uid()));
create policy "answers_select_staff" on public.answers for select
  using (public.is_staff());
create policy "answers_insert_own"   on public.answers for insert
  with check (public.can_write_answer(submission_id));
create policy "answers_update_own"   on public.answers for update
  using (public.can_write_answer(submission_id))
  with check (public.can_write_answer(submission_id));

revoke all on public.answers from anon, authenticated;
grant select (id, submission_id, question_id, selected_option_id)
  on public.answers to authenticated;
grant insert (submission_id, question_id, selected_option_id)
  on public.answers to authenticated;
grant update (selected_option_id) on public.answers to authenticated;

commit;
