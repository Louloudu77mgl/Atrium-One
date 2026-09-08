# Supabase / PostgreSQL performance recommendations

Ces commandes sont des recommandations issues des filtres et tris du code. **Elles ne sont pas appliquées par ce déploiement.** Vérifier d'abord les index réellement présents dans Supabase, puis tester chaque proposition sur un environnement de staging.

`CREATE INDEX CONCURRENTLY` doit être exécuté instruction par instruction, hors transaction explicite.

## Priorité 1

### Avis d'un commerce triés par date

```sql
create index concurrently if not exists reviews_merchant_created_at_idx
  on public.reviews (merchant_id, created_at desc);
```

### Réponse active la plus récente de chaque avis

```sql
create index concurrently if not exists generated_replies_review_status_created_at_idx
  on public.generated_replies (review_id, status, created_at desc);
```

### Posts sociaux récents d'un commerce

L'index existant `(merchant_id, source, status, scheduled_at)` ne couvre pas efficacement une liste filtrée uniquement par commerce et triée par date.

```sql
create index concurrently if not exists social_posts_merchant_created_at_idx
  on public.social_posts (merchant_id, created_at desc, id desc);
```

La file de publication dispose déjà de `social_posts_publication_queue_idx`; aucun doublon n'est proposé.

## Priorité 2

```sql
create index concurrently if not exists social_post_ideas_merchant_created_at_idx
  on public.social_post_ideas (merchant_id, created_at desc);

create index concurrently if not exists hans_recommendations_merchant_created_at_idx
  on public.hans_recommendations (merchant_id, created_at desc);

create index concurrently if not exists rcu_records_merchant_type_occurred_at_idx
  on public.rcu_records (merchant_id, record_type, occurred_at desc);
```

L'index RCU existant est orienté timeline client `(merchant_id, customer_key, occurred_at)` et ne couvre pas les lectures globales par type.

## Priorité 3 — avant croissance importante du CRM/SMS

```sql
create index concurrently if not exists customers_merchant_created_at_idx
  on public.customers (merchant_id, created_at desc);

create index concurrently if not exists customer_events_merchant_happened_at_idx
  on public.customer_events (merchant_id, happened_at desc);

create index concurrently if not exists sms_messages_merchant_created_at_idx
  on public.sms_messages (merchant_id, created_at desc);
```

## Validation

- Comparer les plans avec `EXPLAIN (ANALYZE, BUFFERS)` sur des identifiants de staging.
- Contrôler l'espace disque, la durée des écritures et `pg_stat_user_indexes`.
- Ne pas conserver un index rarement lu : chaque index augmente le coût des insertions et mises à jour.
