begin;

revoke select (score) on public.submissions from authenticated;

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

revoke all on function public.submit_test(uuid) from public, anon;
grant execute on function public.submit_test(uuid) to authenticated;

commit;
