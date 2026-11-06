# Working agreement and Definition of Done

## Branch and delivery workflow

- `development` is the GitHub default integration branch; feature and fix PRs should normally target it.
- `master` is reserved for production releases. Do not interpret a push to `development` as production deployment. Verify that Vercel Production Branch is explicitly set to `master`.
- Create feature/fix branches from up-to-date `development` when appropriate. Link PRs with `Closes #<issue>` so issues close on merge to the default branch.
- Run CI on both `development` and `master`; changes to production should be intentional.

## Before coding

- Confirm task scope, issue number, dependencies and whether behavior is **current**, **target approved** or **proposed**.
- Inspect existing project structure and relevant docs; read installed Next.js 16 docs when touching Next.js APIs.
- State assumptions only if needed, and never silently turn a balance candidate into a fixed game rule.
- Prefer the smallest change that maintains compatibility during migration.

## Implementation

- Separate pure game engine from persistence, HTTP and UI. Keep code readable; don't add patterns solely to look architectural.
- Guard authoritative state with server validation and DB transactions, never front-end conditionals alone.
- Follow current actual paths (`[lang]`, existing components) rather than outdated scaffold examples.
- Keep i18n, accessibility, keyboard controls, responsive display and error states. Follow the [plate/pin glossary](../architecture/gameplay.md#lock-component-terminology-60): moving plates slide under fixed pins; up/down selects plates. Preserve existing technical names and translation keys when correcting copy.
- Use `src/features/<name>/` for product-specific frontend code; keep tests in `tests/` mirroring source directories and basenames; compose public APIs in routes and run `pnpm check:architecture` (also included in lint/tests/CI). See `docs/architecture/module-boundaries.md` for ownership and exceptions.
- Reuse existing tests; add regression coverage for any bug fixed or contract changed.
- No secrets, unlicensed media or accidental generated artifacts in diffs.

Use lowercase kebab-case for project-owned files/directories, independently of TypeScript symbols. Preserve the explicit exceptions in [file naming](file-naming.md). `pnpm check:names` enforces names and mirrored tests locally and through lint/CI.

## Verification checklist

- [ ] Requirement and migration status documented.
- [ ] `pnpm test` passes (or reason stated).
- [ ] `pnpm lint` passes (or reason stated).
- [ ] `pnpm build` passes when relevant (or reason stated).
- [ ] Backend behavior tests ownership, conflicts, replay/duplicate and rollback.
- [ ] Gameplay behavior tests 3 invalid moves, reset fairness, reward once.
- [ ] Four dictionaries updated for new visible text.
- [ ] No user-facing strings hardcoded in React.
- [ ] Browser never becomes source of truth for score or trusted resources.
- [ ] Docs and issue acceptance criteria updated when changes settle a design decision.

## Final report

Describe: changed files; behavior now implemented; test commands/results; known limitations; follow-up GitHub issues. Do not claim deployments or migrations succeeded unless verified.
