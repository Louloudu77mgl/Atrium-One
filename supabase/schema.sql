create extension if not exists pgcrypto;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  business_type text not null,
  city text not null,
  phone text,
  description text,
  logo_url text,
  response_tone text not null default 'chaleureux' check (response_tone in ('chaleureux', 'premium', 'professionnel', 'convivial')),
  created_at timestamptz not null default now(),
  constraint merchants_user_id_key unique (user_id)
);

alter table public.merchants add column if not exists response_tone text not null default 'chaleureux';
alter table public.merchants add column if not exists logo_url text;
alter table public.merchants drop constraint if exists merchants_response_tone_check;
alter table public.merchants
  add constraint merchants_response_tone_check
  check (response_tone in ('chaleureux', 'premium', 'professionnel', 'convivial'));

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text not null,
  content text,
  source text not null default 'manual',
  source_review_id text,
  status text not null default 'a_traiter' check (status in ('urgent', 'a_traiter', 'ready_to_publish', 'validation_required', 'repondu', 'generated', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'ignored')),
  sentiment text not null check (sentiment in ('positif', 'neutre', 'negatif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  generated_text text,
  reply_text text not null,
  status text not null default 'generated' check (status in ('generated', 'selected', 'approved', 'validation_required', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'superseded')),
  is_edited boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  google_account_email text,
  google_location_name text,
  google_location_id text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  granted_scopes text[] not null default '{}',
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  constraint google_connections_merchant_id_key unique (merchant_id)
);

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

create table if not exists public.hans_recommendations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null,
  description text not null,
  status text not null default 'todo' check (status in ('todo', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null check (type in ('new_review', 'urgent_review', 'hans_reply_generated', 'reply_validated', 'report_generated', 'hans_recommendation_created', 'hans_task_done')),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

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

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'facebook')),
  title text not null,
  caption text not null,
  cta text,
  hashtags text[] not null default '{}',
  visual_url text,
  status text not null default 'draft' check (status in ('draft', 'editing', 'ready', 'exported', 'saved', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.design_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  format text not null default 'instagram_square' check (format in ('instagram_square', 'story', 'facebook_post')),
  category text not null default 'commerce local',
  tags text[] not null default '{}',
  html_content text not null,
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  tags text[] not null default '{}',
  category text not null default 'Commerce de proximité',
  created_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);

create table if not exists public.merchant_brand_settings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade unique,
  primary_color text not null default '#4C1D95',
  secondary_color text not null default '#F3E8FF',
  accent_color text not null default '#A855F7',
  social_font_family text not null default 'Sora' check (social_font_family in ('Sora', 'Inter', 'Georgia', 'Trebuchet MS', 'Helvetica Neue')),
  show_logo_on_social_posts boolean not null default false,
  social_logo_position text not null default 'top_left' check (social_logo_position in ('top_left', 'top_right', 'bottom_left', 'bottom_right')),
  visual_style text not null default 'premium' check (visual_style in ('premium', 'chaleureux', 'moderne', 'artisanal', 'minimaliste', 'dynamique')),
  tone text not null default 'professionnel' check (tone in ('simple', 'professionnel', 'convivial', 'haut_de_gamme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchant_automation_settings (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade unique,
  reviews_auto_reply_enabled boolean not null default false,
  review_automation_mode text not null default 'disabled' check (review_automation_mode in ('disabled', 'semi_automatic', 'automatic_guarded')),
  reviews_five_star_action text not null default 'automatic' check (reviews_five_star_action in ('disabled', 'validation', 'automatic')),
  reviews_four_star_action text not null default 'validation' check (reviews_four_star_action in ('disabled', 'validation', 'automatic')),
  reviews_three_star_action text not null default 'validation' check (reviews_three_star_action in ('disabled', 'validation', 'automatic')),
  reviews_one_two_star_action text not null default 'disabled' check (reviews_one_two_star_action in ('disabled', 'validation', 'automatic')),
  always_validate_negative_reviews boolean not null default true,
  block_sensitive_reviews boolean not null default true,
  sensitive_keywords text[] not null default array['remboursement', 'arnaque', 'scandale', 'honteux', 'plainte', 'avocat', 'dangereux', 'intoxication', 'blessure', 'vol', 'insulte'],
  social_auto_publish_enabled boolean not null default false,
  social_posts_per_week integer not null default 1 check (social_posts_per_week between 1 and 7),
  social_posts_per_cycle integer not null default 1 check (social_posts_per_cycle between 1 and 30),
  social_cycle_weeks integer not null default 1 check (social_cycle_weeks between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generated_visuals (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  social_post_id uuid references public.social_posts(id) on delete cascade,
  source_image_url text,
  generated_image_url text not null,
  style text not null,
  prompt text,
  created_at timestamptz not null default now()
);

alter table public.generated_replies add column if not exists generated_text text;
alter table public.generated_replies add column if not exists is_edited boolean not null default false;
alter table public.generated_replies add column if not exists edited_at timestamptz;
alter table public.reviews add column if not exists content text;
alter table public.reviews add column if not exists source text not null default 'manual';
alter table public.reviews add column if not exists source_review_id text;
alter table public.reviews add column if not exists updated_at timestamptz not null default now();
alter table public.social_posts add column if not exists updated_at timestamptz not null default now();
alter table public.social_posts add column if not exists last_saved_at timestamptz;
alter table public.review_insights add column if not exists reviews_count integer;
alter table public.review_insights add column if not exists latest_review_updated_at timestamptz;
alter table public.social_posts add column if not exists template_id uuid references public.design_templates(id) on delete set null;
alter table public.social_posts add column if not exists visual_html text;
alter table public.social_posts add column if not exists builder_state jsonb;
alter table public.social_posts add column if not exists visual_text text;
alter table public.social_posts add column if not exists image_url text;
alter table public.social_posts add column if not exists primary_color text;
alter table public.social_posts add column if not exists secondary_color text;
alter table public.social_posts add column if not exists accent_color text;
alter table public.merchant_automation_settings add column if not exists social_posts_per_cycle integer not null default 1;
alter table public.merchant_automation_settings add column if not exists social_cycle_weeks integer not null default 1;
alter table public.merchant_automation_settings add column if not exists review_automation_mode text not null default 'disabled';
alter table public.merchant_automation_settings add column if not exists reviews_five_star_action text not null default 'automatic';
alter table public.merchant_automation_settings add column if not exists reviews_four_star_action text not null default 'validation';
alter table public.merchant_automation_settings add column if not exists reviews_three_star_action text not null default 'validation';
alter table public.merchant_automation_settings add column if not exists reviews_one_two_star_action text not null default 'disabled';
alter table public.merchant_automation_settings add column if not exists always_validate_negative_reviews boolean not null default true;
alter table public.merchant_automation_settings add column if not exists block_sensitive_reviews boolean not null default true;
alter table public.merchant_automation_settings add column if not exists sensitive_keywords text[] not null default array['remboursement', 'arnaque', 'scandale', 'honteux', 'plainte', 'avocat', 'dangereux', 'intoxication', 'blessure', 'vol', 'insulte'];
alter table public.google_connections add column if not exists granted_scopes text[] not null default '{}';
alter table public.google_connections add column if not exists last_error text;
alter table public.media_assets add column if not exists category text not null default 'Commerce de proximité';
alter table public.media_assets add column if not exists uploaded_by uuid references auth.users(id) on delete set null;
alter table public.design_templates add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
    and table_name = 'media_assets'
    and column_name = 'type'
  ) then
    update public.media_assets
    set category = case type
      when 'photo_libre_de_droit' then 'Commerce de proximité'
      when 'photo_commerce' then 'Commerce de proximité'
      when 'visuel_generique' then 'Produit'
      else category
    end
    where category is null or category = 'Commerce de proximité';
  end if;
end $$;

alter table public.media_assets drop column if exists merchant_id;
alter table public.media_assets drop column if exists type;

update public.reviews
set content = review_text
where content is null;

update public.generated_replies
set generated_text = reply_text
where generated_text is null;

update public.reviews set status = 'a_traiter' where status = 'a-traiter';
update public.reviews set status = 'repondu' where status = 'published';
update public.generated_replies set status = 'generated' where status = 'draft';

alter table public.reviews alter column status set default 'a_traiter';
alter table public.generated_replies alter column status set default 'generated';

alter table public.reviews drop constraint if exists reviews_status_check;
alter table public.reviews
  add constraint reviews_status_check
  check (status in ('urgent', 'a_traiter', 'ready_to_publish', 'validation_required', 'repondu', 'generated', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'ignored'));

update public.social_posts set status = 'exported' where status = 'published';
update public.social_posts set status = 'editing' where status = 'saved';

alter table public.social_posts drop constraint if exists social_posts_status_check;
alter table public.social_posts
  add constraint social_posts_status_check
  check (status in ('draft', 'editing', 'ready', 'exported', 'saved', 'published'));

alter table public.generated_replies drop constraint if exists generated_replies_status_check;
alter table public.generated_replies
  add constraint generated_replies_status_check
  check (status in ('generated', 'selected', 'approved', 'validation_required', 'published', 'published_auto', 'published_manual', 'blocked_by_safety', 'superseded'));

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

alter table public.merchants enable row level security;
alter table public.reviews enable row level security;
alter table public.generated_replies enable row level security;
alter table public.google_connections enable row level security;
alter table public.instagram_connections enable row level security;
alter table public.hans_recommendations enable row level security;
alter table public.notifications enable row level security;
alter table public.review_insights enable row level security;
alter table public.social_post_ideas enable row level security;
alter table public.social_posts enable row level security;
alter table public.design_templates enable row level security;
alter table public.media_assets enable row level security;
alter table public.merchant_brand_settings enable row level security;
alter table public.merchant_automation_settings enable row level security;
alter table public.generated_visuals enable row level security;

insert into storage.buckets (id, name, public)
values ('merchant-logos', 'merchant-logos', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('media-assets', 'media-assets', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('social-post-images', 'social-post-images', true)
on conflict (id) do update set public = true;

insert into storage.buckets (id, name, public)
values ('social-visuals', 'social-visuals', true)
on conflict (id) do update set public = true;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
    and tablename in ('merchants', 'reviews', 'generated_replies', 'google_connections', 'instagram_connections', 'hans_recommendations', 'notifications', 'review_insights', 'social_post_ideas', 'social_posts', 'design_templates', 'media_assets', 'merchant_brand_settings', 'merchant_automation_settings', 'generated_visuals')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end $$;

drop policy if exists "Users can read own merchant" on public.merchants;
create policy "Users can read own merchant"
on public.merchants for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own merchant" on public.merchants;
create policy "Users can insert own merchant"
on public.merchants for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own merchant" on public.merchants;
create policy "Users can update own merchant"
on public.merchants for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own merchant" on public.merchants;
create policy "Users can delete own merchant"
on public.merchants for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read own merchant reviews" on public.reviews;
create policy "Users can read own merchant reviews"
on public.reviews for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = reviews.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own merchant reviews" on public.reviews;
create policy "Users can insert own merchant reviews"
on public.reviews for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = reviews.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own merchant reviews" on public.reviews;
create policy "Users can update own merchant reviews"
on public.reviews for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = reviews.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = reviews.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own merchant reviews" on public.reviews;
create policy "Users can delete own merchant reviews"
on public.reviews for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = reviews.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own generated replies" on public.generated_replies;
create policy "Users can read own generated replies"
on public.generated_replies for select
to authenticated
using (
  exists (
    select 1
    from public.reviews
    join public.merchants on merchants.id = reviews.merchant_id
    where reviews.id = generated_replies.review_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own generated replies" on public.generated_replies;
create policy "Users can insert own generated replies"
on public.generated_replies for insert
to authenticated
with check (
  exists (
    select 1
    from public.reviews
    join public.merchants on merchants.id = reviews.merchant_id
    where reviews.id = generated_replies.review_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own generated replies" on public.generated_replies;
create policy "Users can update own generated replies"
on public.generated_replies for update
to authenticated
using (
  exists (
    select 1
    from public.reviews
    join public.merchants on merchants.id = reviews.merchant_id
    where reviews.id = generated_replies.review_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.reviews
    join public.merchants on merchants.id = reviews.merchant_id
    where reviews.id = generated_replies.review_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own generated replies" on public.generated_replies;
create policy "Users can delete own generated replies"
on public.generated_replies for delete
to authenticated
using (
  exists (
    select 1
    from public.reviews
    join public.merchants on merchants.id = reviews.merchant_id
    where reviews.id = generated_replies.review_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own google connection" on public.google_connections;
create policy "Users can read own google connection"
on public.google_connections for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = google_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own google connection" on public.google_connections;
create policy "Users can insert own google connection"
on public.google_connections for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = google_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own google connection" on public.google_connections;
create policy "Users can update own google connection"
on public.google_connections for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = google_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = google_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own google connection" on public.google_connections;
create policy "Users can delete own google connection"
on public.google_connections for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = google_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

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

drop policy if exists "Users can read own hans recommendations" on public.hans_recommendations;
create policy "Users can read own hans recommendations"
on public.hans_recommendations for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = hans_recommendations.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own hans recommendations" on public.hans_recommendations;
create policy "Users can insert own hans recommendations"
on public.hans_recommendations for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = hans_recommendations.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own hans recommendations" on public.hans_recommendations;
create policy "Users can update own hans recommendations"
on public.hans_recommendations for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = hans_recommendations.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = hans_recommendations.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own hans recommendations" on public.hans_recommendations;
create policy "Users can delete own hans recommendations"
on public.hans_recommendations for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = hans_recommendations.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = notifications.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
on public.notifications for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = notifications.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
on public.notifications for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = notifications.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = notifications.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own review insights" on public.review_insights;
create policy "Users can read own review insights"
on public.review_insights for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = review_insights.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own review insights" on public.review_insights;
create policy "Users can insert own review insights"
on public.review_insights for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = review_insights.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own review insights" on public.review_insights;
create policy "Users can update own review insights"
on public.review_insights for update
to authenticated
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

drop policy if exists "Users can read own social post ideas" on public.social_post_ideas;
create policy "Users can read own social post ideas"
on public.social_post_ideas for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_post_ideas.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own social post ideas" on public.social_post_ideas;
create policy "Users can insert own social post ideas"
on public.social_post_ideas for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = social_post_ideas.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own social post ideas" on public.social_post_ideas;
create policy "Users can delete own social post ideas"
on public.social_post_ideas for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_post_ideas.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own social posts" on public.social_posts;
create policy "Users can read own social posts"
on public.social_posts for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_posts.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own social posts" on public.social_posts;
create policy "Users can insert own social posts"
on public.social_posts for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = social_posts.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own social posts" on public.social_posts;
create policy "Users can update own social posts"
on public.social_posts for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_posts.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = social_posts.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own social posts" on public.social_posts;
create policy "Users can delete own social posts"
on public.social_posts for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = social_posts.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Authenticated users can read design templates" on public.design_templates;
create policy "Authenticated users can read design templates"
on public.design_templates for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert design templates" on public.design_templates;
create policy "Authenticated users can insert design templates"
on public.design_templates for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "Authenticated users can update own design templates" on public.design_templates;
create policy "Authenticated users can update own design templates"
on public.design_templates for update
to authenticated
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid());

drop policy if exists "Authenticated users can delete own design templates" on public.design_templates;
create policy "Authenticated users can delete own design templates"
on public.design_templates for delete
to authenticated
using (uploaded_by = auth.uid());

drop policy if exists "Users can read own brand settings" on public.merchant_brand_settings;
create policy "Users can read own brand settings"
on public.merchant_brand_settings for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_brand_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can upsert own brand settings" on public.merchant_brand_settings;
create policy "Users can upsert own brand settings"
on public.merchant_brand_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_brand_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own brand settings" on public.merchant_brand_settings;
create policy "Users can update own brand settings"
on public.merchant_brand_settings for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_brand_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_brand_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own automation settings" on public.merchant_automation_settings;
create policy "Users can read own automation settings"
on public.merchant_automation_settings for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_automation_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own automation settings" on public.merchant_automation_settings;
create policy "Users can insert own automation settings"
on public.merchant_automation_settings for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_automation_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own automation settings" on public.merchant_automation_settings;
create policy "Users can update own automation settings"
on public.merchant_automation_settings for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_automation_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = merchant_automation_settings.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own generated visuals" on public.generated_visuals;
create policy "Users can read own generated visuals"
on public.generated_visuals for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = generated_visuals.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own generated visuals" on public.generated_visuals;
create policy "Users can insert own generated visuals"
on public.generated_visuals for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = generated_visuals.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own media assets" on public.media_assets;
drop policy if exists "Authenticated users can read central media assets" on public.media_assets;
create policy "Authenticated users can read central media assets"
on public.media_assets for select
to authenticated
using (true);

drop policy if exists "Users can insert own media assets" on public.media_assets;
drop policy if exists "Authenticated users can insert central media assets" on public.media_assets;
create policy "Authenticated users can insert central media assets"
on public.media_assets for insert
to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists "Authenticated users can update own central media assets" on public.media_assets;
create policy "Authenticated users can update own central media assets"
on public.media_assets for update
to authenticated
using (uploaded_by = auth.uid())
with check (uploaded_by = auth.uid());

drop policy if exists "Users can delete own media assets" on public.media_assets;
drop policy if exists "Authenticated users can delete own central media assets" on public.media_assets;
create policy "Authenticated users can delete own central media assets"
on public.media_assets for delete
to authenticated
using (uploaded_by = auth.uid());

drop policy if exists "Users can read merchant logos" on storage.objects;
create policy "Users can read merchant logos"
on storage.objects for select
to authenticated
using (bucket_id = 'merchant-logos');

drop policy if exists "Users can insert own merchant logos" on storage.objects;
create policy "Users can insert own merchant logos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'merchant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own merchant logos" on storage.objects;
create policy "Users can update own merchant logos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'merchant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'merchant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own merchant logos" on storage.objects;
create policy "Users can delete own merchant logos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'merchant-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read media assets files" on storage.objects;
create policy "Users can read media assets files"
on storage.objects for select
to authenticated
using (bucket_id = 'media-assets');

drop policy if exists "Users can insert own media asset files" on storage.objects;
create policy "Users can insert own media asset files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own media asset files" on storage.objects;
create policy "Users can update own media asset files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'media-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'media-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own media asset files" on storage.objects;
create policy "Users can delete own media asset files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'media-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read social post images" on storage.objects;
create policy "Users can read social post images"
on storage.objects for select
to authenticated
using (bucket_id in ('social-post-images', 'social-visuals'));

drop policy if exists "Users can insert own social post images" on storage.objects;
create policy "Users can insert own social post images"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('social-post-images', 'social-visuals')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own social post images" on storage.objects;
create policy "Users can update own social post images"
on storage.objects for update
to authenticated
using (
  bucket_id in ('social-post-images', 'social-visuals')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('social-post-images', 'social-visuals')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own social post images" on storage.objects;
create policy "Users can delete own social post images"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('social-post-images', 'social-visuals')
  and (storage.foldername(name))[1] = auth.uid()::text
);

notify pgrst, 'reload schema';
