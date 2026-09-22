-- Student passwords that admins can read again.
--
-- Students sign in with their matric number and a password the school
-- generates. Supabase Auth keeps only a hash of it, so until now a password
-- could be shown once, when it was issued, and never again. The school wants
-- to reprint every student's login details before each test, so a copy of
-- each student's current password is kept here.
--
-- That is a deliberate trade: anyone with admin access to the app, or the
-- service role key, can read these. Only students' generated passwords are
-- kept. Staff choose their own, and those live nowhere but Auth.
--
-- No client role can touch this table. RLS is on with no policies, and anon
-- and authenticated hold no grants. The app reads and writes it only from
-- server code, with the service role.

begin;

create table if not exists public.student_credentials (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  password   text not null,
  updated_at timestamptz not null default now()
);

alter table public.student_credentials enable row level security;

revoke all on public.student_credentials from anon, authenticated;
grant all on public.student_credentials to service_role;

commit;
