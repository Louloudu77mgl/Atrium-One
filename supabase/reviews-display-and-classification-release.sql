-- Changelog uniquement : aucune modification du schéma nécessaire au correctif.
insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements,
  fixes, category, status
)
select
  'Des avis Google plus clairs et mieux classés', current_date, '2026.09.4',
  'Les avis restent en français, les notes de 1 à 3 étoiles sont correctement classées et les avis sans commentaire ne proposent plus de réponse.',
  'Le module Avis applique désormais les mêmes règles dans la liste, les indicateurs et les automatisations.',
  '[]'::jsonb,
  '[]'::jsonb,
  '["Suppression de la traduction anglaise ajoutée aux commentaires Google en français.","Blocage de la génération de réponse lorsqu’un avis ne contient aucun commentaire.","Classement des avis négatifs strictement selon la note : de 1 à 3 étoiles."]'::jsonb,
  'Avis Google', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.09.4');
