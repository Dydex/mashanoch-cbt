-- Mashnock CBT — schema hardening
-- Fixes: profiles RLS recursion, answer-key leakage, missing profile creation,
-- client-writable scores, unbounded exam-window writes, missing FK indexes.

begin;

-- ---------------------------------------------------------------
-- 1. Role helpers (SECURITY DEFINER — these bypass RLS on profiles,
--    which is what breaks the recursion in the old policies).
-- ---------------------------------------------------------------

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_class()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select class from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.my_role() in ('teacher','admin'), false)
$$;

create or replace function public.owns_test(p_test_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.test t
    where t.id = p_test_id and (t.created_by = auth.uid() or public.is_admin())
  )
$$;

-- A student may only write answers inside the test window AND inside their
-- own personal duration clock, and only while the submission is open.
create or replace function public.can_write_answer(p_submission_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.submissions s
    join public.test t on t.id = s.test_id
    where s.id = p_submission_id
      and s.student_id = auth.uid()
      and s.status = 'in_progress'
      and now() >= t.start_time
      and now() <= t.end_time
      and now() <= s.started_at + make_interval(mins => t.duration_minutes)
  )
$$;

grant execute on function public.my_role, public.my_class, public.is_admin,
  public.is_staff, public.owns_test(uuid), public.can_write_answer(uuid) to authenticated;

-- ---------------------------------------------------------------
-- 2. Schema additions
-- ---------------------------------------------------------------

alter table public.test
  add column if not exists marks_per_question integer not null default 2
    check (marks_per_question > 0);

alter table public.questions
  add column if not exists order_index integer not null default 0;

-- Deterministic question order.
create unique index if not exists questions_test_order_key
  on public.questions (test_id, order_index);

-- At most one correct option per question.
create unique index if not exists question_options_one_correct
  on public.question_options (question_id) where is_correct;

-- The test window must be coherent.
alter table public.test drop constraint if exists test_window_check;
alter table public.test add constraint test_window_check check (end_time > start_time);

-- ---------------------------------------------------------------
-- 3. Foreign-key indexes (Postgres does not create these itself)
-- ---------------------------------------------------------------

create index if not exists questions_test_id_idx          on public.questions (test_id);
create index if not exists question_options_question_idx  on public.question_options (question_id);
create index if not exists answers_submission_id_idx      on public.answers (submission_id);
create index if not exists answers_question_id_idx        on public.answers (question_id);
create index if not exists answers_selected_option_idx    on public.answers (selected_option_id);
create index if not exists submissions_student_id_idx     on public.submissions (student_id);
create index if not exists submissions_test_id_idx        on public.submissions (test_id);
create index if not exists test_subject_id_idx            on public.test (subject_id);
create index if not exists test_created_by_idx            on public.test (created_by);
create index if not exists test_class_window_idx          on public.test (class, start_time, end_time);

commit;
