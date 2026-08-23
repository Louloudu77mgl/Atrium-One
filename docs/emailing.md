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
