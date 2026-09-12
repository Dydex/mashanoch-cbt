-- exam_options must run with owner rights (students have no grant on the base
-- table, by design), so the row filter that RLS would have applied has to live
-- inside the view. security_barrier stops a cheap function in a user-supplied
-- WHERE clause from being evaluated before this filter.

begin;

drop view if exists public.exam_options;

create view public.exam_options
  with (security_barrier = true) as
  select o.id, o.question_id, o.option_text, o.created_at
  from public.question_options o
  join public.questions q on q.id = o.question_id
  join public.test t      on t.id = q.test_id
  where (
        public.my_role() = 'student'
    and t.class = public.my_class()
    and now() >= t.start_time
    and now() <= t.end_time
  )
  or public.owns_test(t.id);

grant select on public.exam_options to authenticated;

commit;
