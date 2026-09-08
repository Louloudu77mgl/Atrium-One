# Performance audit

Audit et corrections appliqués sur le `main` distant synchronisé avant le déploiement. Les nouveautés déjà présentes — CRM, Gmail, nouvelles automatisations et cycle Instagram — ont été conservées.

## Problems found

| Impact | Fichier(s) | Problème | Correction appliquée |
| --- | --- | --- | --- |
| **CRITIQUE** | `app/social/page.tsx`, `app/dashboard/page.tsx`, `lib/social-recommendations.ts` | Des appels OpenAI d'analyse, recherche locale ou comparaison historique pouvaient partir pendant le chargement initial. | Les deux pages utilisent les insights persistés et une recommandation locale rapide. L'enrichissement externe reste disponible dans la création explicite et les automatisations. |
| **CRITIQUE** | `lib/app-shell-data.ts`, `lib/reviews.ts` | La plupart des pages chargeaient tous les champs de tous les avis et réponses. | Ajout d'un mode `shell` limité aux champs nécessaires aux compteurs/notifications, et d'un mode `none` pour l'éditeur Social. |
| **ÉLEVÉ** | `lib/reviews.ts`, `lib/social-posts.ts` | `select('*')` transférait des colonnes inutiles, dont les états/HTML lourds des posts. | Sélections explicites et résumés de posts dédiés au Dashboard. |
| **ÉLEVÉ** | `app/automations/page.tsx` | Sept lectures indépendantes étaient séquentielles et une liste complète de posts était chargée sans être utilisée. | Lectures parallélisées avec `Promise.all`; requête Social inutile supprimée. |
| **ÉLEVÉ** | `app/automations/AutomationsWorkspace.tsx` | Tous les outils du builder étaient inclus dans le bundle initial. | Canvas, historique, bibliothèques, panneaux et tests chargés dynamiquement. |
| **ÉLEVÉ** | `components/AtriumHubDashboard.tsx` | Le dashboard entier était un Client Component sans état ni API navigateur. | Conversion en Server Component. |
| **ÉLEVÉ** | `app/api/sms/import/route.ts` | L'import CSV faisait un upsert et parfois un insert pour chaque ligne. | Upsert groupé des clients puis insert groupé des événements. |
| **ÉLEVÉ** | `lib/emailing-data.ts` | Chaque client refiltrait tous les événements RCU, avec une complexité quadratique. | Groupement préalable par clé client et réutilisation via `Map`. |
| **MOYEN** | `app/social/SocialPageClient.tsx` | La grande page Social se rerendait toutes les 15 secondes pour une échéance connue et rechargeait le document après déconnexion. | Timer ponctuel à la prochaine échéance et `router.refresh()` après déconnexion. |
| **MOYEN** | `app/rcu/[slug]/RcuGameExperience.tsx`, `app/social/editor/[postId]/VisualPostEditor.tsx` | Des composants entiers étaient clients pour un seul bouton ou sans interactivité. | Petit bouton client RCU isolé ; expérience RCU et wrapper iframe rendus côté serveur. |
| **MOYEN** | Authentification et OAuth | Plusieurs routes redemandaient l'utilisateur dans `getMerchant` après l'avoir déjà authentifié. | Transmission directe de `user.id` sur les parcours Google, Instagram, Gmail et onboarding. |
| **MOYEN** | Logos locaux | Le logo au-dessus de la ligne de flottaison utilisait des balises `img`. | Utilisation de `next/image` avec dimensions explicites. |

## Main optimizations

- Suppression des fournisseurs IA du chemin critique Dashboard/Social.
- Réduction des payloads Supabase et des appels d'authentification dupliqués.
- Parallélisation des pages Automatisations, Intégrations et éditeur Social.
- Réduction du JavaScript client initial par Server Components et imports dynamiques.
- Suppression du N+1 SMS et de l'agrégation quadratique E-mailing.
- Conservation des `loading.tsx` et squelettes riches déjà présents sur le `main` distant.

## Verification

Correctif de compatibilité production : certaines bases ne possèdent pas `reviews.updated_at`.
La lecture des avis retente alors une projection sans cette colonne et conserve `created_at`
comme date de référence. Quatre tests couvrent les deux schémas, les erreurs indépendantes
et un compte vide. Une lecture réelle du compte démo a confirmé les mêmes 10 avis que la
version fonctionnelle précédente ; aucune donnée ni migration n'a été modifiée.

- `npm run lint` (`tsc --noEmit`) : réussi.
- Tests CRM : 37/37.
- Tests recommandations sociales : 10/10.
- Tests avis démo : 8/8.
- Tests suppression d'automatisations : 4/4.
- Total : **59 tests réussis**.
- `next build` : réussi, **69 pages générées**.
- `git diff --check` : réussi.

## Remaining recommendations

- Migrer les historiques RCU/E-mailing stockés en fichiers vers des tables paginées si les volumes augmentent.
- Ajouter une pagination par curseur aux listes Avis et Social tout en séparant les compteurs SQL globaux.
- Valider puis appliquer les index de `PERFORMANCE_SQL_RECOMMENDATIONS.md`.
- Vérifier que Vercel et Supabase sont dans des régions proches.
- Mesurer TTFB, FCP, LCP et INP en production avec une solution RUM/Vercel Speed Insights.
- Si le TTFB du Dashboard reste élevé, isoler l'auto-synchronisation Google dans une section `Suspense` ou un traitement asynchrone.

## Expected impact

- **FCP/LCP** : interface et squelettes disponibles plus tôt, aucun appel OpenAI sur le chemin critique Dashboard/Social.
- **TTI/INP** : moins de JavaScript initial et suppression des rerenders périodiques inutiles.
- **Navigation** : moins de waterfalls et de rechargements complets.
- **Dashboards** : payloads Supabase plus petits et calculs serveur linéaires.

Les gains exacts dépendent des volumes réels et de la latence Vercel/Supabase. Ils doivent être quantifiés après déploiement avec des mesures utilisateurs réelles.
