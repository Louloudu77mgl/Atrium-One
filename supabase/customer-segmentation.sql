-- Segmentation client dynamique AtriumOne
-- Les règles sont stockées, jamais une liste figée de destinataires.

create extension if not exists pgcrypto;

create table if not exists public.customer_segments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  segment_type text not null default 'custom' check (segment_type in ('automatic', 'custom', 'ai')),
  rules jsonb not null default '{"combinator":"AND","rules":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_segments_merchant_updated_idx
  on public.customer_segments (merchant_id, updated_at desc);

-- customer_key permet de relier les préférences aux profils RCU existants.
-- customer_id est prévu pour la table customers lorsqu'elle est utilisée par le commerce.
create table if not exists public.customer_preferences (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  customer_id uuid,
  customer_key text,
  category text not null,
  value text not null,
  source text not null default 'declared' check (source in ('declared', 'inferred', 'purchase', 'manual')),
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id is not null or customer_key is not null)
);

create index if not exists customer_preferences_merchant_customer_key_idx
  on public.customer_preferences (merchant_id, customer_key, category);
create index if not exists customer_preferences_merchant_value_idx
  on public.customer_preferences (merchant_id, category, value);

do $$
begin
  if to_regclass('public.customers') is not null
    and not exists (select 1 from pg_constraint where conname = 'customer_preferences_customer_id_fkey') then
    alter table public.customer_preferences
      add constraint customer_preferences_customer_id_fkey
      foreign key (customer_id) references public.customers(id) on delete cascade;
  end if;
end $$;

alter table public.customer_segments enable row level security;
alter table public.customer_preferences enable row level security;

drop policy if exists "Users can manage own customer segments" on public.customer_segments;
create policy "Users can manage own customer segments" on public.customer_segments
  for all to authenticated
  using (exists (select 1 from public.merchants where merchants.id = customer_segments.merchant_id and merchants.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants where merchants.id = customer_segments.merchant_id and merchants.user_id = auth.uid()));

drop policy if exists "Users can manage own customer preferences" on public.customer_preferences;
create policy "Users can manage own customer preferences" on public.customer_preferences
  for all to authenticated
  using (exists (select 1 from public.merchants where merchants.id = customer_preferences.merchant_id and merchants.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants where merchants.id = customer_preferences.merchant_id and merchants.user_id = auth.uid()));
