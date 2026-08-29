-- AtriumOne internal commercial CRM and progressive account activation.
-- Idempotent: safe to run again. Existing merchants are explicitly kept active.

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

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.merchants(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  business_type text,
  address text,
  city text,
  postal_code text,
  phone text,
  email text,
  email_source text not null default 'unavailable' check (email_source in ('website', 'manual', 'unavailable', 'account')),
  website text,
  google_place_id text,
  google_maps_url text,
  google_rating numeric(2,1) check (google_rating is null or google_rating between 0 and 5),
  google_reviews_count integer check (google_reviews_count is null or google_reviews_count >= 0),
  google_profile_created_at timestamptz,
  latitude double precision,
  longitude double precision,
  google_business_status text,
  lead_source text not null default 'Manuel' check (lead_source in ('Google Prospection', 'Inscription site', 'Manuel', 'Recommandation', 'Import', 'Autre')),
  commercial_status text not null default 'Nouveau' check (commercial_status in ('Nouveau', 'À appeler', 'Appelé', 'Contacté', 'À relancer', 'RDV pris', 'Démo réalisée', 'Test AtriumOne', 'Proposition envoyée', 'En négociation', 'Signé', 'Perdu', 'À revoir plus tard')),
  signed_at date,
  signed_offer text,
  monthly_value numeric(12,2),
  mrr numeric(12,2),
  contract_started_at date,
  signed_comment text,
  lost_at date,
  lost_reason text check (lost_reason is null or lost_reason in ('Trop cher', 'Pas intéressé', 'Déjà équipé', 'Pas le bon moment', 'Pas de réponse', 'Mauvaise cible', 'Projet reporté', 'Autre')),
  lost_comment text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_leads_business_id_key unique (business_id),
  constraint crm_leads_auth_user_id_key unique (auth_user_id)
);

create unique index if not exists crm_leads_google_place_id_unique
  on public.crm_leads (google_place_id) where google_place_id is not null;
create index if not exists crm_leads_active_created_idx on public.crm_leads (archived_at, deleted_at, created_at desc);
create index if not exists crm_leads_city_idx on public.crm_leads (lower(city));
create index if not exists crm_leads_status_idx on public.crm_leads (commercial_status);
create index if not exists crm_leads_email_idx on public.crm_leads (lower(email)) where email is not null;
create index if not exists crm_leads_phone_idx on public.crm_leads (regexp_replace(phone, '[^0-9+]', '', 'g')) where phone is not null;

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 10000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'Autre' check (type in ('Appel', 'Relance', 'Email', 'RDV', 'Démo', 'Closing', 'Suivi', 'Autre')),
  due_date date not null,
  due_time time,
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_tasks_due_idx on public.crm_tasks (due_date, due_time) where completed = false;

create table if not exists public.crm_appointments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  title text not null default 'Rendez-vous',
  type text not null default 'RDV commercial' check (type in ('Premier échange', 'Démo AtriumOne', 'Onboarding', 'RDV commercial', 'Follow-up', 'Closing', 'Autre')),
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 1440),
  notes text,
  result text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_appointments_date_idx on public.crm_appointments (appointment_date, appointment_time);

create table if not exists public.crm_searches (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  business_type text not null,
  query text not null,
  result_count integer not null default 0,
  imported_count integer not null default 0,
  results jsonb not null default '[]'::jsonb,
  next_page_token text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activity (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists crm_activity_lead_created_idx on public.crm_activity (lead_id, created_at desc);

create table if not exists public.business_access (
  business_id uuid primary key references public.merchants(id) on delete cascade,
  account_enabled boolean not null default false,
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'active', 'suspended')),
  signup_source text not null default 'site',
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  disabled_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.business_module_access (
  business_id uuid not null references public.merchants(id) on delete cascade,
  module_key text not null check (module_key in ('reviews', 'instagram', 'hans', 'automations', 'emailing', 'rcu', 'customers', 'insights')),
  enabled boolean not null default false,
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (business_id, module_key)
);

create or replace function public.set_crm_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare target_table text;
begin
  foreach target_table in array array['crm_leads', 'crm_notes', 'crm_tasks', 'crm_appointments', 'crm_searches', 'business_access', 'business_module_access']
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', target_table, target_table);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_crm_updated_at()', target_table, target_table);
  end loop;
end $$;

create or replace function public.initialize_atriumone_merchant_access()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account_email text;
  matched_lead_id uuid;
