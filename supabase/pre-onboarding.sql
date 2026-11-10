-- Pré-onboarding public AtriumOne. Migration additive et réexécutable.
create extension if not exists pgcrypto;

create table if not exists public.crm_pre_onboardings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  business_name text not null,
  manager_name text not null,
  contact_email text not null,
  google_business_email text not null,
  google_business_confirmed boolean not null default false,
  gmail_email text not null,
  gmail_same_as_google boolean not null default false,
  gmail_confirmed boolean not null default false,
  instagram_business_name text not null,
  instagram_handle text not null,
  instagram_professional_confirmed boolean not null default false,
  global_confirmed boolean not null default false,
  status text not null default 'À configurer',
  google_configured boolean not null default false,
  gmail_configured boolean not null default false,
  instagram_configured boolean not null default false,
  notification_status text not null default 'pending',
  notification_error text,
  idempotency_key uuid not null unique,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_pre_onboardings_status_check check (status in ('À configurer', 'En cours', 'Terminé')),
  constraint crm_pre_onboardings_notification_check check (notification_status in ('pending', 'sent', 'failed', 'skipped')),
  constraint crm_pre_onboardings_confirmations_check check (
    google_business_confirmed and gmail_confirmed and instagram_professional_confirmed and global_confirmed
  )
);

create index if not exists crm_pre_onboardings_lead_idx
  on public.crm_pre_onboardings (lead_id, submitted_at desc);
create index if not exists crm_pre_onboardings_status_idx
  on public.crm_pre_onboardings (status, submitted_at desc);
create index if not exists crm_pre_onboardings_contact_email_idx
  on public.crm_pre_onboardings (lower(contact_email));

alter table public.crm_pre_onboardings enable row level security;
revoke all on public.crm_pre_onboardings from anon;
grant select, insert, update, delete on public.crm_pre_onboardings to authenticated, service_role;

drop policy if exists crm_pre_onboardings_admin on public.crm_pre_onboardings;
create policy crm_pre_onboardings_admin
  on public.crm_pre_onboardings
  for all
  to authenticated
  using (public.is_atriumone_crm_admin())
  with check (public.is_atriumone_crm_admin());

do $$
begin
  if to_regprocedure('public.set_crm_updated_at()') is not null then
    drop trigger if exists crm_pre_onboardings_updated_at on public.crm_pre_onboardings;
    create trigger crm_pre_onboardings_updated_at
      before update on public.crm_pre_onboardings
      for each row execute function public.set_crm_updated_at();
  end if;
end $$;

do $$
begin
  if to_regclass('public.crm_releases') is not null then
    insert into public.crm_releases
      (title, release_date, version, summary, description, highlights, improvements, fixes, category, status)
    select
      'Pré-onboarding client centralisé', current_date, '2026.11.pre-onboarding',
      'Un formulaire guidé collecte les accès nécessaires et rattache chaque réponse à sa fiche CRM.',
      'Le CRM permet désormais de partager un lien de pré-onboarding, recevoir une notification et suivre la configuration Google Business, Gmail et Instagram depuis la fiche client.',
      '["Formulaire public mobile en cinq étapes.","Réponses visibles et copiables dans le CRM.","Suivi À configurer, En cours ou Terminé."]'::jsonb,
      '["Les comptes actifs sont visibles en cards sur l’accueil CRM."]'::jsonb,
      '[]'::jsonb,
      'CRM', 'published'
    where not exists (select 1 from public.crm_releases where version = '2026.11.pre-onboarding');
  end if;
end $$;
