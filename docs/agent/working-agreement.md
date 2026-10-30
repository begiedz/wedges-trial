# Working agreement and Definition of Done

## Before coding

- Confirm task scope, issue number, dependencies and whether behavior is **current**, **target approved** or **proposed**.
- Inspect existing project structure and relevant docs; read installed Next.js 16 docs when touching Next.js APIs.
- State assumptions only if needed, and never silently turn a balance candidate into a fixed game rule.
- Prefer the smallest change that maintains compatibility during migration.

## Implementation

- Separate pure game engine from persistence, HTTP and UI. Keep code readable; don't add patterns solely to look architectural.
- Guard authoritative state with server validation and DB transactions, never front-end conditionals alone.
- Follow current actual paths (`[lang]`, existing components) rather than outdated scaffold examples.
- Keep i18n, accessibility, keyboard controls, responsive display and error states.
- Reuse existing tests; add regression coverage for any bug fixed or contract changed.
- No secrets, unlicensed media or accidental generated artifacts in diffs.

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
