# Audit fonctionnel des RCU

## Synthèse

Les cinq RCU disposent désormais du même socle : formulaire persistant, code comptoir masqué, une participation par programme et par jour, journal client, portefeuille, récompenses utilisables et landing page aux couleurs de la boutique.

## 1. Programme de points

### Défauts constatés

- Le bonus de cinq visites ne se déclenchait qu'une seule fois.
- Les récompenses ne pouvaient pas être ajoutées ou retirées depuis l'interface.
- Le solde affiché sur une nouvelle visite repartait visuellement de zéro si l'ancien lien de participation n'était plus présent.
- Le bonus avis reposait sur une simple déclaration client.

### Corrections

- Le bonus de fréquence est accordé à chaque série de cinq jours de visite différents.
- Jusqu'à dix paliers peuvent être créés, triés et sécurisés côté serveur.
- Le solde est restauré depuis le portefeuille reconnu sur le téléphone.
- L'avis est confirmé dans le parcours de validation par le commerçant et ne peut être récompensé qu'une fois par programme.
- Les points dépensés sont déduits du solde avant le calcul des récompenses disponibles.

### Limite connue

La publication effective d'un avis Google ne peut être certifiée sans intégration spécifique à la plateforme. Le contrôle repose donc sur la confirmation du commerçant au moment où il saisit le code de visite.

## 2. Roue de la chance

### Défauts constatés

- La roue dessinait toujours quatre quartiers, même lorsque la configuration contenait un autre nombre de gains.
- L'animation pouvait s'arrêter sur une mauvaise case lorsque plusieurs gains portaient le même nom.
- Les probabilités n'étaient pas lisibles par le commerçant.
- Certaines couleurs de marque rendaient le texte des cases illisible.

### Corrections

- La roue accepte de deux à douze cases et construit dynamiquement ses segments.
- Le serveur enregistre l'index exact de la case gagnante.
- Le tirage utilise un générateur aléatoire cryptographique et les poids configurés.
- Les probabilités calculées sont visibles dans l'éditeur.
- Les couleurs des segments conservent un contraste suffisant, quelle que soit la charte de la boutique.
- Chaque gain reste dans le portefeuille jusqu'à sa remise par le personnel.

## 3. Tombola mensuelle

### Défauts constatés

- Les tickets étaient créés, mais aucun tirage n'existait.
- Le commerçant ne connaissait pas le nombre de participants du mois.
- Un gagnant ne recevait aucune récompense exploitable.

### Corrections

- Chaque visite produit un ticket unique associé au client et au mois.
- La carte du RCU affiche le nombre de tickets pour le mois sélectionné.
- Le commerçant peut lancer un seul tirage sécurisé par programme et par mois.
- Le gagnant, son ticket, son téléphone et le lot sont enregistrés dans le journal unifié.
- Le lot apparaît automatiquement dans le portefeuille du gagnant et dans sa fiche client.
- La migration SQL ajoute une unicité dédiée au tirage mensuel.

## 4. Carte de fidélité numérique

### Défauts constatés

- La carte affichait seulement un compteur brut et ne distinguait pas clairement les cycles successifs.
- La progression pouvait disparaître lorsque le client revenait sans ancien lien de participation.

### Corrections

- Chaque carte possède maintenant un numéro de cycle.
- Un cadeau distinct est créé à chaque carte terminée.
- Les cycles continuent après la remise d'un cadeau sans écraser les précédents.
- La progression précédente est restaurée depuis l'historique du portefeuille.
- Le commerçant peut choisir entre deux et trente visites par carte.

## 5. Fidélité intelligente Hans

### Défauts constatés

- Hans gérait uniquement le retour après inactivité et une habitude hebdomadaire sommaire.
- Les anciens messages d'inactivité restaient affichés comme des offres actives.

### Corrections

- Hans distingue maintenant l'accueil, la régularité, l'habitude par jour et le retour après inactivité.
- Le rythme moyen entre deux visites est calculé pour produire une recommandation compréhensible.
- Les bonus d'inactivité possèdent une date de validité et disparaissent après leur expiration.
- Le multiplicateur est borné côté serveur et le solde partagé tient compte des récompenses déjà utilisées.

## Socle transversal

- Les configurations sont normalisées et bornées côté serveur avant sauvegarde.
- Le code comptoir est absent du HTML public, masqué pendant la saisie et limité à cinq erreurs sur dix minutes avant un blocage temporaire.
- La visite du jour est retrouvée depuis le portefeuille même si le cookie de participation a disparu.
- Les jetons du portefeuille et de participation ne sont plus placés dans l'URL après validation.
- Les informations connues sont préremplies lors des visites suivantes.
- Le consentement nécessaire au programme est séparé du consentement marketing SMS, désormais facultatif.
- Une nouvelle soumission le même jour met à jour le même contact au lieu de créer des doublons.
- Un RCU existant peut être modifié sans perdre son identifiant, sa date de création ou son code comptoir.

## Validation

- Compilation TypeScript réussie.
- Build Next.js de production réussi.
- Tests réels réussis sur les cinq mécaniques, le doublon quotidien, le code masqué, le consentement SMS facultatif et le portefeuille.
- Contrôle responsive réussi à 390 px pour les cinq landing pages, sans débordement horizontal.
