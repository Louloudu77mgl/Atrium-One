-- Changelog uniquement : aucune modification du schéma nécessaire au correctif.
insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements,
  fixes, category, status
)
select
  'Hans reste disponible pendant une panne IA', current_date, '2026.09.5',
  'La génération de réponses aux avis reste opérationnelle même si le fournisseur IA est momentanément indisponible.',
  'Hans utilise automatiquement une réponse de secours personnalisée selon la note et les éléments importants de l’avis. Le fonctionnement IA habituel reprend sans intervention dès que le fournisseur redevient disponible.',
  '[]'::jsonb,
  '["Réponses de secours adaptées aux avis positifs, mitigés et négatifs.","Prise en compte des sujets fréquents comme l’attente, le rendez-vous, le tarif ou la livraison."]'::jsonb,
  '["Suppression du blocage « Hans n’est pas disponible » quand le quota ou le service IA est indisponible.","Délai maximal appliqué à l’appel IA avant bascule automatique."]'::jsonb,
  'Avis Google', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.09.5');
