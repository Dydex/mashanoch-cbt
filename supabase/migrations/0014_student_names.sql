begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text;

drop table if exists public.student_credentials;

commit;
