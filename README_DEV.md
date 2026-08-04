# AtriumOne beta notes

- Google Business Profile nécessite un flux OAuth serveur avec le scope `https://www.googleapis.com/auth/business.manage`. Une simple clé API ne suffit pas.
- La publication réelle d’une réponse Google dépend aussi de `reviews.source_review_id`, qui doit être rempli lors de la synchronisation des avis.
- Les tokens Google et Instagram sont conservés côté serveur. En production, ils doivent être chiffrés au repos avant stockage.
- L’endpoint Instagram est prêt pour OAuth Meta, mais la publication automatique finale suppose un compte professionnel Instagram/Facebook et des permissions Meta valides.
- Activez le fournisseur Google dans Supabase Auth et ajoutez `http://localhost:3000/auth/callback` aux URLs de redirection pour le bouton « Continuer avec Google ».
- Dans Google Cloud, activez Business Profile Account Management API et Business Profile Business Information API, puis déclarez `GOOGLE_REDIRECT_URI` comme URI OAuth autorisée.
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` doivent venir du même client OAuth Web Google Cloud que `GOOGLE_REDIRECT_URI`. Ne pas utiliser une clé API Google, un secret Supabase Auth, ni le secret d’un autre client OAuth.
- Dans Meta for Developers, ajoutez Facebook Login for Business, déclarez `META_REDIRECT_URI`, demandez les permissions `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement` et reliez le compte Instagram professionnel à une Page Facebook.
