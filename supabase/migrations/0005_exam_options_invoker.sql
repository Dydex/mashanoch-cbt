-- Replace the SECURITY DEFINER view (flagged Critical by the Supabase linter)
-- with column-level grants + an invoker-rights view.
--
-- is_correct is simply never granted to any client role, so it cannot be
-- selected even from the base table. Row filtering goes back to the existing
-- RLS policies on question_options — one source of truth, no duplicated
-- predicate inside a view definition.

begin;

grant select (id, question_id, option_text, created_at)
  on public.question_options to authenticated;

drop view if exists public.exam_options;

create view public.exam_options
  with (security_invoker = true) as
  select id, question_id, option_text, created_at
  from public.question_options;

grant select on public.exam_options to authenticated;

commit;
