-- Changelog CRM, sans modification de schéma ni envoi d'e-mail.
insert into public.crm_releases (title, release_date, version, summary, description, highlights, improvements, fixes, category, status)
select 'Fiabilisation des images de posts Instagram', current_date, '2026.11.instagram-images',
  'La création de posts Instagram vérifie désormais que le visuel a bien été généré avant d’ouvrir l’éditeur.',
  'Hans relance automatiquement une génération lorsque le service d’images rencontre une erreur temporaire. Si aucune image ne peut être produite, le post reste sur l’écran de création avec un message clair au lieu d’ouvrir un brouillon vide.',
  '[]'::jsonb,
  '["Nouvel essai automatique lorsque l’API d’images est momentanément indisponible."]'::jsonb,
  '["Un brouillon Instagram sans image n’est plus créé silencieusement."]'::jsonb,
  'Instagram', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.11.instagram-images');
