create table if not exists public.review_insights (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  analysis_json jsonb not null default '{}'::jsonb,
  reviews_count integer,
  latest_review_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint review_insights_merchant_id_key unique (merchant_id)
);

create table if not exists public.social_post_ideas (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  title text not null,
  angle text not null,
  source_type text not null default 'review_insight',
  source_reference text,
  created_at timestamptz not null default now()
);

alter table public.review_insights enable row level security;
alter table public.social_post_ideas enable row level security;

grant select, insert, update, delete on public.review_insights to authenticated, service_role;
grant select, insert, update, delete on public.social_post_ideas to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_insights' and policyname = 'Users can read own review insights'
  ) then
    create policy "Users can read own review insights"
    on public.review_insights for select to authenticated
    using (
      exists (
        select 1 from public.merchants
        where merchants.id = review_insights.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_insights' and policyname = 'Users can insert own review insights'
  ) then
    create policy "Users can insert own review insights"
    on public.review_insights for insert to authenticated
    with check (
      exists (
        select 1 from public.merchants
        where merchants.id = review_insights.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'review_insights' and policyname = 'Users can update own review insights'
  ) then
    create policy "Users can update own review insights"
    on public.review_insights for update to authenticated
    using (
      exists (
        select 1 from public.merchants
        where merchants.id = review_insights.merchant_id
        and merchants.user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.merchants
        where merchants.id = review_insights.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_post_ideas' and policyname = 'Users can read own social post ideas'
  ) then
    create policy "Users can read own social post ideas"
    on public.social_post_ideas for select to authenticated
    using (
      exists (
        select 1 from public.merchants
        where merchants.id = social_post_ideas.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_post_ideas' and policyname = 'Users can insert own social post ideas'
  ) then
    create policy "Users can insert own social post ideas"
    on public.social_post_ideas for insert to authenticated
    with check (
      exists (
        select 1 from public.merchants
        where merchants.id = social_post_ideas.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_post_ideas' and policyname = 'Users can delete own social post ideas'
  ) then
    create policy "Users can delete own social post ideas"
    on public.social_post_ideas for delete to authenticated
    using (
      exists (
        select 1 from public.merchants
        where merchants.id = social_post_ideas.merchant_id
        and merchants.user_id = auth.uid()
      )
    );
  end if;
end
$$;

notify pgrst, 'reload schema';
