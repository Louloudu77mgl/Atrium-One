begin;

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  google_account_id text,
  gmail_address text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_connections_merchant_id_key unique (merchant_id)
);

alter table public.gmail_connections enable row level security;

drop policy if exists "Users can read own gmail connection" on public.gmail_connections;
create policy "Users can read own gmail connection"
on public.gmail_connections for select
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = gmail_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own gmail connection" on public.gmail_connections;
create policy "Users can insert own gmail connection"
on public.gmail_connections for insert
to authenticated
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = gmail_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own gmail connection" on public.gmail_connections;
create policy "Users can update own gmail connection"
on public.gmail_connections for update
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = gmail_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.merchants
    where merchants.id = gmail_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own gmail connection" on public.gmail_connections;
create policy "Users can delete own gmail connection"
on public.gmail_connections for delete
to authenticated
using (
  exists (
    select 1 from public.merchants
    where merchants.id = gmail_connections.merchant_id
    and merchants.user_id = auth.uid()
  )
);

commit;

notify pgrst, 'reload schema';
