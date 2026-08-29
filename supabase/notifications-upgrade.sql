begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null check (
    type in (
      'new_review',
      'urgent_review',
      'hans_reply_generated',
      'reply_validated',
      'report_generated',
      'hans_recommendation_created',
      'hans_task_done'
    )
  ),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_merchant_created_at_idx
  on public.notifications (merchant_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
on public.notifications for select
to authenticated
using (
  exists (
    select 1
    from public.merchants
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
    select 1
    from public.merchants
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
    select 1
    from public.merchants
    where merchants.id = notifications.merchant_id
      and merchants.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.merchants
    where merchants.id = notifications.merchant_id
      and merchants.user_id = auth.uid()
  )
);

grant select, insert, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

commit;

notify pgrst, 'reload schema';
