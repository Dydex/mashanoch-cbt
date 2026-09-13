-- Tests need an admin's approval before students can see them.
--
-- Until now a test went live on its window alone: once start_time passed,
-- every student in the class could open it. Now it must also be approved.
--
--   draft              being written. The default for every new test.
--   pending            its teacher has submitted it; waiting on an admin
--   changes_requested  an admin sent it back with a note
--   approved           students may sit it while its window is open
--
-- Any change to a pending or approved test sends it back to draft, so what an
-- admin approved is always what students get. test_reviews keeps the
-- conversation: submissions, decisions and comments, oldest first.
--
-- Only server code (the service role) moves a test between these states. A
-- signed-in client can write the test table directly through the API, so a
-- trigger stops a teacher approving their own test that way.

begin;

-- ---------------------------------------------------------------
-- 1. Approval status
-- ---------------------------------------------------------------

-- Tests that already exist were published under the old rules. Adding the
-- column with 'approved' backfills them, so nothing scheduled or live
-- disappears from students; new tests then default to draft.
alter table public.test
  add column if not exists approval_status text not null default 'approved';
alter table public.test
  alter column approval_status set default 'draft';

alter table public.test drop constraint if exists test_approval_status_check;
alter table public.test add constraint test_approval_status_check
  check (approval_status in ('draft', 'pending', 'changes_requested', 'approved'));

create index if not exists test_approval_status_idx on public.test (approval_status);

-- ---------------------------------------------------------------
-- 2. Review thread
-- ---------------------------------------------------------------

create table if not exists public.test_reviews (
  id         uuid primary key default gen_random_uuid(),
  test_id    uuid not null references public.test (id) on delete cascade,
  -- Kept when the author's account is removed; the entry just loses its name.
  author_id  uuid references public.profiles (id) on delete set null,
  kind       text not null
    check (kind in ('submitted', 'approved', 'changes_requested', 'comment')),
  body       text check (length(body) <= 2000),
  created_at timestamptz not null default now(),
  -- A comment or a request for changes is nothing without its note.
  constraint test_reviews_body_required
    check (kind in ('submitted', 'approved') or length(btrim(coalesce(body, ''))) > 0)
);

create index if not exists test_reviews_test_idx   on public.test_reviews (test_id, created_at);
create index if not exists test_reviews_author_idx on public.test_reviews (author_id);

alter table public.test_reviews enable row level security;

-- Readable by the test's owner and by admins. Written only by server code.
drop policy if exists "test_reviews_select_owner" on public.test_reviews;
create policy "test_reviews_select_owner" on public.test_reviews for select
  using (public.owns_test(test_id));

revoke all on public.test_reviews from anon, authenticated;
grant select on public.test_reviews to authenticated;
grant all on public.test_reviews to service_role;

-- ---------------------------------------------------------------
-- 3. Students only ever see approved tests
-- ---------------------------------------------------------------

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

-- start_test and can_write_answer are SECURITY DEFINER, so the policies above
-- do not reach them. Each gets the same check.

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

-- ---------------------------------------------------------------
-- 4. The paper freezes when an APPROVED test opens
-- ---------------------------------------------------------------
-- 0008 froze questions at start_time. Only an approved test can have been
-- sat, though, and an unapproved one may pass its start time while an admin
-- is still reviewing it. Its teacher must still be able to fix it, so the
-- freeze now applies to approved tests only.
--
-- Any other change to a pending or approved paper sends the test back to
-- draft. The triggers on questions and question_options from 0008 stay
-- attached; only the function behind them changes.

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

  -- Parent already gone: this is a cascade from deleting the question or the
  -- whole test, not an edit. Let it through.
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

-- ---------------------------------------------------------------
-- 5. Clients cannot approve tests
-- ---------------------------------------------------------------
-- test_insert_staff and test_update_owner let a teacher write this table with
-- their own token. Without this trigger, one PATCH could set approval_status
-- to 'approved'. Server code runs as service_role, and the trigger in section
-- 4 runs as the table owner. Both are trusted and pass straight through.

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

  -- Handing a test to another owner is not an edit to the paper.
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
