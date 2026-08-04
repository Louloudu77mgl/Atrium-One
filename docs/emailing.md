# Module E-mailing

## Architecture

- `app/emailing/` contient le dashboard, l’assistant, la segmentation, l’éditeur et les aperçus.
- `lib/emailing-data.ts` construit les abonnés depuis les consentements RCU et enrichit les profils avec visites, points, récompenses et avis.
- `lib/emailing-store.ts` stocke campagnes, événements et désabonnements dans le bucket Supabase privé `emailing-data`.
- `lib/emailing-hans.ts` génère l’objet, le pré-header, le contenu, le CTA et la signature avec OpenAI, avec un repli local.
- `lib/emailing-provider.ts` envoie les campagnes par lots avec Resend.
- `app/api/cron/emailing-send/route.ts` traite les campagnes programmées.

## Configuration d’envoi

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=AtriumOne <contact@domaine-verifie.fr>
CRON_SECRET=une-valeur-secrete
NEXT_PUBLIC_APP_URL=https://app.atriumone.fr
```

Le domaine utilisé dans `EMAIL_FROM` doit être validé chez le fournisseur. Sans ces variables, le module reste utilisable pour créer et enregistrer des brouillons, mais bloque explicitement l’envoi réel.

## Consentement et mesure

- Seuls les contacts ayant coché le consentement e-mail dans un RCU sont sélectionnables.
- Chaque message contient un lien de désabonnement persistant.
- Les ouvertures et clics sont comptés une seule fois par destinataire et campagne.
- Les filtres sont exprimés en critères métier combinables avec `ET` ou `OU`.
