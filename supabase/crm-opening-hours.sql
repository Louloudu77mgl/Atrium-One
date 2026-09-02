-- Horaires d'ouverture Google pour les fiches CRM et le planificateur cold call.
-- Migration additive et idempotente : aucune donnée existante n'est modifiée.

alter table public.crm_leads
  add column if not exists google_opening_hours jsonb;

comment on column public.crm_leads.google_opening_hours is
  'Google Places regularOpeningHours brut (periods + weekdayDescriptions). Objet vide si Google ne renseigne aucun horaire.';
