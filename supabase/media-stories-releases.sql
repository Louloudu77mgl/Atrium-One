-- AtriumOne · media library, Instagram Stories and CRM releases
-- Additive/idempotent migration. Safe to run after the existing schema migrations.

create extension if not exists pgcrypto;

create table if not exists public.merchant_media_categories (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists merchant_media_categories_name_key
  on public.merchant_media_categories (merchant_id, lower(name));
create index if not exists merchant_media_categories_merchant_idx
  on public.merchant_media_categories (merchant_id, sort_order, name);

create table if not exists public.merchant_media_assets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  url text not null,
  alt_text text,
  category text,
  source text not null default 'upload' check (source in ('upload', 'website_scrape', 'generated_ai')),
  created_at timestamptz not null default now()
);

alter table public.merchant_media_assets
  add column if not exists category_id uuid references public.merchant_media_categories(id) on delete set null,
  add column if not exists storage_path text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists byte_size bigint,
  add column if not exists use_count integer not null default 0,
  add column if not exists last_used_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists merchant_media_assets_category_idx
  on public.merchant_media_assets (merchant_id, category_id, last_used_at nulls first, created_at desc);

create table if not exists public.merchant_visual_preferences (
  merchant_id uuid primary key references public.merchants(id) on delete cascade,
  image_source_mode text not null default 'ai' check (image_source_mode in ('ai', 'merchant', 'mixed')),
  next_mixed_source text not null default 'merchant' check (next_mixed_source in ('merchant', 'ai')),
  sequence_version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.merchant_visual_preferences
  add column if not exists sequence_version integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.instagram_connections
  add column if not exists instagram_account_type text;

alter table public.social_posts
  add column if not exists media_kind text not null default 'feed',
  add column if not exists source_asset_id uuid references public.merchant_media_assets(id) on delete set null,
  add column if not exists meta_container_id text;

alter table public.social_posts drop constraint if exists social_posts_media_kind_check;
alter table public.social_posts
  add constraint social_posts_media_kind_check check (media_kind in ('feed', 'story'));

create index if not exists social_posts_merchant_media_kind_idx
  on public.social_posts (merchant_id, media_kind, status, scheduled_at desc);

alter table public.merchant_automation_settings
  add column if not exists social_stories_auto_publish_enabled boolean not null default false,
  add column if not exists social_stories_auto_publish_live boolean not null default false,
  add column if not exists social_stories_per_week integer not null default 1;

alter table public.merchant_automation_settings drop constraint if exists merchant_automation_settings_social_stories_per_week_check;
alter table public.merchant_automation_settings
  add constraint merchant_automation_settings_social_stories_per_week_check check (social_stories_per_week between 1 and 7);

alter table public.social_automation_weekly_runs
  add column if not exists automation_kind text not null default 'feed';
alter table public.social_automation_weekly_runs drop constraint if exists social_automation_weekly_runs_merchant_week_key;
alter table public.social_automation_weekly_runs drop constraint if exists social_automation_weekly_runs_automation_kind_check;
alter table public.social_automation_weekly_runs
  add constraint social_automation_weekly_runs_automation_kind_check check (automation_kind in ('feed', 'story'));
create unique index if not exists social_automation_weekly_runs_merchant_week_kind_key
  on public.social_automation_weekly_runs (merchant_id, week_start, automation_kind);

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

alter table public.merchant_media_categories enable row level security;
alter table public.merchant_media_assets enable row level security;
alter table public.merchant_visual_preferences enable row level security;
alter table public.crm_releases enable row level security;
alter table public.crm_gmail_connections enable row level security;
alter table public.crm_release_sends enable row level security;
alter table public.crm_release_recipients enable row level security;

drop policy if exists merchant_media_categories_own on public.merchant_media_categories;
create policy merchant_media_categories_own on public.merchant_media_categories for all to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_media_categories.merchant_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants m where m.id = merchant_media_categories.merchant_id and m.user_id = auth.uid()));

drop policy if exists merchant_media_assets_select_own on public.merchant_media_assets;
drop policy if exists merchant_media_assets_insert_own on public.merchant_media_assets;
drop policy if exists merchant_media_assets_update_own on public.merchant_media_assets;
drop policy if exists merchant_media_assets_delete_own on public.merchant_media_assets;
create policy merchant_media_assets_select_own on public.merchant_media_assets for select to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_media_assets.merchant_id and m.user_id = auth.uid()));
create policy merchant_media_assets_insert_own on public.merchant_media_assets for insert to authenticated
  with check (exists (select 1 from public.merchants m where m.id = merchant_media_assets.merchant_id and m.user_id = auth.uid()));
create policy merchant_media_assets_update_own on public.merchant_media_assets for update to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_media_assets.merchant_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants m where m.id = merchant_media_assets.merchant_id and m.user_id = auth.uid()));
create policy merchant_media_assets_delete_own on public.merchant_media_assets for delete to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_media_assets.merchant_id and m.user_id = auth.uid()));

