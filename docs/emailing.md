# Module E-mailing

## Architecture

- `app/emailing/` contient le dashboard, l’assistant, la segmentation, l’éditeur et les aperçus.
- `lib/emailing-data.ts` construit les abonnés depuis les consentements RCU et enrichit les profils avec visites, points, récompenses et avis.
- `lib/emailing-store.ts` stocke campagnes, événements et désabonnements dans le bucket Supabase privé `emailing-data`.
- `lib/emailing-hans.ts` génère l’objet, le pré-header, le contenu, le CTA et la signature avec OpenAI, avec un repli local.
- `lib/emailing-provider.ts` envoie les campagnes depuis le Gmail connecté du commerçant.
- `app/api/cron/emailing-send/route.ts` traite les campagnes programmées.
- `app/api/gmail/` gère la connexion Google, le callback, le test et la déconnexion Gmail.

## Configuration d’envoi

1. Activer Gmail API dans le projet Google Cloud AtriumOne.
2. Ajouter le scope `https://www.googleapis.com/auth/gmail.send` à l’écran de consentement.
3. Ajouter `https://atrium-one-self.vercel.app/api/gmail/callback` aux URI de redirection du client OAuth Web.
4. Exécuter `supabase/gmail-connections.sql` dans Supabase.

Le flux réutilise `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`. `GMAIL_REDIRECT_URI` est facultative lorsque `NEXT_PUBLIC_APP_URL` pointe déjà sur la production. Gmail ne donne à AtriumOne aucun droit de lecture sur la boîte du commerçant.

## Consentement et mesure

- Seuls les contacts ayant coché le consentement e-mail dans un RCU sont sélectionnables.
- Chaque message contient un lien de désabonnement persistant.
- Les ouvertures et clics sont comptés une seule fois par destinataire et campagne.
- Les filtres sont exprimés en critères métier combinables avec `ET` ou `OU`.

## Import HTML et édition du design

- À l’étape « Finaliser », « Importer un fichier HTML » accepte `.html` et `.htm` (UTF-8, 500 Ko maximum). Le code reste modifiable avec un aperçu desktop/mobile.
- Les images doivent être hébergées sur des URL HTTPS : l’import ne téléverse pas les fichiers locaux référencés par le modèle. Les scripts, formulaires, embeds, imports CSS et styles dangereux sont retirés ; les tableaux et styles responsive sont conservés. L’aperçu est isolé dans une iframe sans scripts, formulaires ni navigation autorisés.
- Les designs générés restent réglables sans code : texte, images, liens, couleurs, police, tailles, alignement, largeur, espacements, arrondis et position du visuel. « Modifier le HTML » permet aussi d’éditer le code complet du design généré.
- Les versions visuelle et HTML sont conservées séparément dans `campaign.content`. Seul `editorMode` décide de la version envoyée. Aucune migration SQL n’est nécessaire ; les anciens brouillons utilisent les réglages par défaut.
- Les variables `{{first_name}}`, `{{last_name}}` et `{{unsubscribe_url}}` sont disponibles en HTML. Le pied de page de désabonnement est ajouté au moment de l’envoi, même si le modèle n’en contient pas. Les tests utilisent un destinataire fictif et ne déclenchent pas de suivi.
- L’aperçu, le test Gmail et l’envoi utilisent le même moteur de rendu. Les liens propres aux modèles importés conservent leur destination (pas de réécriture de suivi des clics) ; le suivi des ouvertures reste actif à l’envoi réel.
- Vérification : `npm run test:emailing` teste le nettoyage, les réglages, la personnalisation, la sauvegarde/reprise, les droits d’accès et le rendu des tests/envois avec des services simulés, sans envoyer d’emails réels.

Validation du 8 septembre 2026 : compilation de production réussie, 77 tests passants (14 emailing, 16 avis/démo/automatisations, 37 CRM, 10 recommandations sociales). Aucun envoi ni modification de campagne en production pendant les tests. L’audit des dépendances garde des alertes préexistantes sur Next.js et ses dépendances ; les nouveaux traitements HTML utilisent sanitize-html 2.17.7 et PostCSS 8.5.28, avec chargement des source maps désactivé.
