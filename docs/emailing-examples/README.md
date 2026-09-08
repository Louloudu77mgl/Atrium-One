# Trois newsletters de validation

Commerces, adresses et offres fictifs. Images d’illustration provenant des URL déjà présentes dans la bibliothèque de démonstration de l’application. Aucun message envoyé.

- [Maison Augustine — boulangerie](boulangerie.html) : crème, brun et terracotta ; photo de pains en hero, sélection de trois créations, encart fournil.
- [Maison Sauge — institut](institut.html) : sauge, nude et blanc cassé ; signature centrée, rituel de soin, étapes en cartes empilées sur mobile.
- [La Table des Saisons — restaurant](restaurant.html) : esprit éditorial, encre bordeaux, photo de salle et carte de saison, bloc réservation contrasté.

Ces documents proviennent du modèle réel, puis du même nettoyage, intégration des styles et traitement responsive que la production. Les liens `.example` et la variable de désabonnement sont volontairement non opérationnels hors de la campagne. La prévisualisation AtriumOne et l’envoi ajoutent les mentions de consentement et le repli de largeur Outlook.

Tests hors ligne : `npm run test:emailing`.

Régénération explicite avec la clé OpenAI du processus : `node scripts/preview-email-generation.cjs --live --output /chemin/absolu/temporaire`. Sans `--live`, seuls les designs de secours sont générés. `--env-file` permet de lire une configuration locale sans l’imprimer. Ne jamais commiter cette configuration. `--only institut` limite le scénario ; `--revalidate` applique les contrôles aux HTML déjà présents sans nouvel appel IA.
