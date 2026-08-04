alter table public.merchants
  add column if not exists website_url text;

alter table public.social_posts
  add column if not exists scheduled_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists error_message text,
  add column if not exists instagram_media_id text;

alter table public.social_posts
  drop constraint if exists social_posts_status_check;

alter table public.social_posts
  add constraint social_posts_status_check
  check (status in ('draft', 'editing', 'ready', 'exported', 'saved', 'scheduled', 'published'));

create table if not exists public.merchant_media_assets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  url text not null,
  alt_text text,
  category text,
  source text not null default 'upload' check (source in ('upload', 'website_scrape', 'generated_ai')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists merchant_media_assets_merchant_id_idx
  on public.merchant_media_assets (merchant_id, created_at desc);

create unique index if not exists merchant_media_assets_merchant_url_idx
  on public.merchant_media_assets (merchant_id, url);

alter table public.merchant_media_assets enable row level security;

drop policy if exists "merchant_media_assets_select_own" on public.merchant_media_assets;
create policy "merchant_media_assets_select_own"
  on public.merchant_media_assets
  for select
  using (
    exists (
      select 1
      from public.merchants
      where merchants.id = merchant_media_assets.merchant_id
        and merchants.user_id = auth.uid()
    )
  );

drop policy if exists "merchant_media_assets_insert_own" on public.merchant_media_assets;
create policy "merchant_media_assets_insert_own"
  on public.merchant_media_assets
  for insert
  with check (
    exists (
      select 1
      from public.merchants
      where merchants.id = merchant_media_assets.merchant_id
        and merchants.user_id = auth.uid()
    )
  );

drop policy if exists "merchant_media_assets_update_own" on public.merchant_media_assets;
create policy "merchant_media_assets_update_own"
  on public.merchant_media_assets
  for update
  using (
    exists (
      select 1
      from public.merchants
      where merchants.id = merchant_media_assets.merchant_id
        and merchants.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.merchants
      where merchants.id = merchant_media_assets.merchant_id
        and merchants.user_id = auth.uid()
    )
  );

drop policy if exists "merchant_media_assets_delete_own" on public.merchant_media_assets;
create policy "merchant_media_assets_delete_own"
  on public.merchant_media_assets
  for delete
  using (
    exists (
      select 1
      from public.merchants
      where merchants.id = merchant_media_assets.merchant_id
        and merchants.user_id = auth.uid()
    )
  );
