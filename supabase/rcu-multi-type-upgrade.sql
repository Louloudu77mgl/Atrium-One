alter table public.rcu_forms
  add column if not exists form_type text not null default 'points',
  add column if not exists cta_label text,
  add column if not exists target_url text,
  add column if not exists success_message text,
  add column if not exists poster_headline text,
  add column if not exists poster_body text,
  add column if not exists poster_theme text,
  add column if not exists game_config jsonb not null default '{}'::jsonb;

alter table public.rcu_forms
  drop constraint if exists rcu_forms_form_type_check;

alter table public.rcu_forms
  add constraint rcu_forms_form_type_check
  check (form_type in ('points', 'wheel', 'raffle', 'stamps', 'smart_hans'));