begin
  select lower(email) into account_email from auth.users where id = new.user_id;

  insert into public.business_access (business_id, account_enabled, onboarding_status, signup_source)
  values (new.id, false, 'pending', 'site')
  on conflict (business_id) do nothing;

  insert into public.business_module_access (business_id, module_key, enabled)
  select new.id, key, false
  from unnest(array['reviews', 'instagram', 'hans', 'automations', 'emailing', 'rcu', 'customers', 'insights']) as key
  on conflict (business_id, module_key) do nothing;

  if account_email is not null then
    select id into matched_lead_id
    from public.crm_leads
    where auth_user_id is null and business_id is null and lower(email) = account_email and deleted_at is null
    order by created_at desc
    limit 1;
  end if;

  if matched_lead_id is not null then
    update public.crm_leads
    set business_id = new.id,
        auth_user_id = new.user_id,
        name = coalesce(nullif(name, ''), new.business_name),
        business_type = coalesce(business_type, new.business_type),
        city = coalesce(city, new.city),
        phone = coalesce(phone, new.phone),
        website = coalesce(website, new.website_url),
        email_source = 'account',
        updated_at = now()
    where id = matched_lead_id;
  else
    insert into public.crm_leads (business_id, auth_user_id, name, business_type, city, phone, email, email_source, website, lead_source)
    values (new.id, new.user_id, new.business_name, new.business_type, new.city, new.phone, account_email, case when account_email is null then 'unavailable' else 'account' end, new.website_url, 'Inscription site')
    on conflict (auth_user_id) do update
    set business_id = excluded.business_id,
        name = excluded.name,
        business_type = excluded.business_type,
        city = excluded.city,
        phone = coalesce(public.crm_leads.phone, excluded.phone),
        email = coalesce(public.crm_leads.email, excluded.email),
        email_source = 'account',
        website = coalesce(public.crm_leads.website, excluded.website),
        updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.capture_new_atriumone_signup()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  signup_name text;
  matched_lead_id uuid;
