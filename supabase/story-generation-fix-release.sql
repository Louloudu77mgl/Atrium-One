-- Changelog uniquement : aucune modification du schéma nécessaire au correctif.
insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements,
  fixes, category, status
)
select
  'Vos recommandations Story créent bien des Stories', current_date, '2026.09.2',
  'Le bouton des recommandations Story génère désormais le visuel vertical attendu.',
  'Depuis Instagram → Stories, Hans utilise le générateur Story et ouvre directement l’aperçu vertical personnalisé aux couleurs de votre commerce.',
  '[]'::jsonb, '[]'::jsonb,
  '["Correction du bouton Story qui créait un post carré.","Les anciens liens vers l’éditeur ouvrent désormais l’aperçu Story pour les créations au format Story."]'::jsonb,
  'Instagram', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.09.2');
