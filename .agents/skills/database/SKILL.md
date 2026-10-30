---
name: database
description: Use when designing Neon PostgreSQL schema, Drizzle migrations, transactions, unique constraints and efficient leaderboard SQL.
---

# Database skill

Read `docs/architecture/data-model.md`, `backend.md`, `security.md`, issues #30–#32 and affected source/tests.

## Procedure

1. Model `players`, `sessions`, `runs`, `run_actions` and indexes based on access patterns, not speculative abstractions.
2. Enforce ownership, unique action IDs, nonnegative counters, status transitions and one-active-run policy with DB constraints where practical.
3. Verify the *actual chosen* Neon driver supports required Drizzle transactions/row lock strategy; never assume the HTTP-based and session-based transports are interchangeable.
4. Use parameterized queries, transaction boundaries and compare-and-swap/version guards for mutations.
5. Separate Preview and Production. Generate versioned migrations; do not auto-apply them in request handlers.
6. Avoid importing server DB modules into `use client` code and never expose DB credentials.
7. Test against PostgreSQL for concurrency, duplicates, rollback and ranking ties; unit mocks alone are insufficient.

## Done when

- Fresh DB initializes from migrations, indexes and constraints are tested.
- Repeated/parallel reward claims commit once.
- Ranking query uses only eligible finished runs and stable ordering.