begin
  if lower(coalesce(new.email, '')) = 'louisdacre@gmail.com' then
    return new;
  end if;
  signup_name := coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1), 'Nouveau compte AtriumOne');
  select id into matched_lead_id
  from public.crm_leads
  where auth_user_id is null and business_id is null and lower(email) = lower(new.email) and deleted_at is null
  order by created_at desc
  limit 1;
  if matched_lead_id is not null then
    update public.crm_leads
    set auth_user_id = new.id, email_source = 'account', updated_at = now()
    where id = matched_lead_id;
  else
    insert into public.crm_leads (auth_user_id, name, email, email_source, lead_source, commercial_status)
    values (new.id, signup_name, lower(new.email), 'account', 'Inscription site', 'Nouveau')
    on conflict (auth_user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_new_atriumone_signup on auth.users;
create trigger capture_new_atriumone_signup
after insert on auth.users
for each row execute function public.capture_new_atriumone_signup();

drop trigger if exists initialize_atriumone_merchant_access on public.merchants;
create trigger initialize_atriumone_merchant_access
after insert on public.merchants
for each row execute function public.initialize_atriumone_merchant_access();

create or replace function public.backfill_existing_merchants_to_crm()
returns table (business_id uuid, lead_id uuid, account_enabled boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.business_access (business_id, account_enabled, onboarding_status, signup_source, enabled_at)
  select m.id, true, 'active', 'existing_backfill', coalesce(m.created_at, now())
  from public.merchants m
  on conflict on constraint business_access_pkey do nothing;

  insert into public.business_module_access (business_id, module_key, enabled, enabled_at)
  select m.id, key, true, coalesce(m.created_at, now())
  from public.merchants m
  cross join unnest(array['reviews', 'instagram', 'hans', 'automations', 'emailing', 'rcu', 'customers', 'insights']) as key
  on conflict on constraint business_module_access_pkey do nothing;

  insert into public.crm_leads (business_id, auth_user_id, name, business_type, city, phone, email, email_source, website, lead_source, created_at)
  select m.id, m.user_id, m.business_name, m.business_type, m.city, m.phone, lower(u.email), 'account', m.website_url, 'Import', m.created_at
  from public.merchants m
  left join auth.users u on u.id = m.user_id
  on conflict on constraint crm_leads_business_id_key do update
  set auth_user_id = excluded.auth_user_id,
      email = coalesce(public.crm_leads.email, excluded.email),
      updated_at = now();

  return query
  select m.id, l.id, a.account_enabled
  from public.merchants m
  join public.crm_leads l on l.business_id = m.id
  join public.business_access a on a.business_id = m.id
  order by m.created_at;
end;
$$;

-- Run the idempotent backfill now. It can also be called later with:
-- select * from public.backfill_existing_merchants_to_crm();
select * from public.backfill_existing_merchants_to_crm();

create or replace function public.log_crm_activity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_lead_id uuid;
  event_type text;
  details jsonb;
begin
  if tg_table_name = 'crm_notes' then
    target_lead_id := coalesce(new.lead_id, old.lead_id);
    event_type := case tg_op when 'INSERT' then 'note_added' when 'UPDATE' then 'note_updated' else 'note_deleted' end;
    details := jsonb_build_object('note_id', coalesce(new.id, old.id));
  elsif tg_table_name = 'crm_tasks' then
    target_lead_id := coalesce(new.lead_id, old.lead_id);
    event_type := case when tg_op = 'DELETE' then 'task_deleted' when tg_op = 'INSERT' then 'task_created' when new.completed and not old.completed then 'task_completed' else 'task_updated' end;
    details := jsonb_build_object('task_id', coalesce(new.id, old.id), 'title', coalesce(new.title, old.title));
  elsif tg_table_name = 'crm_appointments' then
    target_lead_id := coalesce(new.lead_id, old.lead_id);
    event_type := case tg_op when 'INSERT' then 'appointment_created' when 'UPDATE' then 'appointment_updated' else 'appointment_deleted' end;
    details := jsonb_build_object('appointment_id', coalesce(new.id, old.id), 'title', coalesce(new.title, old.title));
  elsif tg_table_name = 'crm_leads' then
    target_lead_id := new.id;
    if tg_op = 'INSERT' then
      event_type := 'lead_created';
      details := jsonb_build_object('source', new.lead_source);
    elsif new.commercial_status is distinct from old.commercial_status then
      event_type := 'status_changed';
      details := jsonb_build_object('from', old.commercial_status, 'to', new.commercial_status);
    else
      return new;
    end if;
  end if;

  insert into public.crm_activity (lead_id, type, metadata, created_by)
  values (target_lead_id, event_type, details, auth.uid());
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists log_crm_lead_activity on public.crm_leads;
create trigger log_crm_lead_activity after insert or update on public.crm_leads for each row execute function public.log_crm_activity();
drop trigger if exists log_crm_note_activity on public.crm_notes;
create trigger log_crm_note_activity after insert or update or delete on public.crm_notes for each row execute function public.log_crm_activity();
drop trigger if exists log_crm_task_activity on public.crm_tasks;
create trigger log_crm_task_activity after insert or update or delete on public.crm_tasks for each row execute function public.log_crm_activity();
drop trigger if exists log_crm_appointment_activity on public.crm_appointments;
create trigger log_crm_appointment_activity after insert or update or delete on public.crm_appointments for each row execute function public.log_crm_activity();

alter table public.crm_leads enable row level security;
alter table public.crm_notes enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.crm_appointments enable row level security;
alter table public.crm_searches enable row level security;
alter table public.crm_activity enable row level security;
alter table public.business_access enable row level security;
alter table public.business_module_access enable row level security;

do $$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array['crm_leads', 'crm_notes', 'crm_tasks', 'crm_appointments', 'crm_searches', 'crm_activity', 'business_access', 'business_module_access']
  loop
    for policy_record in select policyname from pg_policies where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
    end loop;
  end loop;
end $$;

create policy crm_admin_leads_all on public.crm_leads for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_admin_notes_all on public.crm_notes for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_admin_tasks_all on public.crm_tasks for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_admin_appointments_all on public.crm_appointments for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_admin_searches_all on public.crm_searches for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy crm_admin_activity_all on public.crm_activity for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());

create policy business_access_admin_all on public.business_access for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy business_access_owner_read on public.business_access for select to authenticated
  using (exists (select 1 from public.merchants m where m.id = business_access.business_id and m.user_id = auth.uid()));
create policy module_access_admin_all on public.business_module_access for all to authenticated
  using (public.is_atriumone_crm_admin()) with check (public.is_atriumone_crm_admin());
create policy module_access_owner_read on public.business_module_access for select to authenticated
  using (exists (select 1 from public.merchants m where m.id = business_module_access.business_id and m.user_id = auth.uid()));

-- A restrictive policy is AND-ed with every existing merchant policy. This prevents
-- the CRM identity from using its historical merchant row through direct Supabase calls.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'merchants', 'reviews', 'generated_replies', 'google_connections', 'instagram_connections', 'gmail_connections',
    'hans_recommendations', 'notifications', 'review_insights', 'social_post_ideas', 'social_posts', 'design_templates', 'media_assets',
    'merchant_brand_settings', 'merchant_automation_settings', 'generated_visuals', 'merchant_media_assets',
    'customers', 'customer_events', 'customer_segments', 'customer_preferences', 'sms_campaigns', 'sms_messages',
    'sms_templates', 'rcu_forms', 'rcu_records', 'sms_leads_forms', 'email_campaigns', 'email_recipients',
    'automation_flows', 'automation_execution_logs'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('drop policy if exists crm_admin_classic_app_isolation on public.%I', target_table);
      execute format('create policy crm_admin_classic_app_isolation on public.%I as restrictive for all to authenticated using (not public.is_atriumone_crm_admin()) with check (not public.is_atriumone_crm_admin())', target_table);
    end if;
  end loop;
end $$;

grant select, insert, update, delete on public.crm_leads, public.crm_notes, public.crm_tasks, public.crm_appointments, public.crm_searches, public.crm_activity to authenticated, service_role;
grant select, insert, update, delete on public.business_access, public.business_module_access to authenticated, service_role;
grant execute on function public.backfill_existing_merchants_to_crm() to service_role;
revoke execute on function public.backfill_existing_merchants_to_crm() from anon, authenticated;
