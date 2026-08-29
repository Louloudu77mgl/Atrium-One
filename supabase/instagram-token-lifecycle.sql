begin;

alter table public.instagram_connections
  add column if not exists token_expires_at timestamptz,
  add column if not exists granted_scopes text[] not null default '{}',
  add column if not exists page_id text,
  add column if not exists last_checked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.instagram_connections
  drop constraint if exists instagram_connections_status_check;

alter table public.instagram_connections
  add constraint instagram_connections_status_check
  check (status in (
    'connected',
    'expiring',
    'expired',
    'revoked',
    'error',
    'disconnected',
    'pending_configuration'
  ));

alter table public.social_posts
  add column if not exists instagram_connection_id uuid references public.instagram_connections(id) on delete set null,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists retry_count integer not null default 0;

alter table public.social_posts
  drop constraint if exists social_posts_status_check;

alter table public.social_posts
  add constraint social_posts_status_check
  check (status in (
    'draft',
    'editing',
    'ready',
    'exported',
    'saved',
    'scheduled',
    'publishing',
    'published',
    'failed',
    'cancelled'
  ));

update public.social_posts as post
set instagram_connection_id = connection.id
from public.instagram_connections as connection
where post.merchant_id = connection.merchant_id
  and post.instagram_connection_id is null;

create index if not exists social_posts_publication_queue_idx
  on public.social_posts (status, scheduled_at)
  where status in ('scheduled', 'publishing');

create index if not exists instagram_connections_token_health_idx
  on public.instagram_connections (status, token_expires_at);

commit;
