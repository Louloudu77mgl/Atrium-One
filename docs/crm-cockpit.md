# CRM commercial interne AtriumOne

## Déploiement

1. Exécuter [`supabase/crm-cockpit.sql`](../supabase/crm-cockpit.sql) une fois dans l’éditeur SQL du projet Supabase. Le script est idempotent et lance son backfill à la fin.
2. Ajouter `GOOGLE_PLACES_API_KEY` aux variables serveur. La clé doit autoriser **Places API (New)** et être restreinte au projet/environnement de production.
3. Renseigner `NEXT_PUBLIC_CSM_BOOKING_URL` avec le lien CSM réel déjà prévu par AtriumOne. Aucun lien par défaut n’est inventé.
4. Déployer l’application, puis exécuter `npm run test:crm` et `npm run build`.

La migration ne peut pas être appliquée avec la seule `SUPABASE_SERVICE_ROLE_KEY` : Supabase réserve le DDL à l’éditeur SQL, au CLI authentifié ou à une connexion PostgreSQL.

## Architecture

- `/crm/prospection` : Google Places Text Search (New), pagination, bibliothèque et import sélectionné.
- `/crm/leads` : base active, recherche, filtres combinables, tris et modification de statut.
- `/crm/leads/[id]` : identité, notes, tâches, RDV, signature/perte, timeline et accès AtriumOne.
- `/crm/calendar` : vues aujourd’hui, jour, semaine et mois.
- `/crm/archives` : restauration des soft-deletes.
- `/api/crm/**` : API serveur réservée à `louisdacre@gmail.com`.
- `lib/crm/access.ts` : gardes de compte et de modules pour requêtes utilisateur et traitements administrateur/cron.
- `lib/supabase/middleware.ts` : séparation CRM/commerçants et blocage central de toutes les mutations métier.

## Données et activation

Les tables créées sont `crm_leads`, `crm_notes`, `crm_tasks`, `crm_appointments`, `crm_searches`, `crm_activity`, `business_access` et `business_module_access`.

La migration :

- garde tous les merchants existants en `active` avec tous les modules actifs ;
- crée un lead CRM par merchant existant sans doublon ;
- crée immédiatement un lead `Inscription site` lors d’une nouvelle entrée `auth.users` ;
- associe automatiquement uniquement un email exact ;
- crée le merchant futur en `pending`, avec `account_enabled = false` et tous les modules désactivés ;
- ne supprime jamais un utilisateur Auth lorsqu’un lead est archivé ou supprimé.

`account_enabled = false` est toujours prioritaire sur les modules. Les modules sont : `reviews`, `instagram`, `hans`, `automations`, `emailing`, `rcu`, `customers`, `insights`.

## Google Places et enrichissement

La recherche utilise `POST https://places.googleapis.com/v1/places:searchText`, une FieldMask explicite et 20 résultats par page. Les clés ne quittent jamais le serveur. La date historique de création de fiche reste `NULL`, car Places ne fournit pas de date fiable.

L’email n’est recherché qu’après sélection/import. L’enrichissement visite au maximum la page d’accueil et trois pages publiques contact/légales, refuse les réseaux privés et les redirections non sûres, ne contourne ni CAPTCHA ni protection anti-bot, et ne génère jamais d’adresse.

## Vérifications

`npm run test:crm` couvre les huit scénarios contractuels (isolation admin, utilisateur normal, nouvelle inscription, activation, prospection/doublons, association, calendrier, archive) et l’idempotence du backfill. `npm run lint` valide TypeScript. `npm run build` valide toutes les routes de production.
