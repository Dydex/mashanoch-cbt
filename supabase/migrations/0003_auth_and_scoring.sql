-- Mashnock CBT — account provisioning and server-side scoring.

begin;

-- ---------------------------------------------------------------
-- Profile is created automatically when an admin provisions an
-- auth user. Username/full_name/role/class come from user metadata.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, username, full_name, role, class)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Unnamed'),
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'student'),
    nullif(new.raw_user_meta_data->>'class','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- start_test: opens (or resumes) a student's submission.
-- ---------------------------------------------------------------
create or replace function public.start_test(p_test_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.test t, public.profiles p
    where t.id = p_test_id and p.id = auth.uid()
      and p.role = 'student' and p.class = t.class
      and now() >= t.start_time and now() <= t.end_time
  ) then
    raise exception 'Test is not open for you';
  end if;

  insert into public.submissions (test_id, student_id)
  values (p_test_id, auth.uid())
  on conflict (test_id, student_id) do nothing;

  select id into v_id from public.submissions
  where test_id = p_test_id and student_id = auth.uid();
  return v_id;
end $$;

-- ---------------------------------------------------------------
-- submit_test: grades server-side. The client never supplies a score.
-- ---------------------------------------------------------------
create or replace function public.submit_test(p_submission_id uuid)
returns table (score integer, total_questions integer)
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

  return query select v_correct * v_marks, v_total;
end $$;

revoke all on function public.handle_new_user() from public;
grant execute on function public.start_test(uuid), public.submit_test(uuid) to authenticated;

commit;
