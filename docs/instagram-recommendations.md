# Renouvellement des recommandations Instagram

## Comportement

- La page Avis n'affiche plus le résumé imposant une validation des avis négatifs. Les réglages d'automatisation restent inchangés.
- Les recommandations piochent dans les thèmes positifs et négatifs de l'analyse Insights IA. Une même thématique n'occupe qu'une carte.
- Une publication Instagram au statut `published` retire sa thématique. Brouillon, export, planification et échec ne la consomment pas.
- La liste réserve de la place aux événements locaux et au calendrier, même si les Insights contiennent beaucoup de sujets.
- La réserve ne contient pas de nouveaux faits inventés : lorsqu'un ensemble de thèmes a été épuisé, les prochains avis enrichissent l'analyse. Le calendrier et les événements disponibles peuvent prendre le relais. Aucun minimum fictif de recommandations n'est affiché.
- Le titre, la légende et le visuel peuvent être modifiés sans perdre le thème d'origine.
- Les badges « Avis positif · Point fort » et « Avis négatif · À améliorer » apparaissent sur Instagram, dans le choix de création et dans le composant de recommandations partagé.

## Stockage : aucune migration SQL

Le JSON existant `social_posts.builder_state` reçoit une propriété `_recommendation` versionnée : `themeKey`, `sourceType`, `sourceLabel`, `title`, `eventDate`.
Elle est sauvegardée lors de la création depuis une recommandation ou le rythme automatique. Le PATCH de l'éditeur préserve la version serveur, même si le navigateur omet ou modifie la propriété. La transformation d'image et la duplication la conservent aussi.

Les anciens posts, les posts rédigés librement et les publications d'automatisations déclenchées n'ont pas nécessairement ce lien exact. Hans compare leur sujet central aux thèmes actuels, avec un résultat mis en cache par commerce, thèmes et historique. Cette correspondance sémantique reste une inférence : elle peut être imparfaite pour une ancienne légende ambiguë. Si OpenAI est indisponible, le suivi exact des nouveaux posts fonctionne toujours ; la comparaison des anciens posts est réessayée ultérieurement.

Le calcul est une projection de l'analyse et des publications : il ne supprime ni les Insights ni les brouillons. Supprimer définitivement un post supprime aussi sa trace dans cet historique.

## Veille locale

- Recherche réelle OpenAI Responses + `web_search`, imposée par `tool_choice: required`, sur « ville + date + événements ».
- Sources de mairie, office de tourisme ou organisateurs privilégiées ; année, ville et date explicitement demandées.
- Une URL doit apparaître dans les sources consultées/citées par l'outil. Les dates impossibles, les événements passés, les autres villes et les URLs non consultées sont rejetés.
- Réserve de huit événements maximum sur six semaines ; jusqu'à deux places réservées dans la sélection initiale. Date et lien source visibles sur les cartes Instagram.
- Cache de données Next/Vercel par ville, secteur et lundi de la semaine, en heure de Paris. Il fonctionne entre instances serveur. Le cron Insights existant le précharge même sans nouvel avis ; Instagram et la page de création le remplissent également à la demande.
- Une nouvelle semaine crée une nouvelle entrée, sans servir l'ancienne en attendant. Les événements devenus passés sont filtrés à chaque lecture.
- Timeout de 45 secondes. Une recherche indisponible ne bloque pas les autres recommandations et n'est pas mémorisée comme un résultat vide pour la semaine.
- Variables existantes : `OPENAI_API_KEY`, `OPENAI_MODEL`, éventuellement `OPENAI_SEARCH_MODEL`. Aucun nouvel identifiant requis.
- Référence : https://developers.openai.com/api/docs/guides/tools-web-search

## Vérification reproductible

1. `npm ci`, `npm run test:social`, `npm run test:crm`, `npm run lint`, `npm run build`.
2. Ouvrir `/reviews` : ancien label absent ; contrôles d'automatisation toujours présents.
3. Ouvrir `/social` avec des Insights : deux recommandations visibles, navigation latérale, badges positif/négatif.
4. Créer depuis une recommandation ; contrôler `_recommendation` dans le JSON du post. Modifier le titre, la légende et le visuel ; enregistrer puis recharger : l'origine doit rester identique.
5. Planifier ou conserver en brouillon : la thématique reste proposée. Après publication Instagram réellement réussie, la carte disparaît et une autre thématique disponible prend sa place, sans réanalyser tous les avis.
6. Simuler un échec via les tests (sans envoyer de publication) : aucune thématique consommée. Le cron et la publication manuelle passent par le même service qui invalide les pages après succès.
7. Réouvrir `/social/create` et le dashboard : les thèmes déjà publiés ne doivent pas revenir.
8. Vérifier le renouvellement lundi à minuit Paris, les sources locales et l'exclusion d'un événement passé. Les tests couvrent aussi un nouvel événement annuel portant le même nom.
9. Ajouter un avis réel : l'analyse existante continue d'être actualisée par son mécanisme de changement de source.

## Limites opérationnelles

Une source consultée n'est pas une garantie absolue de véracité : le commerçant peut vérifier le lien avant publication. Aucune participation ou promotion n'est déduite automatiquement.
La veille dépend de la clé, du modèle et du quota OpenAI. L'historique ancien est traité par lots de 50 avec cache ; son premier rapprochement peut prendre du temps pour un très grand historique.
Le rythme automatique ne recycle plus une même idée pour remplir artificiellement un quota : il peut préparer moins de posts lorsque la réserve est épuisée, ou si les événements sont antérieurs aux créneaux prévus.
Les tests locaux n'envoient aucun post sur Instagram. Une vraie publication de validation nécessite le compte connecté et l'accord du commerçant.
