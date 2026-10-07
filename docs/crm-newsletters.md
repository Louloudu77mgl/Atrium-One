# Newsletters du CRM administrateur

Dans `/crm/releases` (Releases & e-mails), le prompt crée un nouveau brouillon de catégorie Newsletter : objet, titre, résumé, introduction et corps modifiables. L’aperçu enregistre d’abord les modifications et reprend le moteur HTML AtriumOne commun à l’envoi. Les newsletters utilisent le stockage `crm_releases`, le Gmail CRM, l’audience active et l’idempotence déjà existants. Aucune migration de schéma n’est nécessaire.

La page et l’API `/api/crm/releases/generate` vérifient la session côté serveur et n’acceptent que `louisdacre@gmail.com`, via le contrôle CRM existant. La génération ne sauvegarde ni n’envoie automatiquement. En cas d’échec, le formulaire reste intact. Aucun changement au module `/emailing` des commerçants.

La génération réutilise la configuration de modèle existante et les [sorties structurées de Responses](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), avec validation des champs et sans conservation de la réponse par l’API.

Vérification : `node --test scripts/test-crm-newsletter.cjs`, tests CRM, TypeScript et build de production. Aucun envoi réel dans les tests.
