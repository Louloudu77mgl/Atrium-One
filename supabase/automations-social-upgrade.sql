alter table public.merchant_automation_settings
  add column if not exists social_auto_publish_live boolean not null default false;

alter table public.social_posts
  add column if not exists source text not null default 'manual';

alter table public.social_posts
  drop constraint if exists social_posts_source_check;

alter table public.social_posts
  add constraint social_posts_source_check
  check (source in ('manual', 'automation'));

create index if not exists social_posts_merchant_source_status_idx
  on public.social_posts (merchant_id, source, status, scheduled_at desc);
