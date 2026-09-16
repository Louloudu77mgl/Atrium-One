# AtriumOne — consignes de contribution

## Changelog utilisateur

Lorsqu’une modification fonctionnelle visible par l’utilisateur est implémentée, créer ou mettre à jour l’entrée Release correspondante dans le système CRM Releases.

Ne pas créer de release pour un refactor invisible, un renommage interne, des tests ou un changement purement technique sans impact utilisateur. Le contenu d’une release doit décrire uniquement des fonctionnalités réellement opérationnelles et vérifiées.

## Principes d’architecture

- Étendre les services existants avant d’introduire un pipeline parallèle.
- Préserver l’isolation multi-tenant `merchant_id`, les politiques RLS et l’idempotence des runners.
- Toute migration Supabase doit être additive, réexécutable et backward-compatible.
- Avant livraison, exécuter les tests pertinents, TypeScript et le build de production.
