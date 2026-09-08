# Module E-mailing

## Architecture

- `app/emailing/` contient le dashboard, l’assistant, la segmentation, l’éditeur et les aperçus.
- `lib/emailing-data.ts` construit les abonnés depuis les consentements RCU et enrichit les profils avec visites, points, récompenses et avis.
- `lib/emailing-store.ts` stocke campagnes, événements et désabonnements dans le bucket Supabase privé `emailing-data`.
- `lib/emailing-hans.ts` adapte la génération HTML à la structure de campagne existante. `lib/emailing-generation-prompt.ts` centralise la direction artistique et le prompt ; `lib/emailing-generation.ts` produit et contrôle le document HTML final.
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

- À l’étape « Finaliser », « Importer un fichier HTML » accepte `.html` et `.htm` (UTF-8, 500 Ko maximum) et ouvre directement l’éditeur visuel. « Modifier le design sans code » ouvre également les designs générés par Hans.
- L’éditeur permet de modifier les textes au double-clic ou dans le panneau latéral, d’ajouter titres, paragraphes, boutons, photos, séparateurs, espacements et deux colonnes, puis de déplacer, dupliquer ou supprimer les éléments. Couleurs, liens, police, tailles, alignement, largeur, espacements et arrondis sont réglables sans HTML ; annuler/rétablir et aperçu ordinateur/mobile sont disponibles.
- « Importer une photo » et « Remplacer la photo » téléversent PNG, JPG, WebP ou GIF (4 Mo maximum) via la route authentifiée existante vers Supabase. L’import HTML seul ne téléverse pas les photos locales référencées par le modèle : il faut les sélectionner dans l’éditeur. Les URL HTTPS déjà présentes sont conservées.
- « Appliquer les modifications » revient à l’assistant ; « Enregistrer comme brouillon » conserve le design dans la campagne. « Contenu Hans » et « Reprendre le design libre » permettent de retrouver les deux versions. Le code reste accessible dans une section avancée facultative.
- Le moteur GrapesJS et Juice (styles intégrés aux éléments pour les messageries) sont chargés uniquement à l’ouverture de l’éditeur. Aucune télémétrie ni stockage tiers de design. Les scripts, formulaires, embeds, imports CSS et styles dangereux sont retirés à l’import et à l’export ; les tableaux et styles responsive sont conservés. L’aperçu est isolé dans une iframe sans scripts ; le canevas éditable ajoute une sandbox et une politique CSP interdisant l’exécution de scripts et les connexions.
- Les versions visuelle et HTML sont conservées séparément dans `campaign.content`. Seul `editorMode` décide de la version envoyée. Aucune migration SQL n’est nécessaire ; les anciens brouillons utilisent les réglages par défaut.
- Les variables `{{first_name}}`, `{{last_name}}` et `{{unsubscribe_url}}` sont disponibles en HTML. Le pied de page de désabonnement est ajouté au moment de l’envoi, même si le modèle n’en contient pas. Les tests utilisent un destinataire fictif et ne déclenchent pas de suivi.
- L’aperçu, le test Gmail et l’envoi utilisent le même moteur de rendu. Seule la destination exacte du CTA principal enregistré est réécrite pour le suivi des clics ; les autres liens, notamment ceux modifiés librement dans le design, gardent leur destination. Le suivi des ouvertures reste actif à l’envoi réel.
- Vérification : `npm run test:emailing` teste le nettoyage, les réglages, la personnalisation, la sauvegarde/reprise, les droits d’accès et le rendu des tests/envois avec des services simulés, sans envoyer d’emails réels.

Les tests de l’éditeur utilisent le véritable modèle GrapesJS dans JSDOM : import des styles, modification des textes/liens/photos, ajout de blocs dans les tableaux, déplacement, duplication, suppression, annuler/rétablir, export et reprise du design. Le téléversement photo est testé avec un service simulé, sans écriture en production.

## Génération HTML de niveau newsletter

Audit : l’ancien service demandait un JSON de texte brut limité à 1 000 tokens, sans composition HTML ; `emailing-template.ts` imposait un même bloc titre/texte/bouton. Les images étaient générées après la composition, et l’assistant forçait le mode visuel même si une génération renvoyait du HTML. La preview, la normalisation des campagnes et le stockage JSON savaient déjà utiliser du HTML.

