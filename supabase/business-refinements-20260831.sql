-- أعراف للأعمال — طلبات التفعيل والترقية
-- شغّل هذا الملف مرة واحدة في Supabase SQL Editor.

begin;

create table if not exists public.business_activation_requests (
  id uuid primary key default gen_random_uuid(),
  request_kind text not null default 'activation'
    check (request_kind in ('activation', 'upgrade')),
  entity_name text not null,
  entity_type text,
  entity_code text,
  contact_details text,
  current_plan text,
  requested_plan text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'activated', 'closed')),
  source text not null default 'business_site',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_activation_requests_created_at_idx
  on public.business_activation_requests (created_at desc);

create index if not exists business_activation_requests_status_idx
  on public.business_activation_requests (status, created_at desc);

alter table public.business_activation_requests enable row level security;

-- لا يُسمح للواجهة العامة بالقراءة أو الكتابة المباشرة.
-- الإدخال يتم فقط من API الخادم باستخدام service_role.
revoke all on table public.business_activation_requests from anon, authenticated;

commit;
