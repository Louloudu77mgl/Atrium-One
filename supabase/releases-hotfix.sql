-- AtriumOne · CRM Releases hotfix
-- Idempotent and intentionally isolated from the media/Stories migration.

create extension if not exists pgcrypto;

create or replace function public.is_atriumone_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'louisdacre@gmail.com';
$$;

revoke all on function public.is_atriumone_crm_admin() from public;
grant execute on function public.is_atriumone_crm_admin() to authenticated, service_role;

create table if not exists public.crm_releases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  release_date date not null default current_date,
  version text,
  summary text not null,
  description text not null default '',
  highlights jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  fixes jsonb not null default '[]'::jsonb,
  category text not null default 'Produit',
  status text not null default 'draft' check (status in ('draft', 'published')),
  email_subject text,
  email_intro text,
  published_at timestamptz,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_releases_date_idx
  on public.crm_releases (release_date desc, created_at desc);

create table if not exists public.crm_gmail_connections (
  id text primary key default 'atriumone',
  google_account_id text,
  gmail_address text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  connected_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_release_sends (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.crm_releases(id) on delete cascade,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'partial', 'failed')),
  audience_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_release_recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.crm_release_sends(id) on delete cascade,
  release_id uuid not null references public.crm_releases(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  email text not null,
  business_name text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  gmail_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_release_recipients_send_email_key unique (send_id, email)
);

create index if not exists crm_release_recipients_send_status_idx
  on public.crm_release_recipients (send_id, status, created_at);

alter table public.crm_releases enable row level security;
alter table public.crm_gmail_connections enable row level security;
alter table public.crm_release_sends enable row level security;
alter table public.crm_release_recipients enable row level security;

drop policy if exists crm_releases_admin on public.crm_releases;
drop policy if exists crm_gmail_connections_admin on public.crm_gmail_connections;
drop policy if exists crm_release_sends_admin on public.crm_release_sends;
drop policy if exists crm_release_recipients_admin on public.crm_release_recipients;

create policy crm_releases_admin on public.crm_releases for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_release_sends_admin on public.crm_release_sends for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_release_recipients_admin on public.crm_release_recipients for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());

grant select, insert, update, delete on public.crm_releases, public.crm_release_sends, public.crm_release_recipients to authenticated, service_role;
revoke all on public.crm_gmail_connections from anon, authenticated;
grant select, insert, update, delete on public.crm_gmail_connections to service_role;

create or replace function public.crm_active_release_audience()
returns table (merchant_id uuid, user_id uuid, email text, business_name text)
language sql
security definer
set search_path = public, auth
as $$
  select distinct on (lower(u.email)) m.id, m.user_id, lower(u.email), m.business_name
  from public.business_access access
  join public.merchants m on m.id = access.business_id
  join auth.users u on u.id = m.user_id
  where access.account_enabled = true
    and access.onboarding_status = 'active'
    and u.email is not null
    and lower(u.email) <> 'louisdacre@gmail.com'
  order by lower(u.email), m.created_at desc;
$$;

revoke execute on function public.crm_active_release_audience() from public, anon, authenticated;
grant execute on function public.crm_active_release_audience() to service_role;

notify pgrst, 'reload schema';
