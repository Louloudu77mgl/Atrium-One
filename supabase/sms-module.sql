create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone text not null,
  email text,
  gender_guess text,
  opt_in_sms boolean not null default false,
  sms_unsubscribed boolean not null default false,
  favorite_products text[] not null default '{}',
  last_purchase_date timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_merchant_phone_key unique (merchant_id, phone)
);

create table if not exists public.customer_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  event_type text not null default 'purchase',
  product_name text,
  amount_cents integer,
  happened_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_campaigns (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null,
  objective text not null,
  audience_label text not null,
  audience_rule jsonb not null default '{}'::jsonb,
  tone text not null default 'chaleureux' check (tone in ('chaleureux', 'premium', 'drôle', 'direct', 'élégant', 'familial')),
  message_template text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent')),
  test_customer_id uuid references public.customers(id) on delete set null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  campaign_id uuid references public.sms_campaigns(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  phone text not null,
  message_text text not null,
  direction text not null default 'outbound' check (direction in ('outbound')),
  status text not null default 'draft' check (status in ('draft', 'test_sent', 'queued', 'sent', 'failed')),
  sms_parts integer not null default 1,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id) on delete cascade,
  name text not null,
  objective text not null,
  tone text not null,
  template_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rcu_forms (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  slug text not null unique,
  form_type text not null default 'points' check (form_type in ('points', 'wheel', 'raffle', 'stamps', 'smart_hans')),
  title text not null,
  incentive_text text not null,
  consent_label text not null,
  cta_label text,
  target_url text,
  is_active boolean not null default true,
  discount_label text,
  discount_value integer,
  promo_prefix text,
  success_message text,
  poster_headline text,
  poster_body text,
  poster_theme text,
  game_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_leads_forms (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.rcu_forms(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  first_name text not null,
  last_name text not null default '',
  phone text not null,
  email text,
  favorite_products text,
  consent_sms boolean not null default true,
  submitted_at timestamptz not null default now()
);

create index if not exists customers_merchant_opt_in_idx on public.customers (merchant_id, opt_in_sms, sms_unsubscribed);
create index if not exists customers_last_purchase_idx on public.customers (merchant_id, last_purchase_date desc);
create index if not exists customer_events_customer_idx on public.customer_events (customer_id, happened_at desc);
create index if not exists sms_campaigns_status_idx on public.sms_campaigns (merchant_id, status, updated_at desc);
create index if not exists sms_messages_campaign_idx on public.sms_messages (campaign_id, created_at desc);
create index if not exists sms_leads_forms_form_idx on public.sms_leads_forms (form_id, submitted_at desc);

alter table public.customers enable row level security;
alter table public.customer_events enable row level security;
alter table public.sms_campaigns enable row level security;
alter table public.sms_messages enable row level security;
alter table public.sms_templates enable row level security;
alter table public.rcu_forms enable row level security;
alter table public.sms_leads_forms enable row level security;

drop policy if exists "Users can read own customers" on public.customers;
create policy "Users can read own customers" on public.customers for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = customers.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own customers" on public.customers;
create policy "Users can write own customers" on public.customers for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = customers.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = customers.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Users can read own customer events" on public.customer_events;
create policy "Users can read own customer events" on public.customer_events for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = customer_events.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own customer events" on public.customer_events;
create policy "Users can write own customer events" on public.customer_events for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = customer_events.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = customer_events.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Users can read own sms campaigns" on public.sms_campaigns;
create policy "Users can read own sms campaigns" on public.sms_campaigns for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_campaigns.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own sms campaigns" on public.sms_campaigns;
create policy "Users can write own sms campaigns" on public.sms_campaigns for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_campaigns.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = sms_campaigns.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Users can read own sms messages" on public.sms_messages;
create policy "Users can read own sms messages" on public.sms_messages for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_messages.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own sms messages" on public.sms_messages;
create policy "Users can write own sms messages" on public.sms_messages for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_messages.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = sms_messages.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Users can read own sms templates" on public.sms_templates;
create policy "Users can read own sms templates" on public.sms_templates for select to authenticated using (
  merchant_id is null or exists (select 1 from public.merchants where merchants.id = sms_templates.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own sms templates" on public.sms_templates;
create policy "Users can write own sms templates" on public.sms_templates for all to authenticated using (
  merchant_id is null or exists (select 1 from public.merchants where merchants.id = sms_templates.merchant_id and merchants.user_id = auth.uid())
) with check (
  merchant_id is null or exists (select 1 from public.merchants where merchants.id = sms_templates.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Users can read own rcu forms" on public.rcu_forms;
create policy "Users can read own rcu forms" on public.rcu_forms for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = rcu_forms.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own rcu forms" on public.rcu_forms;
create policy "Users can write own rcu forms" on public.rcu_forms for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = rcu_forms.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = rcu_forms.merchant_id and merchants.user_id = auth.uid())
);

drop policy if exists "Public can read active rcu forms" on public.rcu_forms;
create policy "Public can read active rcu forms" on public.rcu_forms for select to anon using (is_active = true);

drop policy if exists "Users can read own sms leads" on public.sms_leads_forms;
create policy "Users can read own sms leads" on public.sms_leads_forms for select to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_leads_forms.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Users can write own sms leads" on public.sms_leads_forms;
create policy "Users can write own sms leads" on public.sms_leads_forms for all to authenticated using (
  exists (select 1 from public.merchants where merchants.id = sms_leads_forms.merchant_id and merchants.user_id = auth.uid())
) with check (
  exists (select 1 from public.merchants where merchants.id = sms_leads_forms.merchant_id and merchants.user_id = auth.uid())
);
drop policy if exists "Public can submit sms leads" on public.sms_leads_forms;
create policy "Public can submit sms leads" on public.sms_leads_forms for insert to anon with check (
  exists (select 1 from public.rcu_forms where rcu_forms.id = sms_leads_forms.form_id and rcu_forms.is_active = true and rcu_forms.merchant_id = sms_leads_forms.merchant_id)
);

insert into public.sms_templates (merchant_id, name, objective, tone, template_text)
values
  (null, 'Relance douce', 'Faire revenir un client inactif', 'chaleureux', 'Bonjour {{first_name}} ! Nous pensions à vous chez {{business_name}}. {{personalization}} N’hésitez pas à revenir nous voir 🙂 STOP au 36180'),
  (null, 'Offre premium', 'Inviter un client à une offre spéciale', 'premium', 'Bonjour {{first_name}}, une attention particulière vous attend chez {{business_name}}. {{personalization}} Au plaisir de vous revoir. STOP au 36180'),
  (null, 'Rappel gourmand', 'Faire revenir un client boulangerie', 'familial', 'Bonjour {{first_name}} ! {{personalization}} Passez nous voir cette semaine si le cœur vous en dit 🙂 STOP au 36180')
on conflict do nothing;

do $$
declare
  current_merchant_id uuid;
begin
  select id into current_merchant_id
  from public.merchants
  where user_id = auth.uid()
  limit 1;

  if current_merchant_id is not null then
    insert into public.customers (
      merchant_id, first_name, last_name, phone, gender_guess, opt_in_sms, sms_unsubscribed, favorite_products, last_purchase_date, notes
    ) values
      (current_merchant_id, 'Thomas', 'Bernard', '+33612345678', 'homme probable', true, false, array['coupe mulet'], now() - interval '42 days', 'Coiffeur · apprécie une coupe mulet courte sur les côtés'),
      (current_merchant_id, 'Camille', 'Laurent', '+33622334455', null, true, false, array['pain au chocolat', 'brioche feuilletée'], now() - interval '18 days', 'Boulangerie · passe souvent le dimanche matin'),
      (current_merchant_id, 'Sarah', 'Martin', '+33633445566', null, true, false, array['bouquet pastel'], now() - interval '64 days', 'Fleuriste · achète souvent pour des anniversaires')
    on conflict (merchant_id, phone) do update set
      favorite_products = excluded.favorite_products,
      last_purchase_date = excluded.last_purchase_date,
      notes = excluded.notes,
      updated_at = now();
  end if;
end $$;
