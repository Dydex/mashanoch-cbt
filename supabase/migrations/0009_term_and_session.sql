-- Classify tests by term and academic session.
--
-- Until now this lived in the title ("First Term Mathematics"), which cannot
-- be filtered, grouped or validated, and silently fails to group the moment
-- someone types "1st Term Maths".
--
-- Session rather than year: a Nigerian academic session runs across two
-- calendar years (September to July), so a January paper belongs to the
-- session that began the previous September. A plain year cannot express that.

begin;

alter table public.test
  add column if not exists term text,
  add column if not exists session text;

-- Backfill before adding the constraints, so existing rows stay valid.
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

-- e.g. 2026/2027
alter table public.test drop constraint if exists test_session_check;
alter table public.test add constraint test_session_check
  check (session ~ '^\d{4}/\d{4}$');

create index if not exists test_session_term_idx on public.test (session, term);

commit;
