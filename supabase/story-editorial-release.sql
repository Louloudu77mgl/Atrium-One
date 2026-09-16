-- Changelog uniquement, réexécutable. Aucun changement de schéma requis.
insert into public.crm_releases (
  title, release_date, version, summary, description, highlights, improvements,
  fixes, category, status
)
select
  'Des Stories à l’image de votre commerce', current_date, '2026.09.3',
  'Hans compose des Stories éditoriales avec vos couleurs, vos photos et des mises en page variées.',
  'Un grand titre, une belle photo et des blocs complémentaires : vos Stories adoptent un esprit journal de marque, dans un format vertical prêt à partager. En cas de blocage Instagram, vérifiez votre connexion ou téléchargez votre visuel pour le publier manuellement.',
  '["Trois compositions éditoriales adaptées à la charte du commerce.","Textes complémentaires rédigés par Hans dans les blocs du visuel.","Vérification du compte Instagram et téléchargement de la Story depuis son aperçu."]'::jsonb,
  '["Conservation du brouillon si la publication immédiate échoue.","Reprise de la publication existante après une erreur temporaire."]'::jsonb,
  '["Correction du contrôle du type de compte Instagram qui pouvait bloquer un compte Business valide.","Les erreurs réseau ne laissent plus les boutons de l’aperçu bloqués."]'::jsonb,
  'Instagram', 'draft'
where not exists (select 1 from public.crm_releases where version = '2026.09.3');
