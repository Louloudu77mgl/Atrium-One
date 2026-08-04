create extension if not exists pgcrypto;

create table if not exists public.rcu_records (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  record_type text not null default 'game_play',
  program_id text not null,
  customer_key text not null,
  public_token text not null unique,
  visit_day date not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

drop index if exists public.rcu_records_one_play_per_day_idx;
create unique index rcu_records_one_play_per_day_idx
  on public.rcu_records (merchant_id, program_id, customer_key, visit_day)
  where record_type = 'game_play';

create unique index if not exists rcu_records_one_raffle_draw_idx
  on public.rcu_records (merchant_id, program_id, ((payload->>'raffle_month')))
  where record_type = 'raffle_draw';

create index if not exists rcu_records_customer_timeline_idx
  on public.rcu_records (merchant_id, customer_key, occurred_at desc);

alter table public.rcu_records enable row level security;

drop policy if exists "Merchants can read their RCU records" on public.rcu_records;
create policy "Merchants can read their RCU records"
  on public.rcu_records for select
  using (
    exists (
      select 1 from public.merchants
      where merchants.id = rcu_records.merchant_id
        and merchants.user_id = auth.uid()
    )
  );

drop policy if exists "Merchants can manage their RCU records" on public.rcu_records;
create policy "Merchants can manage their RCU records"
  on public.rcu_records for all
  using (
    exists (
      select 1 from public.merchants
      where merchants.id = rcu_records.merchant_id
        and merchants.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.merchants
      where merchants.id = rcu_records.merchant_id
        and merchants.user_id = auth.uid()
    )
  );