- `generateEmailHtml({ business, campaign, branding, content, images })` demande uniquement un document HTML complet via Responses. Objet et pré-header sont extraits de `<title>` et `<meta name="description">`, sans second appel de rédaction. Le modèle configuré est conservé ; `OPENAI_EMAIL_MODEL` peut spécialiser ce module, puis `OPENAI_MODEL` et `gpt-5.4-mini` servent de replis. Aucun secret ni profil client n’est transmis dans le prompt : seulement le commerce, le brief et le libellé d’audience.
- Identités boulangerie, institut/spa, restaurant, garage, coiffure et commerce général ; quatre pistes de composition choisies selon objectif/secteur, avec variation. Les couleurs personnalisées priment sur la palette de secteur ; le modèle conserve une liberté de composition encadrée.
- Chaque nouvelle génération crée obligatoirement un hero original via l’API Images, même si le commerce possède une médiathèque. Le logo reste celui de la marque ; aucune autre photo de stock, ancienne ou importée n’est substituée automatiquement. Le prompt photo dédié `emailing-image-prompt.ts` interprète le sujet commercial sans dessiner les consignes de rédaction. Format horizontal 1536×1024, qualité medium, fichier PNG unique non écrasant sous `email-campaigns/ai-<uuid>.png`. L’URL du nouveau visuel est fournie au modèle HTML et doit être utilisée. L’import manuel reste disponible dans l’éditeur.
- Délais bornés : 75 secondes pour le visuel, puis 90 secondes maximum pour la rédaction (deux tentatives de 45 secondes), route limitée à 180 secondes. Aucun scraping ni appel IA au chargement du dashboard. Les interruptions client sont transmises aux appels IA.
- Le profil commerçant actuel ne possède pas de champs structurés adresse, horaires ou réseaux sociaux. Le générateur accepte ces informations lorsqu’elles sont disponibles ; en production il transmet les champs existants (ville, téléphone, site, description, logo). Les informations supplémentaires peuvent être fournies dans le brief ; elles ne sont jamais inventées.
- Contrôles avant stockage : document complet, h1 et h2, plusieurs sections/tableaux, container fluide, CSS inline, URLs d’images et liens autorisés, images avec alt et hauteur automatique, pas de layout Grid/Flex ou JavaScript. Les colonnes et cellules d’espacement sont normalisées pour le mobile. Le brief est transmis dans `creativeBrief.instructionsToInterpret`, séparé d’un éventuel `approvedCopy`. Les consignes recopiées sont recherchées dans le texte, l’objet, le pré-header et les alt ; les faits commerciaux courts et les CTA restent autorisés.
- Aucun faux succès : un HTML invalide ou contenant des consignes recopiées déclenche une nouvelle rédaction avec le diagnostic du validateur (une seule reprise). Après échec, clé absente, erreur réseau/quota ou image manquante, l’API retourne une erreur visible sans contenu de remplacement et sans écraser le brouillon. `fallbackEmailHtml` n’est plus appelée en production ; elle sert uniquement aux tests de mise en page hors ligne et ne lit jamais le brief pour remplir le corps.
- Le rendu final ajoute un cadre conditionnel statique pour Outlook classique et le pied de page de consentement. Les anciens brouillons et les automatismes conservent leur contrat de données ; aucune migration SQL.

Le format Responses et la sortie texte ont été vérifiés avec [OpenAI Docs](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create). La structure tables/inline et le repli Outlook suivent les [bonnes pratiques Mailchimp](https://templates.mailchimp.com/getting-started/html-email-basics/) et le [modèle hybride décrit par Litmus](https://www.litmus.com/blog/understanding-responsive-and-hybrid-email-design).

## Validation

Validation du 8 septembre 2026 : compilation de production et lint, 95 tests (32 emailing, 16 avis/démo/automatisations, 37 CRM, 10 recommandations sociales). Trois appels au modèle réel validés pour boulangerie, institut et restaurant (le premier essai restaurant a déclenché le secours, le second a réussi), puis contrôle visuel desktop/mobile à 375 px. Un débordement des cartes institut a été détecté et corrigé dans le post-traitement ; les trois pages ont ensuite une largeur de 375 px sans débordement. Exemples conservés dans [emailing-examples](emailing-examples/README.md).

Parcours no-code vérifiés dans le navigateur local : import d’une newsletter réellement générée, modification via panneau et saisie directe, ajout de texte, duplication/suppression, édition de l’URL/description/taille d’une photo, application et réouverture. Le téléversement photo et la persistance côté API sont testés avec services simulés. Aucun email envoyé ni campagne modifiée en production. Le rendu dans les clients Gmail/Outlook/Apple Mail réels n’a pas fait l’objet d’un envoi de test ; une recette multi-messageries reste conseillée avant une première campagne importante.

L’audit des dépendances garde quatre alertes préexistantes sur Next.js et ses dépendances ; les traitements HTML utilisent sanitize-html 2.17.7 et PostCSS 8.5.28, avec chargement des source maps désactivé.

## Régression : brief recopié et photos réutilisées

Cause identifiée : l’ancien secours découpait le brief et filtrait seulement quelques débuts de phrase ; « Je veux un mail… » pouvait donc devenir un paragraphe publié après un échec IA. La médiathèque empêchait quant à elle tout nouvel appel Images dès qu’elle contenait une photo. Ces deux comportements sont supprimés.

Correction validée le 8 septembre 2026 : 100 tests passants, lint et compilation de production. Trois générations réelles complètes (texte + nouvelle photographie) ont réussi en environ 58–80 secondes : croissant praliné noisette, rituel visage Éclat et carte d’automne. Aucun brief brut publié, aucune image Unsplash réutilisée ; trois contrôles visuels à 375 px sans débordement et photos chargées. Le stockage Supabase est simulé dans cette recette, aucun envoi réel effectué.

Tests supplémentaires : consignes conversationnelles dans les textes/métadonnées/alt, faits commerciaux préservés, une seule reprise de rédaction, échecs sans contenu de remplacement, nouvel appel Images à chaque génération, stockage des octets renvoyés par l’API sous des noms uniques. Le test réel opt-in `scripts/validate-emailing-live.cjs --live --env-file /chemin/local/.env.local --output /chemin/absolu/temporaire` utilise trois commerces fictifs et les véritables API texte/image, mais simule le stockage par des fichiers locaux. Il ne crée ni campagne ni email envoyé en production. Les paramètres Images sont documentés dans [OpenAI Docs](https://developers.openai.com/api/docs/guides/image-generation).
