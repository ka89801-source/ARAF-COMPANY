-- أعراف للأعمال — إدارة تفعيل المنشآت من منصة araf-ops
-- لا يلمس هذا الملف جداول أو سياسات منصة الأفراد.

begin;

-- تبقى contact_details للتوافق مع الطلبات القديمة، وتضاف الحقول المنفصلة
-- حتى تظهر بيانات المسؤول بوضوح في منصة الإدارة.
alter table public.business_activation_requests
  add column if not exists contact_name text,
  add column if not exists contact_phone text;

update public.business_activation_requests
set
  contact_name = coalesce(
    nullif(contact_name, ''),
    nullif(trim(split_part(contact_details, '—', 1)), '')
  ),
  contact_phone = coalesce(
    nullif(contact_phone, ''),
    nullif(trim(split_part(contact_details, '—', 2)), '')
  )
where contact_details like '%—%'
  and (contact_name is null or contact_phone is null);

-- تثبيت صلاحية قراءة ملف الإدارة لصاحب الحساب نفسه.
alter table public.business_admins enable row level security;
grant select on public.business_admins to authenticated;

do $do$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_admins'
      and policyname = 'business_admins_read'
  ) then
    execute $policy$
      create policy business_admins_read
        on public.business_admins
        for select
        to authenticated
        using (
          auth_user_id = auth.uid()
          or public.business_is_admin()
        )
    $policy$;
  end if;
end
$do$;

-- إتمام إنشاء المنشأة وتحديث طلب التفعيل في معاملة واحدة.
-- إنشاء مستخدم Auth يتم من API الخادم قبل استدعاء هذه الدالة؛ وإذا فشلت
-- المعاملة يحذف الخادم مستخدم Auth الذي أنشأه، فلا يبقى حساب ناقص.
create or replace function public.business_commit_activation(
  p_request_id uuid,
  p_auth_user_id uuid,
  p_entity_code text,
  p_plan_key text,
  p_entity_type text,
  p_subscription_start date,
  p_cycle_end date,
  p_actor_user_id uuid,
  p_actor_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.business_activation_requests%rowtype;
  v_entity public.business_entities%rowtype;
  v_plan_name text;
  v_now timestamptz := now();
begin
  select *
  into v_request
  from public.business_activation_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'ACTIVATION_REQUEST_NOT_FOUND';
  end if;

  if v_request.request_kind <> 'activation' then
    raise exception 'ACTIVATION_REQUEST_KIND_INVALID';
  end if;

  if v_request.status not in ('new', 'contacted') then
    raise exception 'ACTIVATION_REQUEST_ALREADY_DECIDED';
  end if;

  select name
  into v_plan_name
  from public.business_plans
  where plan_key = p_plan_key
    and active = true;

  if v_plan_name is null then
    raise exception 'ACTIVATION_PLAN_INVALID';
  end if;

  if p_entity_code !~ '^ARF-[0-9]{4,8}$' then
    raise exception 'ACTIVATION_ENTITY_CODE_INVALID';
  end if;

  insert into public.business_entities (
    auth_user_id,
    code,
    name,
    entity_type,
    plan_key,
    subscription_status,
    subscription_start,
    subscription_end,
    current_cycle_start,
    current_cycle_end,
    manager_name,
    manager_title,
    manager_phone,
    manager_hours
  )
  values (
    p_auth_user_id,
    upper(p_entity_code),
    v_request.entity_name,
    p_entity_type,
    p_plan_key,
    'active',
    p_subscription_start,
    null,
    p_subscription_start,
    p_cycle_end,
    null,
    null,
    null,
    null
  )
  returning * into v_entity;

  update public.business_activation_requests
  set
    entity_code = v_entity.code,
    requested_plan = p_plan_key,
    status = 'activated',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'activated_at', v_now,
      'activated_by_user_id', p_actor_user_id,
      'activated_by_name', coalesce(nullif(trim(p_actor_name), ''), 'إدارة أعراف'),
      'activated_entity_id', v_entity.id,
      'activated_entity_code', v_entity.code,
      'activated_plan_key', p_plan_key
    ),
    updated_at = v_now
  where id = v_request.id
  returning * into v_request;

  return jsonb_build_object(
    'request', to_jsonb(v_request),
    'entity', to_jsonb(v_entity),
    'plan_name', v_plan_name
  );
end;
$$;

revoke all on function public.business_commit_activation(
  uuid, uuid, text, text, text, date, date, uuid, text
) from public, anon, authenticated;

grant execute on function public.business_commit_activation(
  uuid, uuid, text, text, text, date, date, uuid, text
) to service_role;

-- ربط حساب المالك تلقائيًا إذا كان قد أُنشئ في Supabase Auth.
-- لا تُنشئ هذه الفقرة مستخدمًا جديدًا ولا تحفظ أي كلمة مرور.
insert into public.business_admins as existing (
  auth_user_id,
  employee_external_id,
  display_name,
  admin_role,
  active
)
select
  u.id,
  e.id,
  coalesce(nullif(e.full_name, ''), 'إدارة أعراف'),
  'admin',
  true
from auth.users u
left join public.employees e
  on lower(e.email) = lower(u.email)
where lower(u.email) = 'ka89801@gmail.com'
on conflict (auth_user_id) do update
set
  employee_external_id = coalesce(
    existing.employee_external_id,
    excluded.employee_external_id
  ),
  display_name = excluded.display_name,
  active = true;

commit;
