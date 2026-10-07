-- Changelog CRM, sans modification de schéma ni envoi d’e-mail.
insert into public.crm_releases (title, release_date, version, summary, description, highlights, improvements, fixes, category, status)
select 'Création de newsletters depuis un prompt dans le CRM', current_date, '2026.10.crm-newsletter',
  'Le CRM administrateur permet de préparer une newsletter AtriumOne à partir d’un prompt.',
  'Dans Releases & e-mails, Hans rédige un nouveau brouillon avec objet, titre, résumé, introduction et corps modifiables. Les modifications sont enregistrées avant l’aperçu. La génération est réservée au compte administrateur et ne déclenche aucun envoi.',
  '["Génération de newsletters par prompt dans le CRM administrateur.","Relecture et modification avant l’envoi depuis le Gmail CRM."]'::jsonb,
  '[]'::jsonb, '[]'::jsonb, 'CRM administrateur', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.10.crm-newsletter');
