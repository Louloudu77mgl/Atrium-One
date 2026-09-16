# AtriumOne beta notes

- Google Business Profile nécessite un flux OAuth serveur avec le scope `https://www.googleapis.com/auth/business.manage`. Une simple clé API ne suffit pas.
- La publication réelle d’une réponse Google dépend aussi de `reviews.source_review_id`, qui doit être rempli lors de la synchronisation des avis.
- Les tokens Google et Instagram sont conservés côté serveur. En production, ils doivent être chiffrés au repos avant stockage.
- L’endpoint Instagram est prêt pour OAuth Meta, mais la publication automatique finale suppose un compte professionnel Instagram/Facebook et des permissions Meta valides.
- Activez le fournisseur Google dans Supabase Auth et ajoutez `http://localhost:3000/auth/callback` aux URLs de redirection pour le bouton « Continuer avec Google ».
- Dans Google Cloud, activez Business Profile Account Management API et Business Profile Business Information API, puis déclarez `GOOGLE_REDIRECT_URI` comme URI OAuth autorisée.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` doivent venir du même client OAuth Web Google Cloud que `GOOGLE_REDIRECT_URI`. Ne pas utiliser une clé API Google, un secret Supabase Auth, ni le secret d’un autre client OAuth.
- Dans Meta for Developers, configurez **Instagram API with Instagram Login**, déclarez `INSTAGRAM_REDIRECT_URI` et demandez `instagram_business_basic` et `instagram_business_content_publish`. La publication de Stories nécessite un compte Instagram Business, l’app en mode Live et les permissions validées en App Review.
- Pour les e-mails de Releases, déclarez aussi `/api/crm/gmail/callback` dans le client OAuth Google. Les variables `CRM_GMAIL_CLIENT_ID` et `CRM_GMAIL_CLIENT_SECRET` sont optionnelles si le client Google existant est réutilisé ; `CRM_TOKEN_ENCRYPTION_KEY` est recommandé pour stabiliser le chiffrement au repos des tokens CRM.

# Releases utilisateur

Toute évolution fonctionnelle visible par les utilisateurs doit créer ou mettre à jour l’entrée correspondante dans **CRM → Releases**. Les refactors, tests, renommages internes et changements techniques invisibles ne doivent pas alimenter ce changelog.

## Stories : modèle éditorial et diagnostic Meta

- `lib/story-template.ts` adapte le modèle HTML fourni par le propriétaire du projet : papier clair, titre, carte photo, deux blocs et CTA. Trois variantes alternent suivant la dernière Story du commerce. Hans remplit les blocs dans son appel de génération existant, sans appel LLM supplémentaire. Le JPEG reste en 1080 × 1920, avec contenu dans la zone sûre 200–1660 px.
- Le pipeline utilise toujours **Instagram Login**, `graph.instagram.com`, `media_type=STORIES`, puis `media_publish` (pas un endpoint de post standard détourné). Le type de compte est relu via `/me` au moment de l’envoi ; une valeur historique vide ne doit jamais bloquer un compte Business valide. Un ancien état `error` peut être revérifié ; les états déconnecté/révoqué/expiré restent bloquants.
- **Côté Meta** : vérifier le compte Entreprise/Business, la permission `instagram_business_content_publish` avec `instagram_business_basic`, ainsi que l’accès avancé/App Review et le mode Live pour les comptes clients hors rôles de test. Ne pas demander les permissions Facebook Login à la place. Réautoriser AtriumOne après une modification de permissions. Référence : [collection officielle Meta, Instagram Login](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login).
- Le bouton « Vérifier mon compte Instagram » vérifie le token et le type du compte, **pas** une publication réelle ni l’App Review. Le message de Meta lors de l’envoi reste déterminant. Aucun token n’est envoyé au navigateur.
- Un échec Meta après génération ouvre le même brouillon. Un conteneur est enregistré avant tout envoi et réutilisé après une erreur réseau ; s’il est déjà `PUBLISHED`, aucun nouvel envoi. Seuls `ERROR`/`EXPIRED` explicites autorisent sa suppression pour le retry. Les verrous du runner et de la route de publication restent utilisés.
- Le téléchargement JPEG permet une publication manuelle depuis Instagram sans prétendre qu’elle a été publiée par AtriumOne. Les CTA dessinés dans l’image ne sont pas des stickers/liens cliquables.
- Validation : `npm run test:features` inclut la rasterisation des trois variantes et les cas de retry. `STORY_QA_DIR=/tmp/atrium-story-qa node --test tests/story-template.test.cjs` exporte les aperçus avec une illustration de test, sans API payante ni publication externe.
- Aucun nouveau schéma ni variable d’environnement. `supabase/story-editorial-release.sql` ajoute uniquement le brouillon de changelog (à exécuter dans le SQL Editor si le CRM n’est pas accessible au développeur).
