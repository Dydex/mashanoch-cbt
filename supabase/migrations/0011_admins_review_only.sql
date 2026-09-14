-- Admins review tests; they never write them.
--
-- Teachers write tests and admins approve them. An admin who could also
-- change a paper would be approving their own work, so the app refuses them
-- on every write (requireTeacher and requireTestOwner in src/lib/auth.ts).
-- The database still let them through, though: the policies from 0002 gave
-- "owner or admin" write access to test, questions and question_options, so
-- an admin could edit any paper straight through the API with their own
-- token. From here, only the teacher who wrote a test may change it.
--
-- Admins keep every read they had, and deleting a test is unchanged. The
-- service role bypasses these policies and has no signed-in user to check,
-- so on that path the app's own guards are what protect the paper.

begin;

-- True when the signed-in user is a teacher and wrote this test.
create or replace function public.authors_test(p_test_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.test t
    where t.id = p_test_id
      and t.created_by = auth.uid()
      and public.my_role() = 'teacher'
  )
$$;

grant execute on function public.authors_test(uuid) to authenticated;

-- ---------------------------------------------------------------
-- test
-- ---------------------------------------------------------------

drop policy if exists "test_insert_staff"   on public.test;
drop policy if exists "test_insert_teacher" on public.test;
create policy "test_insert_teacher" on public.test for insert
  with check (public.my_role() = 'teacher' and created_by = auth.uid());

drop policy if exists "test_update_owner"  on public.test;
drop policy if exists "test_update_author" on public.test;
create policy "test_update_author" on public.test for update
  using (created_by = auth.uid() and public.my_role() = 'teacher')
  with check (created_by = auth.uid() and public.my_role() = 'teacher');

-- ---------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------
-- Split by job: the owner and admins read, only the author writes. A single
-- FOR ALL policy would tie reads to the narrower write rule, so reads get
-- their own policy.

drop policy if exists "questions_manage_owner" on public.questions;
drop policy if exists "questions_select_owner" on public.questions;
drop policy if exists "questions_write_author" on public.questions;
create policy "questions_select_owner" on public.questions for select
  using (public.owns_test(test_id));
create policy "questions_write_author" on public.questions for all
  using (public.authors_test(test_id))
  with check (public.authors_test(test_id));

-- ---------------------------------------------------------------
-- question_options
-- ---------------------------------------------------------------
-- authenticated holds no write grant on this table (0002, 0005), so the
-- write policy only matters if one is ever added. It matches questions so
-- that adding one cannot quietly reopen admin edits.

drop policy if exists "options_manage_owner" on public.question_options;
drop policy if exists "options_select_owner" on public.question_options;
drop policy if exists "options_write_author" on public.question_options;
create policy "options_select_owner" on public.question_options for select
  using (
    exists (select 1 from public.questions q
            where q.id = question_options.question_id and public.owns_test(q.test_id))
  );
create policy "options_write_author" on public.question_options for all
  using (
    exists (select 1 from public.questions q
            where q.id = question_options.question_id and public.authors_test(q.test_id))
  )
  with check (
    exists (select 1 from public.questions q
            where q.id = question_options.question_id and public.authors_test(q.test_id))
  );

commit;
