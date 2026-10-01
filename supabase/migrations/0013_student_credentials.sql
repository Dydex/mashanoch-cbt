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
