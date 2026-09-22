-- Two changes: when a paper freezes, and where a new account's role comes from.
--
-- 1. The paper froze when an approved test's window opened (0008, 0010). That
--    is earlier than it needs to be: until somebody actually starts, nothing
--    can change underneath anyone. Now it freezes when the first student
--    starts, so a teacher can still fix a live test nobody has begun.
--
-- 2. handle_new_user (0003) read the new account's role from user metadata,
--    which is whatever the signup request supplied. With public signups off
--    that was unreachable; if they were ever switched on, anyone could have
--    signed up as an admin. The role now comes from app metadata, which only
--    the service role can set, and anything else is a student.

begin;

-- ---------------------------------------------------------------
-- 1. Freeze the paper once a student has started
-- ---------------------------------------------------------------

create or replace function public.reject_write_to_started_test()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_test_id uuid;
  v_status  text;
begin
  if TG_TABLE_NAME = 'questions' then
    v_test_id := coalesce(new.test_id, old.test_id);
  else
    select q.test_id into v_test_id
    from public.questions q
    where q.id = coalesce(new.question_id, old.question_id);
  end if;

  -- Parent already gone: this is a cascade from deleting the question or the
  -- whole test, not an edit. Let it through.
  if v_test_id is null then
    return coalesce(new, old);
  end if;

  select approval_status into v_status from public.test where id = v_test_id;
  if v_status is null then
    return coalesce(new, old);
  end if;

  if v_status = 'approved' and exists (
    select 1 from public.submissions s where s.test_id = v_test_id
  ) then
    raise exception
      'A student has already started this test, so its questions can no longer be changed'
      using errcode = 'check_violation';
  end if;

  -- Anything the admin has already seen, or approved, goes back to draft.
  if v_status in ('pending', 'approved') then
    update public.test set approval_status = 'draft' where id = v_test_id;
  end if;

  return coalesce(new, old);
end $$;

create or replace function public.guard_test_approval()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.approval_status := 'draft';
    return new;
  end if;

  if new.approval_status is distinct from old.approval_status then
    raise exception 'A test can only be approved through the review workflow'
      using errcode = 'insufficient_privilege';
  end if;

  -- Handing a test to another owner is not an edit to the paper.
  if (to_jsonb(new) - array['created_by', 'updated_at'])
     is distinct from (to_jsonb(old) - array['created_by', 'updated_at']) then
    if old.approval_status = 'approved' and exists (
      select 1 from public.submissions s where s.test_id = old.id
    ) then
      raise exception 'A student has already started this test, so it can no longer be changed'
        using errcode = 'check_violation';
    end if;
    if old.approval_status in ('pending', 'approved') then
      new.approval_status := 'draft';
    end if;
  end if;

  return new;
end $$;

-- ---------------------------------------------------------------
-- 2. A signup cannot choose its own role
-- ---------------------------------------------------------------
-- raw_user_meta_data is whatever the client sent. raw_app_meta_data can only
-- be set through the admin API, which needs the service role key, so that is
-- where the role is read from. Everything else stays as it was in 0003, plus
-- the name columns added in 0014.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, username, full_name, role, class, first_name, last_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)),
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Unnamed'),
    case
      when new.raw_app_meta_data->>'role' in ('teacher', 'admin')
        then new.raw_app_meta_data->>'role'
      else 'student'
    end,
    nullif(new.raw_user_meta_data->>'class',''),
    nullif(new.raw_user_meta_data->>'first_name',''),
    nullif(new.raw_user_meta_data->>'last_name','')
  )
  on conflict (id) do nothing;
  return new;
end $$;

commit;
