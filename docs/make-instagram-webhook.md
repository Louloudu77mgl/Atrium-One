# Publication Instagram multi-client avec Make

## Architecture

Un seul webhook Make reçoit les publications de tous les commerces. Le champ `connection_key`, égal au `merchant_id` AtriumOne, permet au Router Make de choisir la connexion Instagram propre au client.

```text
AtriumOne
  → Webhooks / Custom webhook
  → Data Store anti-doublon
  → Router par connection_key
  → Instagram for Business / Create a photo post
  → Callback AtriumOne
```

## Variables AtriumOne

```env
MAKE_INSTAGRAM_WEBHOOK_URL=https://hook.eu2.make.com/...
MAKE_INSTAGRAM_WEBHOOK_SECRET=une-cle-longue-et-aleatoire
NEXT_PUBLIC_APP_URL=https://app.votre-domaine.fr
SUPABASE_SERVICE_ROLE_KEY=...
```

`NEXT_PUBLIC_APP_URL` doit être une URL publique. Make ne peut pas rappeler `localhost`.

## Payload reçu par Make

```json
{
  "event": "instagram.publish.requested",
  "event_id": "uuid-du-post",
  "idempotency_key": "instagram:uuid-commerce:uuid-post",
  "merchant_id": "uuid-commerce",
  "merchant_name": "Boulangerie Oulah",
  "merchant_type": "Boulangerie",
  "merchant_city": "Lille",
  "connection_key": "uuid-commerce",
  "post_id": "uuid-du-post",
  "image_url": "https://url-publique/visuel.png",
  "caption": "Légende complète\n\n#hashtags",
  "scheduled_at": null,
  "callback_url": "https://app.votre-domaine.fr/api/webhooks/make/instagram",
  "created_at": "2026-07-30T12:00:00.000Z"
}
```

Les en-têtes envoyés sont :

```text
X-Atrium-Webhook-Secret
X-Atrium-Signature
X-Atrium-Event-Id
Idempotency-Key
```

## Scénario Make

1. Créer `Webhooks > Custom webhook`.
2. Copier son URL dans `MAKE_INSTAGRAM_WEBHOOK_URL`.
3. Ajouter un filtre vérifiant l’en-tête `X-Atrium-Webhook-Secret`.
4. Ajouter un `Data Store` utilisant `idempotency_key` comme clé.
5. Ignorer la requête si cette clé existe déjà.
6. Ajouter un `Router`.
7. Créer une branche par client avec le filtre `connection_key = uuid-commerce`.
8. Dans chaque branche, ajouter `Instagram for Business (Facebook login) > Create a photo post`.
9. Connecter le compte Instagram du client dans ce module.
10. Mapper `image_url` dans l’URL de la photo et `caption` dans la légende.
11. Après publication, enregistrer `idempotency_key` dans le Data Store.
12. Ajouter `HTTP > Make a request` immédiatement après le succès du module Instagram pour rappeler AtriumOne.
13. Ne jamais appeler le callback de succès avant que le module Instagram ait retourné son identifiant de média.

## Callback de succès

Effectuer un `POST` vers la valeur `callback_url`, avec l’en-tête :

```text
X-Atrium-Webhook-Secret: votre secret
```

Et le JSON :

```json
{
  "event_id": "uuid-du-post",
  "post_id": "uuid-du-post",
  "merchant_id": "uuid-commerce",
  "status": "published",
  "instagram_media_id": "identifiant-retourné-par-Instagram"
}
```

AtriumOne refuse la confirmation si `instagram_media_id` est absent. Ce champ constitue la preuve que le module Instagram a bien créé la publication.

## Callback d’échec

Ajouter une route de gestion d’erreur Make qui appelle la même URL :

```json
{
  "event_id": "uuid-du-post",
  "post_id": "uuid-du-post",
  "merchant_id": "uuid-commerce",
  "status": "failed",
  "error": "Message retourné par Make ou Instagram"
}
```

Le callback met automatiquement AtriumOne à jour en `published` ou rétablit le post en `ready` avec le message d’erreur.
