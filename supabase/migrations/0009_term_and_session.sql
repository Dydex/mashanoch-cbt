begin;

alter table public.test
  add column if not exists term text,
  add column if not exists session text;

update public.test
   set term = coalesce(term, 'First'),
       session = coalesce(
         session,
         case
           when extract(month from start_time) >= 9
             then extract(year from start_time)::text || '/' ||
                  (extract(year from start_time) + 1)::text
           else (extract(year from start_time) - 1)::text || '/' ||
                extract(year from start_time)::text
         end
       )
 where term is null or session is null;

alter table public.test
  alter column term set not null,
  alter column session set not null;

alter table public.test drop constraint if exists test_term_check;
alter table public.test add constraint test_term_check
  check (term in ('First', 'Second', 'Third'));

alter table public.test drop constraint if exists test_session_check;
alter table public.test add constraint test_session_check
  check (session ~ '^\d{4}/\d{4}$');

create index if not exists test_session_term_idx on public.test (session, term);

commit;
