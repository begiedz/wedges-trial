# Wedge's Trial — agent instructions

> Canonical, model-agnostic project rules. Read this file before making changes. Additional procedures are in `docs/agent/` and `.agents/skills/`. This file describes the **target product contract**, not necessarily what the current code already implements.

## Product and delivery

- Wedge's Trial is a **noncommercial** Gothic-inspired browser lockpicking puzzle with endless chest progression, ore-nugget score and a global leaderboard.
- Use **pnpm, Next.js 16, React 19, TypeScript (strict), Radix/shadcn UI, Tailwind CSS, Biome and Vitest**. Follow existing patterns; avoid new infrastructure and dependencies without justification.
- The **chosen target** is **Vercel (Next.js Route Handlers) + Neon PostgreSQL + Drizzle ORM**. Gameplay uses **Vercel-native WebSockets** with visual prediction and authoritative reconciliation; HTTPS remains for bootstrap, lifecycle and recovery. No standalone Express/Docker server is required.
- The repository is in **migration**: gameplay now commits on the server in Neon; the client predicts visuals only, and gameplay browser persistence has been removed. Distinguish implemented code, verified development/Preview behavior and production readiness; never infer deployment from a commit or build. See `docs/architecture/status.md`.
- Consult the version-matched Next.js docs at `node_modules/next/dist/docs/` before modifying framework-specific code, and follow local documentation over assumptions.

## Gameplay invariants (preserve unless explicitly changed)

- Primary mode: **endless**. Each chest has a randomly constructed, solvable lock; new runs use 4/5/6/7 plates at displayed chests 1/6/13/25. Difficulty generally increases with progress.
- Players select and slide **plates** left/right beneath stationary **pins**. Each plate has seven holes and seven bounded integer positions; the middle hole is the target. Sliding one plate may slide connected plates, sometimes in the opposite direction; both directions have inverse effects.
- An **invalid move** would push at least one affected plate outside its legal position range; it changes no plate positions.
- A lockpick **breaks after exactly four invalid moves on that pick**. Breaking it does **not** reset the lock. A separate manual reset button restores plate positions; **reset must not restore spent picks, clear accumulated per-chest scoring penalties, or grant free durability**. Preserve regression coverage for partial damage across reset and chest continuation.
- Player resources: **lockpicks and ore nuggets only**. Ore is the score resource. Do not silently introduce XP, energy, lives or currencies.
- Pure, deterministic *given inputs* domain functions belong in `src/game/`, independent of React, database, network and sound.
- New runs use `scarce-picks-v1`: one starting lockpick and 0/1/2-pick drops of 79%/17%/4%. Existing `deterministic-ore-v1` runs retain their original inventory and drop table; the ore formula is unchanged.
- Randomness in **lock generation** remains. **Ore rewards are deterministic** under approved deterministic-ore-v1: floor((10 + 5 * (chestNumber - 1)) * max(4, 10 - invalidMovesOnChest) / 10). Endless ore ranking is approved (ore DESC, opened chests DESC, finished time ASC, run UUID ASC); further efficiency tuning and lockpick replenishment remain **open balancing decisions**; see `docs/architecture/decisions.md` and GitHub Issues #47, #51.
- Do not claim a generated lock's shortest solution is proven if `solveLock()` returns `null` because its search budget was exhausted. Do not penalize players against an unverified optimum.

## Trust boundary and persistence (implemented gameplay; ranking target)

- **Server is authoritative** for game state, lock generation, moves, lockpick damage, resets, rewards, run status and leaderboard scores. The browser sends **intent/actions only** (`pinId`, direction, action ID, expected version), not trusted state or points.
- Persist active runs and transitions in Neon. No `localStorage` / `sessionStorage` persistence of gameplay state, scores or secrets. Keep front-end state for rendering only; do not trust it on requests.
- Use anonymous session credentials in **Secure, HttpOnly, SameSite cookies** to own and resume runs. No nickname or permanent public player profile is required before playing. Only a verified finished run that currently qualifies for arcade TOP 1000 may submit a nickname, with server-side validation, atomic cutoff recheck and one claim per run. A nickname is **not authentication**. Check run ownership and CSRF/origin protection on mutations.
- Every accepted state-changing action must be **atomic, versioned, retry-safe / idempotent**; simultaneous requests must not duplicate rewards or overwrite newer state. The client must recover from stale-version conflicts and network failures.
- Do not expose DB credentials, session hashes, internal solver solutions or other server-only metadata to clients. Public movement rules may be sent to the owner for visual prediction; predictions never establish score or committed state. Never accept client-submitted score.
- Record relevant run/per-chest metrics server-side (moves, invalid moves, broken picks); preserve penalties through resets and refreshes. Confirm game over and leaderboard eligibility on the server. Public ranking is per claimed finished run, not best score per player; TOP 1000 cutoff is dynamic, rechecked atomically on nickname submission. Non-qualifying historical runs may be cleaned up only under a safe retention policy.

