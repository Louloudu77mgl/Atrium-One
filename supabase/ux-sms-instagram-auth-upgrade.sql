alter table public.rcu_forms
  add column if not exists discount_label text,
  add column if not exists discount_value integer,
  add column if not exists promo_prefix text;

alter table public.sms_leads_forms
  add column if not exists promo_code text,
  add column if not exists promo_label text,
  add column if not exists promo_value integer,
  add column if not exists redeemed_at timestamptz;

create index if not exists sms_leads_forms_merchant_promo_idx
  on public.sms_leads_forms (merchant_id, promo_code);

alter table public.merchant_media_assets
  add column if not exists metadata jsonb not null default '{}'::jsonb;
