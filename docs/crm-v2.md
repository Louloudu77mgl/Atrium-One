# CRM AtriumOne V2

## Migration

Exécuter `supabase/crm-cockpit-v2.sql` après la migration V1. Le script est additif et idempotent : il ne supprime aucune table V1 ni aucun compte AtriumOne.

Il ajoute :

- `crm_search_leads` pour la relation many-to-many entre recherches et leads ;
- `crm_events` pour les interactions réellement effectuées ;
- `crm_opportunities` avec `arr` généré à partir du MRR ;
- `google_result_count` et `pages_fetched` sur `crm_searches` ;
- le statut commercial `Client` ;
- les RPC transactionnelles `delete_crm_search_with_exclusive_leads` et `close_crm_opportunity`.

Le backfill relie les résultats V1 aux leads par Google Place ID, transforme les rendez-vous V1 en événements et crée une opportunité gagnée pour les ventes historiques possédant un MRR.

## Recherche Google Places

La recherche utilise Text Search (New), 20 résultats par page, jusqu’à 5 pages et 100 résultats par requête applicative. Google conserve la maîtrise du nombre réel de pages disponibles ; le code s’arrête dès que `nextPageToken` disparaît. Les pages sont chargées automatiquement, puis dédupliquées globalement dans l’ordre Place ID, domaine, téléphone, nom + adresse.

Les emails publics ne sont enrichis qu’après sélection, au moment de l’import, par lots concurrents de huit.

## Suppressions

La suppression d’une recherche est atomique. Elle supprime la card, ses relations, puis uniquement les leads `Google Prospection` sans autre recherche. Les leads partagés restent présents.

La suppression depuis la base est un soft delete. La suppression définitive reste disponible sur la fiche lead et ne supprime jamais `auth.users`, `merchants` ou les accès produit.

## Revenus

`crm_opportunities.mrr` et `arr` utilisent `numeric(14,2)`. `arr` est une colonne PostgreSQL générée (`mrr * 12`). La clôture gagnée passe l’opportunité à `Gagnée`, renseigne `closed_at`, transforme le lead en `Client`, recopie le MRR sur le lead et journalise l’affaire dans la timeline.
