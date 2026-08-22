create extension if not exists pgcrypto;

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
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error', 'pending_configuration')),
  constraint instagram_connections_merchant_id_key unique (merchant_id)
);

alter table public.instagram_connections enable row level security;

drop policy if exists "Users can read own instagram connection" on public.instagram_connections;
create policy "Users can read own instagram connection"
on public.instagram_connections for select
to authenticated
using (
  exists (
    select 1
    from public.merchants
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
    select 1
    from public.merchants
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
    select 1
    from public.merchants
    where merchants.id = instagram_connections.merchant_id
      and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.merchants
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
    select 1
    from public.merchants
    where merchants.id = instagram_connections.merchant_id
      and merchants.user_id = auth.uid()
  )
);

notify pgrst, 'reload schema';