drop policy if exists merchant_visual_preferences_own on public.merchant_visual_preferences;
create policy merchant_visual_preferences_own on public.merchant_visual_preferences for all to authenticated
  using (exists (select 1 from public.merchants m where m.id = merchant_visual_preferences.merchant_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.merchants m where m.id = merchant_visual_preferences.merchant_id and m.user_id = auth.uid()));

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merchant-media', 'merchant-media', false, 12582912, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 12582912, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists merchant_media_storage_select on storage.objects;
drop policy if exists merchant_media_storage_insert on storage.objects;
drop policy if exists merchant_media_storage_update on storage.objects;
drop policy if exists merchant_media_storage_delete on storage.objects;
create policy merchant_media_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'merchant-media' and exists (
    select 1 from public.merchants m where m.id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
  ));
create policy merchant_media_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'merchant-media' and exists (
    select 1 from public.merchants m where m.id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
  ));
create policy merchant_media_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'merchant-media' and exists (
    select 1 from public.merchants m where m.id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
  )) with check (bucket_id = 'merchant-media' and exists (
    select 1 from public.merchants m where m.id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
  ));
create policy merchant_media_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'merchant-media' and exists (
    select 1 from public.merchants m where m.id::text = (storage.foldername(name))[1] and m.user_id = auth.uid()
  ));

create or replace function public.ensure_merchant_media_defaults(target_merchant_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.merchant_media_categories (merchant_id, name, description, is_system, sort_order)
  values
    (target_merchant_id, 'Produits', 'Produits, créations, plats ou articles vendus.', true, 10),
    (target_merchant_id, 'Prestations', 'Services, soins, rendez-vous et savoir-faire.', true, 20),
    (target_merchant_id, 'Équipe', 'Portraits, collaborateurs et vie de l’équipe.', true, 30),
    (target_merchant_id, 'Commerce / lieu', 'Façade, boutique, salon, salle ou atelier.', true, 40),
    (target_merchant_id, 'Ambiance', 'Atmosphère, détails, matières et moments de vie.', true, 50),
    (target_merchant_id, 'Avant / Après', 'Transformations et résultats comparatifs.', true, 60),
    (target_merchant_id, 'Événements', 'Animations, ateliers, inaugurations et temps forts.', true, 70),
    (target_merchant_id, 'Autres', 'Photos qui ne correspondent pas encore à une autre catégorie.', true, 999)
  on conflict do nothing;
  insert into public.merchant_visual_preferences (merchant_id) values (target_merchant_id)
  on conflict (merchant_id) do nothing;
end $$;

create or replace function public.initialize_merchant_media_defaults()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.ensure_merchant_media_defaults(new.id);
  return new;
end $$;

revoke execute on function public.ensure_merchant_media_defaults(uuid) from public, anon, authenticated;
grant execute on function public.ensure_merchant_media_defaults(uuid) to service_role;

drop trigger if exists merchants_initialize_media_defaults on public.merchants;
create trigger merchants_initialize_media_defaults after insert on public.merchants
  for each row execute function public.initialize_merchant_media_defaults();

do $$ declare merchant_record record;
begin
  for merchant_record in select id from public.merchants loop
    perform public.ensure_merchant_media_defaults(merchant_record.id);
  end loop;
end $$;

update public.merchant_media_assets asset
set category_id = category.id
from public.merchant_media_categories category
where asset.category_id is null
  and category.merchant_id = asset.merchant_id
  and lower(category.name) = lower(coalesce(asset.category, ''));

update public.merchant_media_assets asset
set category_id = (
  select category.id
  from public.merchant_media_categories category
  where category.merchant_id = asset.merchant_id and category.name = 'Autres'
  limit 1
)
where asset.category_id is null;

create or replace function public.crm_active_release_audience()
returns table (merchant_id uuid, user_id uuid, email text, business_name text)
language sql security definer set search_path = public, auth as $$
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

grant select, insert, update, delete on public.merchant_media_categories, public.merchant_media_assets, public.merchant_visual_preferences to authenticated, service_role;
grant select, insert, update, delete on public.crm_releases, public.crm_release_sends, public.crm_release_recipients to authenticated, service_role;
revoke all on public.crm_gmail_connections from anon, authenticated;
grant select, insert, update, delete on public.crm_gmail_connections to service_role;

insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements, fixes, category, status, email_subject, email_intro
)
select
  'Vos contenus deviennent encore plus personnels', current_date, '2026.09',
  'Une médiathèque intelligente, les Stories Instagram et de nouvelles automatisations pour faire vivre votre commerce.',
  'AtriumOne rapproche encore davantage chaque création de l’identité réelle de votre commerce.',
  '["Ajoutez et classez les vraies photos de votre commerce depuis Réglages.","Laissez Hans choisir la photo la plus pertinente selon le sujet.","Créez, planifiez et publiez des Stories Instagram au format 9:16.","Activez des recettes Hans pour publier vos Stories chaque semaine."]'::jsonb,
  '["Choisissez entre photos IA, photos du commerce ou une alternance régulière des deux.","La connexion Instagram est plus simple et plus lisible."]'::jsonb,
  '[]'::jsonb,
  'Produit', 'draft', 'Nouveautés AtriumOne : vos contenus, encore plus à votre image',
  'Découvrez les nouveaux outils qui permettent à Hans de créer des contenus plus authentiques et plus proches de votre commerce.'
where not exists (select 1 from public.crm_releases where version = '2026.09');

notify pgrst, 'reload schema';
