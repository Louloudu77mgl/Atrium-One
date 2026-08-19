alter table public.merchant_automation_settings
  add column if not exists review_automation_mode text not null default 'disabled',
  add column if not exists reviews_five_star_action text not null default 'automatic',
  add column if not exists reviews_four_star_action text not null default 'automatic',
  add column if not exists reviews_three_star_action text not null default 'validation',
  add column if not exists reviews_one_two_star_action text not null default 'disabled',
  add column if not exists always_validate_negative_reviews boolean not null default true,
  add column if not exists block_sensitive_reviews boolean not null default true,
  add column if not exists sensitive_keywords text[] not null default array[
    'remboursement',
    'arnaque',
    'scandale',
    'honteux',
    'plainte',
    'avocat',
    'dangereux',
    'intoxication',
    'blessure',
    'vol',
    'insulte'
  ];

alter table public.merchant_automation_settings
  drop constraint if exists merchant_automation_settings_review_automation_mode_check;
alter table public.merchant_automation_settings
  add constraint merchant_automation_settings_review_automation_mode_check
  check (review_automation_mode in ('disabled', 'semi_automatic', 'automatic_guarded'));

notify pgrst, 'reload schema';
