-- AtriumOne · Story recommendations and Hans Story generation
-- Additive and safe to execute more than once.

alter table public.instagram_connections
  add column if not exists instagram_account_type text;

alter table public.social_posts
  add column if not exists media_kind text not null default 'feed',
  add column if not exists source_asset_id uuid,
  add column if not exists meta_container_id text;

alter table public.social_posts drop constraint if exists social_posts_media_kind_check;
alter table public.social_posts
  add constraint social_posts_media_kind_check check (media_kind in ('feed', 'story'));

do $$
begin
  if to_regclass('public.merchant_media_assets') is not null
    and not exists (select 1 from pg_constraint where conname = 'social_posts_source_asset_id_fkey') then
    alter table public.social_posts
      add constraint social_posts_source_asset_id_fkey
      foreign key (source_asset_id) references public.merchant_media_assets(id) on delete set null;
  end if;
end $$;

create index if not exists social_posts_merchant_media_kind_idx
  on public.social_posts (merchant_id, media_kind, status, scheduled_at desc);

alter table public.merchant_automation_settings
  add column if not exists social_stories_auto_publish_enabled boolean not null default false,
  add column if not exists social_stories_auto_publish_live boolean not null default false,
  add column if not exists social_stories_per_week integer not null default 1;

alter table public.merchant_automation_settings
  drop constraint if exists merchant_automation_settings_social_stories_per_week_check;
alter table public.merchant_automation_settings
  add constraint merchant_automation_settings_social_stories_per_week_check
  check (social_stories_per_week between 1 and 7);

alter table public.social_automation_weekly_runs
  add column if not exists automation_kind text not null default 'feed';
alter table public.social_automation_weekly_runs
  drop constraint if exists social_automation_weekly_runs_merchant_week_key;
alter table public.social_automation_weekly_runs
  drop constraint if exists social_automation_weekly_runs_automation_kind_check;
alter table public.social_automation_weekly_runs
  add constraint social_automation_weekly_runs_automation_kind_check
  check (automation_kind in ('feed', 'story'));

create unique index if not exists social_automation_weekly_runs_merchant_week_kind_key
  on public.social_automation_weekly_runs (merchant_id, week_start, automation_kind);

do $$
begin
  if to_regclass('public.crm_releases') is not null then
    insert into public.crm_releases (
      title, release_date, version, summary, description, highlights, improvements, fixes, category, status
    )
    select
      'Hans imagine désormais vos Stories', current_date, '2026.09.1',
      'De nouvelles recommandations Story transforment les meilleurs sujets de votre commerce en créations Instagram 9:16.',
      'Hans propose désormais séparément des idées de posts et de Stories, puis compose chaque Story à partir de votre identité visuelle.',
      '["Des recommandations dédiées aux Stories dans l’espace Instagram.","Une génération complète par Hans : message, photo, composition et CTA.","Le format vertical 9:16 reprend les couleurs, la police, le logo et le style du commerce."]'::jsonb,
      '["Les recommandations Post et Story disposent de cycles de vie séparés pour éviter les doublons sans limiter les idées."]'::jsonb,
      '[]'::jsonb,
      'Instagram', 'draft'
    where not exists (select 1 from public.crm_releases where version = '2026.09.1');
  end if;
end $$;

notify pgrst, 'reload schema';
