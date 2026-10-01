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
