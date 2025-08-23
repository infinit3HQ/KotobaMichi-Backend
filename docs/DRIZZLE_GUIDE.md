# Drizzle ORM Guide

The project uses Drizzle ORM exclusively for all database access.

## Key Files

- `src/db/schema.ts` – Drizzle schema (tables, enums, relations, optional vector column placeholder)
- `src/db/drizzle.module.ts` / `drizzle.service.ts` – Provides a global `DbService`

## Common Commands

```bash
pnpm db:drizzle:generate   # Generate SQL from schema changes
pnpm db:drizzle:migrate    # Apply pending migrations
```

## Workflow For Schema Changes

1. Edit `src/db/schema.ts`.
2. Run `pnpm db:drizzle:generate` (creates a timestamped SQL file in `drizzle/migrations`).
3. Inspect the generated SQL (ensure no unintended destructive operations).
4. Apply with `pnpm db:drizzle:migrate` (locally) or as part of your deployment pipeline.

## pgvector (Optional Embeddings)

The baseline migration enables the `vector` extension. To add an embedding column later:

```ts
// vector: vector('vector', { dimensions: 768 })
```

And create an index (example cosine similarity):

```sql
CREATE INDEX IF NOT EXISTS words_vector_cosine_idx
ON words USING hnsw (vector vector_cosine_ops);
```

## Testing

Write tests directly against service methods; Drizzle returns plain objects so assertions are straightforward.

## Cleanup Notes

All former Prisma abstractions, feature flags, and repositories have been removed. Any lingering references should be deleted if discovered.

## Future Ideas

- Add integration tests for critical queries.
- Introduce vector similarity search when embeddings are available.
- Benchmark heavy aggregation endpoints and add appropriate indexes.

---

Questions / issues: open an issue with details of the query or schema change.
