-- Changelog uniquement : aucune modification du schéma nécessaire au correctif.
insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements,
  fixes, category, status
)
select
  'Le générateur d’images reste disponible', current_date, '2026.09.6',
  'Hans produit désormais un visuel même lorsque le fournisseur d’images IA est momentanément indisponible.',
  'En cas de panne ou de quota épuisé, Hans choisit une photo pertinente dans la bibliothèque et l’adapte au format et aux couleurs de la marque. Si aucune photo n’est accessible, un visuel graphique local est créé automatiquement.',
  '[]'::jsonb,
  '["Repli automatique pour les posts, Stories, e-mails et affiches.","Recadrage adapté à chaque format et harmonisation avec la palette du commerce."]'::jsonb,
  '["Suppression du blocage de la génération d’images quand OpenAI est indisponible.","Création d’un visuel graphique local si la bibliothèque photo est inaccessible."]'::jsonb,
  'Génération de visuels', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.09.6');
