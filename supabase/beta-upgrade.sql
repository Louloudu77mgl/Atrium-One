alter table public.reviews add column if not exists source_review_id text;

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews
  add constraint reviews_status_check
  check (status in ('urgent', 'a_traiter', 'ready_to_publish', 'validation_required', 'repondu', 'generated', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'ignored'));

alter table public.generated_replies drop constraint if exists generated_replies_status_check;
alter table public.generated_replies
  add constraint generated_replies_status_check
  check (status in ('generated', 'selected', 'approved', 'validation_required', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'superseded'));

alter table public.google_connections add column if not exists granted_scopes text[] not null default '{}';
alter table public.google_connections add column if not exists last_error text;

create table if not exists public.instagram_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  instagram_account_id text,
  instagram_username text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error', 'pending_configuration')),
  constraint instagram_connections_merchant_id_key unique (merchant_id)
);

alter table public.merchant_automation_settings add column if not exists review_automation_mode text not null default 'disabled';
alter table public.merchant_automation_settings add column if not exists reviews_five_star_action text not null default 'automatic';
alter table public.merchant_automation_settings add column if not exists reviews_four_star_action text not null default 'validation';
alter table public.merchant_automation_settings add column if not exists reviews_three_star_action text not null default 'validation';
alter table public.merchant_automation_settings add column if not exists reviews_one_two_star_action text not null default 'disabled';
alter table public.merchant_automation_settings add column if not exists always_validate_negative_reviews boolean not null default true;
alter table public.merchant_automation_settings add column if not exists block_sensitive_reviews boolean not null default true;
alter table public.merchant_automation_settings add column if not exists sensitive_keywords text[] not null default array['remboursement', 'arnaque', 'scandale', 'honteux', 'plainte', 'avocat', 'dangereux', 'intoxication', 'blessure', 'vol', 'insulte'];

alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_review_automation_mode_check;
alter table public.merchant_automation_settings add constraint merchant_automation_settings_review_automation_mode_check check (review_automation_mode in ('disabled', 'semi_automatic', 'automatic_guarded'));
alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_reviews_five_star_action_check;
alter table public.merchant_automation_settings add constraint merchant_automation_settings_reviews_five_star_action_check check (reviews_five_star_action in ('disabled', 'validation', 'automatic'));
alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_reviews_four_star_action_check;
alter table public.merchant_automation_settings add constraint merchant_automation_settings_reviews_four_star_action_check check (reviews_four_star_action in ('disabled', 'validation', 'automatic'));
alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_reviews_three_star_action_check;
alter table public.merchant_automation_settings add constraint merchant_automation_settings_reviews_three_star_action_check check (reviews_three_star_action in ('disabled', 'validation', 'automatic'));
alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_reviews_one_two_star_action_check;
alter table public.merchant_automation_settings add constraint merchant_automation_settings_reviews_one_two_star_action_check check (reviews_one_two_star_action in ('disabled', 'validation', 'automatic'));

alter table public.instagram_connections enable row level security;

drop policy if exists "Users can read own instagram connection" on public.instagram_connections;
create policy "Users can read own instagram connection"
on public.instagram_connections for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = instagram_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own instagram connection" on public.instagram_connections;
create policy "Users can insert own instagram connection"
on public.instagram_connections for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = instagram_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own instagram connection" on public.instagram_connections;
create policy "Users can update own instagram connection"
on public.instagram_connections for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = instagram_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = instagram_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own instagram connection" on public.instagram_connections;
create policy "Users can delete own instagram connection"
on public.instagram_connections for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = instagram_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);
