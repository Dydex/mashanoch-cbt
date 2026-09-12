-- Once a test has commenced, its paper is frozen.
--
-- Enforced with a trigger rather than RLS on purpose: the teacher UI writes
-- questions and options through the SERVICE ROLE (it must, because
-- `authenticated` has no grant on question_options.is_correct), and the service
-- role bypasses every RLS policy. A trigger is the only guard that still holds
-- on that path.
--
-- "Commenced" means now() >= test.start_time. Before that a teacher may edit
-- freely; from the moment the window opens the questions are fixed, so no
-- student can have the paper change underneath them mid-exam.

begin;

create or replace function public.reject_write_to_started_test()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_test_id uuid;
  v_start   timestamptz;
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

  select start_time into v_start from public.test where id = v_test_id;
  if v_start is null then
    return coalesce(new, old);
  end if;

  if now() >= v_start then
    raise exception
      'This test has already started, so its questions can no longer be changed'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists lock_questions_after_start on public.questions;
create trigger lock_questions_after_start
  before insert or update or delete on public.questions
  for each row execute function public.reject_write_to_started_test();

drop trigger if exists lock_options_after_start on public.question_options;
create trigger lock_options_after_start
  before insert or update or delete on public.question_options
  for each row execute function public.reject_write_to_started_test();

commit;