## Frontend, localization and audio

- Current production route shape is `src/app/[lang]/` (**not `[locale]`**). Keep English, Polish, German and Russian (`en`, `pl`, `de`, `ru`); no hardcoded user-visible text.
- Use plate/pin terminology in help, controls, accessibility, debug UI and docs: **plate / płytka / Platte / пластина** moves; **pin / zapadka / Stift / штифт** stays fixed. Describe sliding, not rotation. See [terminology and compatibility](docs/architecture/gameplay.md#lock-component-terminology-60). Existing `Pin`, `PinId`, `PinEffect`, `MoveRule`, `plateCount`, `pinId`, `selectedPinId`, `sourcePinId`, translation keys and component paths retain their technical names; copy corrections do not authorize an internal, API or persisted-state rename.
- Product-specific React presentation belongs in `src/features/<name>/`; tests belong in `tests/` mirroring source paths and basenames. Routes compose minimal public feature APIs. Shared UI must remain feature-independent. Keep `src/game`, `src/client/game`, `src/api` and `src/server` in their existing layers; run `pnpm check:architecture` for dependency enforcement.
- Reuse existing components and assets; keep keyboard, touch and responsive behavior accessible. Keep domain decisions out of UI components.
- Music and SFX are optional user-controlled capabilities with **independent on/off and volume**. No unexpected autoplay; support browser playback restrictions. Audio state must not modify gameplay logic.
- **Do not add or distribute extracted Gothic Remake music, audio, fonts or game assets without adequate usage and redistribution rights.** Noncommercial use is not an automatic license. Existing assets require a provenance audit; see `docs/architecture/audio-assets.md` and Issue #52.

## Coding and verification

1. Use lowercase kebab-case for project-owned filenames/directories; preserve framework/tooling and upstream/generated exceptions. Keep TypeScript symbol conventions unchanged. See `docs/agent/file-naming.md` and run `pnpm check:names`.
2. Read the affected code, relevant architectural docs and task-specific skill before editing. Keep changes small, typed and testable.
3. If existing code conflicts with target architecture, implement an **incremental migration**; do not delete working local flows before the server replacement is ready.
4. Prefer explicit types, pure transformations, server-side validation, parameterized DB operations, migrations and clear errors. Avoid speculative abstractions.
5. Run `pnpm test`, `pnpm lint` and `pnpm build` for relevant code changes when feasible; report commands not run or failures honestly.
6. For DB or API changes, include tests for unauthorized users, malformed input, duplicate requests, concurrent actions, conflict recovery, refresh and rollback.
7. Do not edit generated assets, add secrets, apply production migrations, deploy or modify GitHub issues unless the task authorizes it.
8. Distinguish **implemented**, **approved target**, **proposed balance** and **blocked by licensing** in docs and reports. Do not invent product decisions.

## Where to look

- Architecture: `docs/architecture/README.md`
- Current versus target: `docs/architecture/status.md`
- Domain rules and scoring: `docs/architecture/gameplay.md`
- APIs and persistence: `docs/architecture/backend.md`, `docs/architecture/data-model.md`
- Security: `docs/architecture/security.md`
- Decisions / unanswered questions: `docs/architecture/decisions.md`
- Audio / assets: `docs/architecture/audio-assets.md`
- Skill selection and workflow: `docs/agent/README.md`, `.agents/skills/`
- GitHub backlog: milestone `v1.0.0 - Leaderboard`, especially Issues #27–#51; audio / licensing Issues #52–#54.
