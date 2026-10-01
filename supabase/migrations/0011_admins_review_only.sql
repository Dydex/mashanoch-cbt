begin;

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

drop policy if exists "test_insert_staff"   on public.test;
drop policy if exists "test_insert_teacher" on public.test;
create policy "test_insert_teacher" on public.test for insert
  with check (public.my_role() = 'teacher' and created_by = auth.uid());

drop policy if exists "test_update_owner"  on public.test;
drop policy if exists "test_update_author" on public.test;
create policy "test_update_author" on public.test for update
  using (created_by = auth.uid() and public.my_role() = 'teacher')
  with check (created_by = auth.uid() and public.my_role() = 'teacher');

drop policy if exists "questions_manage_owner" on public.questions;
drop policy if exists "questions_select_owner" on public.questions;
drop policy if exists "questions_write_author" on public.questions;
create policy "questions_select_owner" on public.questions for select
  using (public.owns_test(test_id));
create policy "questions_write_author" on public.questions for all
  using (public.authors_test(test_id))
  with check (public.authors_test(test_id));

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
