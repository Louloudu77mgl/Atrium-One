# Audit des blocs Automatisations

## État après raccordement

- 43 blocs opérationnels dans la bibliothèque.
- 37 capacités avancées visibles mais non activables.
- Les blocs non activables affichent désormais la dépendance exacte au lieu du message générique « Backend requis ».

## Blocs activés pendant cet audit

### Déclencheurs RCU

- Client revenu après X jours
- Client absent depuis X jours
- Anniversaire du client
- Anniversaire de l'inscription
- Client atteint X visites
- Client atteint X points
- Profil RCU complété
- Consentements marketing obtenus
- Participation à un jeu RCU
- Gain obtenu via un jeu RCU
- Récompense utilisée
- Client proche d'une récompense
- X visites effectuées en X jours

### Déclencheurs Google

- Nouvel avis avec une note précise
- Mot-clé détecté dans un avis

### Conditions

- Nombre réel de visites
- Ancienneté de la visite précédente
- Solde réel de points
- Statut du client
- Coordonnée client disponible
- Comparaison de la note d'un avis
- Mot ou expression dans un avis
- Avis positif, négatif ou sensible

### Actions et contrôles

- Demander une validation humaine
- Planifier une publication Instagram préparée
- Ne pas relancer un client pendant X jours pour les événements RCU
- Restreindre l'exécution à une plage horaire

## Capacités restant à raccorder

### Événements CRM absents

- Consentement marketing retiré : aucune action de retrait ne publie encore d'événement d'automatisation.
- Client ajouté ou retiré d'un segment : les segments CRM persistants ne sont pas encore modélisés.
- Récompense bientôt expirée : aucune date d'expiration n'est stockée sur les récompenses.
- Client appartient au segment X : dépend du futur modèle de segments.
- État de la récompense : nécessite un identifiant de récompense conservé pendant tout le flow.
- Mettre à jour le client : nécessite un journal de mutations CRM et des règles de droits.
- Modifier la fidélité : nécessite une écriture comptable dédiée pour ne pas falsifier les visites RCU.

### Veilles Google agrégées

- Avis sans réponse depuis X heures ou jours
- Avis existant modifié
- Note Google moyenne sous X
- X nouveaux avis reçus
- Ajouter l'avis aux Insights

Ces blocs exigent un état comparatif persistant entre deux synchronisations Google, différent du traitement unitaire déjà opérationnel.

### Événements e-mail

- Envoi, ouverture, clic, erreur ou désinscription
- E-mail non ouvert après X jours
- Campagne déjà reçue
- Envoyer un modèle ou une offre
- Générer uniquement l'objet ou le CTA

Le suivi existe dans le module E-mailing, mais il ne publie pas encore ces événements vers le moteur de flows. Les deux derniers blocs demandent aussi un état d'e-mail intermédiaire partagé entre plusieurs cards.

### Événements Instagram

- Publication publiée, planifiée ou non validée
- Aucune publication depuis X jours
- Générer séparément une idée, une légende ou un visuel

AtriumOne sait déjà préparer un post complet, le planifier et le publier. Les trois blocs de génération séparée nécessitent un brouillon intermédiaire commun pour éviter de créer plusieurs posts.

### Décisions Hans

- Signal d'avis détecté par Hans
- Analyse de Hans
- Seuil de confiance Hans
- Laisser Hans décider
- Créer ou transformer un texte
- Créer une recommandation

Ces blocs nécessitent un contrat de sortie IA structuré et versionné afin qu'une décision de Hans soit explicable et reproductible dans l'historique.

### Temps et orchestration

- Planification récurrente
- Date précise
- Avant ou après un événement
- Attendre une durée
- Attendre une date, une heure ou une condition
- Plusieurs branches
- Limiter les exécutions par période
- Arrêt conditionnel multi-signal

Ces capacités nécessitent une file d'attente persistante avec reprise après interruption. Elles ne doivent pas être simulées par une attente en mémoire dans une fonction Vercel.
