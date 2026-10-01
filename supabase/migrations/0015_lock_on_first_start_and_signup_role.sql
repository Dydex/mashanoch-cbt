begin;

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
