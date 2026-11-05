# File naming and test placement

Project-owned filenames and directory segments use lowercase kebab-case: `create-lock.ts`, `lock-pin.tsx`, `use-game-session.ts`, `command-queue.ts`. Preserve suffixes such as `.test.ts`, `.test.tsx`, `.spec.ts`, `.d.ts` and `.config.ts`. Naming applies to paths, independently of TypeScript symbols: keep `LockPin`, `RunState`, `useLockGame` and `MAX_LOCKPICKS` in code.

## Exceptions

- Next.js reserved names remain as documented by the installed framework: `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, `not-found.tsx`, `default.tsx`, metadata files, etc. Lowercase dynamic/catch-all segments (`[lang]`, `[id]`, `[...slug]`, `[[...slug]]`), route groups (`(group)`), parallel slots (`@modal`) and private folders (`_private`) are accepted in `src/app/` and mirrored `tests/app/` paths.
- Ecosystem files retain their names: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `postcss.config.mjs`, `pnpm-lock.yaml`, `.env.example`, `.gitignore`; tooling directories `.agents`, `.cursor`, `.github`, `.vscode`; documentation/instruction entrypoints `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `SKILL.md`.
- Generated migration history (`drizzle/`), upstream media (`src/assets/` and the existing `public/Cursor.png`) and installed dependencies keep their original names. Renaming assets does not resolve provenance/licensing. Build outputs, coverage, caches, generated `next-env.d.ts`, TypeScript build info and local env files are excluded from the check. Do not put new project-owned source inside these exceptions.

## Tests

All automated tests live under the single `tests/` root. Match the source directory, basename and extension; append `.test` or `.spec` before the extension:

| Source | Test |
| --- | --- |
| `src/game/create-lock.ts` | `tests/game/create-lock.test.ts` |
| `src/client/game/command-queue.ts` | `tests/client/game/command-queue.test.ts` |
| `src/features/gameplay/components/game/game-client.tsx` | `tests/features/gameplay/components/game/game-client.test.tsx` |
| `src/app/api/runs/[id]/route.ts` | `tests/app/api/runs/[id]/route.test.ts` |
| `scripts/database-config.cjs` | `tests/scripts/database-config.test.ts` |

Multi-module integration suites without a single counterpart live in `tests/integration/`; E2E suites can use `tests/e2e/`. Shared test-only support belongs in `tests/fixtures/`, `tests/mocks/` or `tests/utils/`. The existing dialog and client lifecycle suites exercise multiple presentation/session modules and therefore live in `tests/integration/gameplay/`. PostgreSQL/WebSocket/retention coverage lives in `tests/integration/postgres.test.ts`. Do not create duplicate or colocated source tests.

Vitest discovers `.test.ts(x)` and `.spec.ts(x)` only under `tests/`; coverage includes `src/**/*.ts(x)` and excludes declarations. `@/` still resolves to `src/`. TypeScript already includes both trees. Feature test imports may access the owning feature's private modules; production consumers must use its public API.

## Enforcement and renames

`pnpm check:names` walks project files, including untracked additions, validates path segments and requires module tests to match existing source files. Script tests mirror `scripts/`, using TypeScript to test CommonJS where needed. Regression tests exercise approved exceptions and rejection cases. Lint and CI run this guard; Vitest also checks the repository. `pnpm check:architecture` separately enforces production dependency directions.

Use `git mv`, update import/dynamic-import/mock targets and documentation paths together, then run `pnpm test`, `pnpm test:coverage`, `pnpm typecheck`, `pnpm lint` and `pnpm build`. For case-only renames on a case-insensitive filesystem, use an intermediate temporary filename. Linux CI catches import casing errors; TypeScript also enables `forceConsistentCasingInFileNames`.

The #59 refactor coordinates #58's mirrored test placement after #57's feature structure. It changes paths and tooling only; symbols, gameplay, API contracts, dictionaries, assets and persisted data retain their behavior. Rollback is a source-only revert, including imports and configuration; no database migration or wire-version conversion is needed.

## Issue #59 acceptance evidence — 2026-11-05

| Criterion | Status | Evidence |
| --- | --- | --- |
| Applicable source/test filenames and directories use kebab-case | PASS | 53 Git-aware moves; repository walk includes new files; naming regression cases |
| Framework, dynamic-route and ecosystem conventions remain valid | PASS | Explicit guard exceptions and route fixtures; Linux production build retains localized routes and API handlers |
| Mirrored source/test paths; no broken or stale imports | PASS | All 27 existing suites moved once without duplicates; module paths checked against actual source; integration suites explicitly grouped; Linux TypeScript/tests/build |
| Automated enforcement catches violations and accepts exceptions | PASS | `pnpm check:names`, 12 guard regression cases, lint and Ubuntu CI wiring |
| Typecheck, lint, tests, coverage and production build on case-sensitive filesystem | PASS | Disposable Node 22 Linux container, copied source (no macOS bind mount); `pnpm test` and `pnpm test:coverage` each passed all 237 tests, including all 16 PostgreSQL 17 integration tests; `pnpm typecheck`, `pnpm lint`, `pnpm build` passed |
| Developer and agent documentation explains names, symbols and exceptions | PASS | This guide, root README/AGENTS, agent working guide/agreement, frontend/testing skills and module boundaries |
| Structural refactor with unchanged functional behavior | PASS | Syntax comparison of all 127 existing source/test modules found no differences after normalizing renamed path strings, import order and comments; all existing behavioral assertions retained; full regression suite passes |

V8 coverage maps to the renamed `src/` paths: 62.67% statements/lines, 87.92% branches, 78.51% functions across the whole included source tree. No coverage threshold or broader test-coverage claim is introduced. The only lint warning is the pre-existing custom-cursor `!important`. The matching `@vitest/coverage-v8` package is a development-only dependency required to run coverage; naming enforcement itself adds no dependency. CI now runs coverage tests and the production build in addition to existing typecheck/lint gates; the remote workflow has not been run for this uncommitted change. No deployment, GitHub issue mutation, Neon/production migration or live browser verification was performed.
