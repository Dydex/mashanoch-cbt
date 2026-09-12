-- Client-side upsert into answers cannot work, and should not be made to work.
--
-- PostgREST turns .upsert() into INSERT ... ON CONFLICT DO UPDATE, which needs
-- UPDATE privilege on every column in the statement. `authenticated` holds
-- UPDATE on selected_option_id only -- deliberately, so a student cannot move
-- an answer onto someone else's submission. Widening the grant to make upsert
-- work would give that away.
--
-- So the write goes through this function instead. It also closes a gap the
-- raw table write left open: nothing previously stopped a student storing an
-- option belonging to a DIFFERENT question.

begin;

create or replace function public.save_answer(
  p_submission_id uuid,
  p_question_id   uuid,
  p_option_id     uuid
)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- Owns the submission, still in progress, inside both the exam window and
  -- their personal duration clock.
  if not public.can_write_answer(p_submission_id) then
    raise exception 'This test is not open for you';
  end if;

  -- The question must belong to the test this submission is for.
  if not exists (
    select 1
    from public.submissions s
    join public.questions q on q.test_id = s.test_id
    where s.id = p_submission_id and q.id = p_question_id
  ) then
    raise exception 'That question is not part of this test';
  end if;

  -- The option must belong to that question.
  if p_option_id is not null and not exists (
    select 1 from public.question_options o
    where o.id = p_option_id and o.question_id = p_question_id
  ) then
    raise exception 'That option is not part of this question';
  end if;

  insert into public.answers (submission_id, question_id, selected_option_id)
  values (p_submission_id, p_question_id, p_option_id)
  on conflict (submission_id, question_id)
  do update set selected_option_id = excluded.selected_option_id;
end $$;

grant execute on function public.save_answer(uuid, uuid, uuid) to authenticated;

commit;
