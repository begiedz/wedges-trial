---
name: testing-quality
description: Use for Vitest unit/integration tests, lock generator simulations, regressions, security tests, CI checks and Vercel performance verification.
---

# Testing and quality skill

Read `docs/agent/working-agreement.md`, domain docs and current tests.

## Procedure

1. Reproduce a bug with a failing test before fixing when feasible.
2. Prioritize game invariants, generator solvability, retry and transaction correctness over implementation details.
3. Keep seeded randomness for reproducible tests; run representative early, threshold and high chest indices.
4. For DB action handling, test real PostgreSQL transactions, race cases, duplicated idempotency IDs and failed commit/rollback.
5. Verify input validation, session ownership, CSRF, public DTO leak prevention and 409 recovery.
6. Run `pnpm test`, `pnpm lint`, `pnpm build` when feasible, report limitations honestly.
7. Do not pretend static inspection of code substitutes for runtime benchmarks or permission checks.

## Done when

- Relevant unit/integration/regression suites pass and any untested risks are documented.
