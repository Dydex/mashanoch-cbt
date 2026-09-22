-- Students' first and last names, with the surname as their password.
--
-- The school wants students to sign in with their admission number and their
-- surname. Keeping first and last name in their own columns is what lets the
-- password be derived, and login slips be printed at any time, without
-- guessing where a full name splits.
--
-- It also makes 0013's readable copy of generated passwords unnecessary:
-- there are no generated passwords any more. That table was only ever empty,
-- so it goes.
--
-- full_name stays, and stays what the rest of the app reads. For students it
-- is "<first> <last>"; staff keep theirs as before, with these columns null.

begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

drop table if exists public.student_credentials;

commit;
