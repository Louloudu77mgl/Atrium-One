-- Réinitialise les avis de test du merchant connecté et insère 20 avis réalistes.
-- À exécuter dans l'éditeur SQL Supabase en étant authentifié via l'app / policies RLS.

do $$
declare
  current_merchant_id uuid;
  review_record record;
begin
  select id into current_merchant_id
  from public.merchants
  where user_id = auth.uid()
  limit 1;

  if current_merchant_id is null then
    raise exception 'Aucun merchant trouvé pour auth.uid()';
  end if;

  delete from public.generated_replies
  where review_id in (select id from public.reviews where merchant_id = current_merchant_id);

  delete from public.reviews where merchant_id = current_merchant_id;

  create temporary table temp_seed_reviews (
    author_name text,
    rating int,
    review_text text,
    sentiment text,
    status text,
    days_ago int
  ) on commit drop;

  insert into temp_seed_reviews values
  ('Camille Martin', 5, 'Accueil très agréable et bouquet magnifique pour l''anniversaire de ma mère. Les fleurs ont tenu plus d''une semaine.', 'positif', 'repondu', 2),
  ('Julien Moreau', 4, 'Bonne boutique de quartier, choix varié et conseils utiles. Un peu d''attente le samedi matin.', 'positif', 'generated', 4),
  ('Sarah Benali', 2, 'Commande prête avec 30 minutes de retard et bouquet moins fourni que sur la photo. Déçue pour le prix.', 'negatif', 'urgent', 6),
  ('Nicolas Petit', 5, 'Super service, composition très élégante et livraison ponctuelle. Je recommande.', 'positif', 'a_traiter', 8),
  ('Élodie Garnier', 3, 'Les fleurs étaient jolies mais certaines ont fané dès le lendemain. Dommage.', 'negatif', 'ready_to_publish', 10),
  ('Marc Lefèvre', 5, 'Très bon conseil pour un bouquet de saison. Résultat naturel et raffiné.', 'positif', 'ignored', 12),
  ('Amina Diallo', 4, 'Personnel souriant, prix corrects et belle sélection de plantes.', 'positif', 'a_traiter', 15),
  ('Thomas Roussel', 1, 'Mauvaise expérience, personne n''a retrouvé ma commande en ligne et l''accueil était froid.', 'negatif', 'urgent', 18),
  ('Claire Dubois', 5, 'Une boutique charmante avec des bouquets toujours frais. Merci pour votre disponibilité.', 'positif', 'repondu', 21),
  ('Hugo Lambert', 3, 'Correct mais j''aurais aimé plus d''explications sur l''entretien des plantes.', 'neutre', 'a_traiter', 24),
  ('Manon Girard', 5, 'Le bouquet de mariage civil était superbe, exactement dans les tons demandés.', 'positif', 'generated', 28),
  ('Pierre Colin', 2, 'Le bouquet livré ne correspondait pas aux couleurs demandées. Service client difficile à joindre.', 'negatif', 'urgent', 31),
  ('Inès Perrin', 4, 'Très belles fleurs et emballage soigné. Livraison avec un léger retard.', 'positif', 'ready_to_publish', 35),
  ('Antoine Roy', 5, 'Toujours de bons conseils pour offrir. Boutique fiable et chaleureuse.', 'positif', 'a_traiter', 39),
  ('Lina Faure', 3, 'La plante est belle, mais le pot conseillé était trop petit.', 'neutre', 'generated', 44),
  ('Baptiste Mercier', 1, 'Bouquet fané à la réception. Je n''ai pas eu de proposition de solution.', 'negatif', 'urgent', 49),
  ('Sophie Laurent', 5, 'Très beau bouquet de pivoines, frais et parfaitement préparé.', 'positif', 'repondu', 55),
  ('Karim Haddad', 4, 'Bonne expérience globale, équipe sympathique et boutique propre.', 'positif', 'ignored', 62),
  ('Laura Simon', 2, 'Attente trop longue malgré une commande passée la veille.', 'negatif', 'a_traiter', 70),
  ('Mathieu Bernard', 5, 'Composition moderne, livraison impeccable et message manuscrit très apprécié.', 'positif', 'ready_to_publish', 82),
  ('Chloé Masson', 4, 'Jolie sélection de fleurs séchées et accueil très doux. Les prix sont un peu élevés mais la qualité est là.', 'positif', 'a_traiter', 88),
  ('Romain Chevalier', 2, 'Le bouquet commandé pour une livraison surprise est arrivé sans la carte avec le message. C''était important pour nous.', 'negatif', 'urgent', 96),
  ('Nadia Fontaine', 5, 'Très belle découverte. La vendeuse a pris le temps de composer un bouquet simple, frais et parfaitement adapté à mon budget.', 'positif', 'generated', 105);

  for review_record in
    insert into public.reviews (merchant_id, author_name, rating, review_text, sentiment, status, created_at)
    select current_merchant_id, author_name, rating, review_text, sentiment, status, now() - (days_ago || ' days')::interval
    from temp_seed_reviews
    returning id, author_name, status
  loop
    if review_record.status in ('generated', 'ready_to_publish', 'repondu') then
      insert into public.generated_replies (review_id, generated_text, reply_text, status, is_edited)
      values (
        review_record.id,
        '<p>Bonjour ' || split_part(review_record.author_name, ' ', 1) || ',</p><p>Merci d’avoir pris le temps de partager votre retour. Votre avis nous aide à continuer d’améliorer l’expérience en boutique.</p><p>L’équipe Maison Lavigne</p>',
        '<p>Bonjour ' || split_part(review_record.author_name, ' ', 1) || ',</p><p>Merci d’avoir pris le temps de partager votre retour. Votre avis nous aide à continuer d’améliorer l’expérience en boutique.</p><p>L’équipe Maison Lavigne</p>',
        case when review_record.status = 'repondu' then 'published' when review_record.status = 'ready_to_publish' then 'approved' else 'generated' end,
        false
      );
    end if;
  end loop;
end $$;
