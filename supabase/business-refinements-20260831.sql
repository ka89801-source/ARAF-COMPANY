-- أعراف للأعمال — طلبات التفعيل والتنبيهات البريدية
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
revoke all on table public.business_activation_requests from anon, authenticated;

create table if not exists public.business_email_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null
    check (event_type in ('service_request', 'activation', 'upgrade')),
  reference_id uuid,
  recipient text not null,
  subject text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  provider_id text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists business_email_notifications_status_idx
  on public.business_email_notifications (status, created_at desc);

create index if not exists business_email_notifications_reference_idx
  on public.business_email_notifications (reference_id, event_type);

alter table public.business_email_notifications enable row level security;
revoke all on table public.business_email_notifications from anon, authenticated;

-- الإدخال والتحديث في الجدولين يتمان فقط من API الخادم باستخدام service_role.
commit;
