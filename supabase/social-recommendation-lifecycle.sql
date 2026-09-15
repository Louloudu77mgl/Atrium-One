-- Cycle de vie idempotent des recommandations Instagram Hans et exécution
-- hebdomadaire de la recette « Nouvelle semaine ».

create table if not exists public.social_recommendation_usages (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  theme_key text not null,
  source_type text not null check (source_type in ('positive_review', 'negative_review', 'local_event', 'calendar', 'editorial')),
  source_label text not null,
  recommendation_title text not null,
  event_date date,
  status text not null default 'reserved' check (status in ('reserved', 'used', 'scheduled', 'published')),
  reservation_token uuid not null,
  social_post_id uuid references public.social_posts(id) on delete set null,
  reserved_at timestamptz not null default now(),
  used_at timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint social_recommendation_usages_merchant_theme_key unique (merchant_id, theme_key),
  constraint social_recommendation_usages_social_post_id_key unique (social_post_id)
);

create index if not exists social_recommendation_usages_merchant_status_idx
  on public.social_recommendation_usages (merchant_id, status, updated_at desc);

create table if not exists public.social_automation_weekly_runs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  week_start date not null,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  run_token uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  created_posts integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint social_automation_weekly_runs_merchant_week_key unique (merchant_id, week_start)
);

create index if not exists social_automation_weekly_runs_status_idx
  on public.social_automation_weekly_runs (status, started_at);

alter table public.social_recommendation_usages enable row level security;
alter table public.social_automation_weekly_runs enable row level security;

drop policy if exists "Users can read own social recommendation usages" on public.social_recommendation_usages;
create policy "Users can read own social recommendation usages"
on public.social_recommendation_usages for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_recommendation_usages.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own social recommendation usages" on public.social_recommendation_usages;
create policy "Users can insert own social recommendation usages"
on public.social_recommendation_usages for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = social_recommendation_usages.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own social recommendation usages" on public.social_recommendation_usages;
create policy "Users can update own social recommendation usages"
on public.social_recommendation_usages for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_recommendation_usages.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = social_recommendation_usages.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own social recommendation usages" on public.social_recommendation_usages;
create policy "Users can delete own social recommendation usages"
on public.social_recommendation_usages for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_recommendation_usages.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own weekly social automation runs" on public.social_automation_weekly_runs;
create policy "Users can read own weekly social automation runs"
on public.social_automation_weekly_runs for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_automation_weekly_runs.merchant_id
    and merchants.user_id = auth.uid()
  )
);
