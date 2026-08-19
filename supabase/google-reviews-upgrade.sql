alter table public.reviews
  add column if not exists content text,
  add column if not exists source text not null default 'manual',
  add column if not exists source_review_id text,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists reviews_google_source_id_idx
  on public.reviews (merchant_id, source, source_review_id)
  where source = 'google' and source_review_id is not null;

notify pgrst, 'reload schema';
