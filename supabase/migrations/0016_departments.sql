begin;

alter table public.profiles
  add column if not exists department text;

alter table public.profiles drop constraint if exists profiles_department_check;
alter table public.profiles add constraint profiles_department_check
  check (department in ('science', 'art', 'commercial'));

alter table public.subjects
  add column if not exists department text;

alter table public.subjects drop constraint if exists subjects_department_check;
alter table public.subjects add constraint subjects_department_check
  check (department in ('science', 'art', 'commercial'));

update public.profiles
   set department = case
     when upper(username) like 'MPSS%' then 'science'
     when upper(username) like 'MPSH%' then 'art'
     when upper(username) like 'MPSC%' then 'commercial'
   end
 where role = 'student'
   and class in ('SS1', 'SS2')
   and department is null;

update public.subjects
   set department = case
     when lower(name) in ('chemistry', 'physics', 'agricultural science', 'geography', 'biology',
                          'further mathematics')
       then 'science'
     when lower(name) in ('english literature', 'nigeria history', 'government',
                          'yoruba language', 'christian religious studies')
       then 'art'
     when lower(name) in ('accounting', 'commerce', 'economics')
       then 'commercial'
   end
 where department is null;

create or replace function public.subject_open_to_me(p_subject_id uuid, p_class text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select
    p_class not in ('SS1', 'SS2')
    or not exists (
      select 1 from public.subjects s
      where s.id = p_subject_id and s.department is not null
    )
    or exists (
      select 1
      from public.subjects s
      join public.profiles p on p.id = auth.uid()
      where s.id = p_subject_id and s.department = p.department
    )
$$;

grant execute on function public.subject_open_to_me(uuid, text) to authenticated;

drop policy if exists "test_select_student" on public.test;
create policy "test_select_student" on public.test for select
  using (
    public.my_role() = 'student'
    and class = public.my_class()
    and public.subject_open_to_me(subject_id, class)
    and approval_status = 'approved'
    and now() >= start_time and now() <= end_time
  );

drop policy if exists "questions_select_student" on public.questions;
create policy "questions_select_student" on public.questions for select
  using (
    exists (
      select 1 from public.test t
      where t.id = questions.test_id
        and public.my_role() = 'student'
        and t.class = public.my_class()
        and public.subject_open_to_me(t.subject_id, t.class)
        and t.approval_status = 'approved'
        and now() >= t.start_time and now() <= t.end_time
    )
  );

drop policy if exists "options_select_student" on public.question_options;
create policy "options_select_student" on public.question_options for select
  using (
    exists (
      select 1 from public.questions q join public.test t on t.id = q.test_id
      where q.id = question_options.question_id
        and public.my_role() = 'student'
        and t.class = public.my_class()
        and public.subject_open_to_me(t.subject_id, t.class)
        and t.approval_status = 'approved'
        and now() >= t.start_time and now() <= t.end_time
    )
  );

create or replace function public.start_test(p_test_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.test t, public.profiles p
    where t.id = p_test_id and p.id = auth.uid()
      and p.role = 'student' and p.class = t.class
      and public.subject_open_to_me(t.subject_id, t.class)
      and t.approval_status = 'approved'
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

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, username, full_name, role, class, first_name, last_name, department)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Unnamed'),
    case
      when new.raw_app_meta_data->>'role' in ('teacher', 'admin')
        then new.raw_app_meta_data->>'role'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'class',''),
    nullif(new.raw_user_meta_data->>'first_name',''),
    nullif(new.raw_user_meta_data->>'last_name',''),
    nullif(new.raw_user_meta_data->>'department','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

commit;
