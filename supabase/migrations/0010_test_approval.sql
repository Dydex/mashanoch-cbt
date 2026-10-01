begin;

alter table public.test
  add column if not exists approval_status text not null default 'approved';
alter table public.test
  alter column approval_status set default 'draft';

alter table public.test drop constraint if exists test_approval_status_check;
alter table public.test add constraint test_approval_status_check
  check (approval_status in ('draft', 'pending', 'changes_requested', 'approved'));

create index if not exists test_approval_status_idx on public.test (approval_status);

create table if not exists public.test_reviews (
  id         uuid primary key default gen_random_uuid(),
  test_id    uuid not null references public.test (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  kind       text not null
    check (kind in ('submitted', 'approved', 'changes_requested', 'comment')),
  body       text check (length(body) <= 2000),
  created_at timestamptz not null default now(),
  constraint test_reviews_body_required
    check (kind in ('submitted', 'approved') or length(btrim(coalesce(body, ''))) > 0)
);

create index if not exists test_reviews_test_idx   on public.test_reviews (test_id, created_at);
create index if not exists test_reviews_author_idx on public.test_reviews (author_id);

alter table public.test_reviews enable row level security;

drop policy if exists "test_reviews_select_owner" on public.test_reviews;
create policy "test_reviews_select_owner" on public.test_reviews for select
  using (public.owns_test(test_id));

revoke all on public.test_reviews from anon, authenticated;
grant select on public.test_reviews to authenticated;
grant all on public.test_reviews to service_role;

drop policy if exists "test_select_student" on public.test;
create policy "test_select_student" on public.test for select
  using (
    public.my_role() = 'student'
    and class = public.my_class()
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

create or replace function public.can_write_answer(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.submissions s
    join public.test t on t.id = s.test_id
    where s.id = p_submission_id
      and s.student_id = auth.uid()
      and s.status = 'in_progress'
      and t.approval_status = 'approved'
      and now() >= t.start_time
      and now() <= t.end_time
      and now() <= s.started_at + make_interval(mins => t.duration_minutes)
  )
$$;

create or replace function public.reject_write_to_started_test()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_test_id uuid;
  v_start   timestamptz;
  v_status  text;
begin
  if TG_TABLE_NAME = 'questions' then
    v_test_id := coalesce(new.test_id, old.test_id);
  else
    select q.test_id into v_test_id
    from public.questions q
    where q.id = coalesce(new.question_id, old.question_id);
  end if;

  if v_test_id is null then
    return coalesce(new, old);
  end if;

  select start_time, approval_status into v_start, v_status
  from public.test where id = v_test_id;
  if v_start is null then
    return coalesce(new, old);
  end if;

  if v_status = 'approved' and now() >= v_start then
    raise exception
      'This test has already started, so its questions can no longer be changed'
      using errcode = 'check_violation';
  end if;

  if v_status in ('pending', 'approved') then
    update public.test set approval_status = 'draft' where id = v_test_id;
  end if;

  return coalesce(new, old);
end $$;

create or replace function public.guard_test_approval()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.approval_status := 'draft';
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status then
    raise exception 'A test can only be approved through the review workflow'
      using errcode = 'insufficient_privilege';
  end if;

  if (to_jsonb(new) - array['created_by', 'updated_at'])
     is distinct from (to_jsonb(old) - array['created_by', 'updated_at']) then
    if old.approval_status = 'approved' and now() >= old.start_time then
      raise exception 'This test has already started, so it can no longer be changed'
        using errcode = 'check_violation';
    end if;
    if old.approval_status in ('pending', 'approved') then
      new.approval_status := 'draft';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists guard_test_approval on public.test;
create trigger guard_test_approval
  before insert or update on public.test
  for each row execute function public.guard_test_approval();

commit;
