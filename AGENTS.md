# Wedge's Trial — agent instructions

> Canonical, model-agnostic project rules. Read this file before making changes. Additional procedures are in `docs/agent/` and `.agents/skills/`. This file describes the **target product contract**, not necessarily what the current code already implements.

## Product and delivery

- Wedge's Trial is a **noncommercial** Gothic-inspired browser lockpicking puzzle with endless chest progression, ore-nugget score and a global leaderboard.
- Use **pnpm, Next.js 16, React 19, TypeScript (strict), Radix/shadcn UI, Tailwind CSS, Biome and Vitest**. Follow existing patterns; avoid new infrastructure and dependencies without justification.
- The **chosen target** is **Vercel (Next.js Route Handlers) + Neon PostgreSQL + Drizzle ORM**. Ordinary **HTTPS** requests are sufficient; WebSockets and a standalone Express/Docker server are not requirements.
- The repository is in **migration**: `src/components/game/GameClient.tsx` currently applies moves locally and `src/game/persistence.ts` uses `localStorage`. **Never describe the target backend as already deployed.** See `docs/architecture/status.md`.
- Consult the version-matched Next.js docs at `node_modules/next/dist/docs/` before modifying framework-specific code, and follow local documentation over assumptions.

## Gameplay invariants (preserve unless explicitly changed)

- Primary mode: **endless**. Each chest has a randomly constructed, solvable lock; difficulty generally increases with progress.
- Each pin has a bounded integer position and a target. Moving one pin may move other pins according to fixed per-lock dependency rules; both directions have inverse effects.
- An **invalid move** would push at least one affected pin outside its legal range; it changes no pin positions.
- A lockpick **breaks after exactly three invalid moves on that pick**. Breaking it does **not** reset the lock. A separate manual reset button restores pin positions; **reset must not restore spent picks, clear accumulated per-chest scoring penalties, or grant free durability**. Existing reset code currently has a bug that clears partial damage; fix with tests.
- Player resources: **lockpicks and ore nuggets only**. Ore is the score resource. Do not silently introduce XP, energy, lives or currencies.
- Pure, deterministic *given inputs* domain functions belong in `src/game/`, independent of React, database, network and sound.
- Randomness in **lock generation** remains. **Ore rewards must become deterministic** and reflect chest progression and player performance. The **exact formula**, bonus for efficiency, lockpick replenishment and ranked-vs-endless scoring remain **open balancing decisions**; see `docs/architecture/decisions.md` and GitHub Issues #47, #51.
- Do not claim a generated lock's shortest solution is proven if `solveLock()` returns `null` because its search budget was exhausted. Do not penalize players against an unverified optimum.

## Trust boundary and persistence (target)

- **Server is authoritative** for game state, lock generation, moves, lockpick damage, resets, rewards, run status and leaderboard scores. The browser sends **intent/actions only** (`pinId`, direction, action ID, expected version), not trusted state or points.
- Persist active runs and transitions in Neon. No `localStorage` / `sessionStorage` persistence of gameplay state, scores or secrets. Keep front-end state for rendering only; do not trust it on requests.
- Use anonymous players and opaque, unguessable session credentials in **Secure, HttpOnly, SameSite cookies**. Check run ownership and CSRF/origin protection on mutations. A nickname is **not authentication**.
- Every accepted state-changing action must be **atomic, versioned, retry-safe / idempotent**; simultaneous requests must not duplicate rewards or overwrite newer state. The client must recover from stale-version conflicts and network failures.
- Do not expose DB credentials, session hashes, internal solver solutions or other server-only metadata to clients. Never accept client-submitted score.
- Record relevant run/per-chest metrics server-side (moves, invalid moves, broken picks); preserve penalties through resets and refreshes. Confirm game over and leaderboard eligibility on the server.

## Frontend, localization and audio

- Current production route shape is `src/app/[lang]/` (**not `[locale]`**). Keep English, Polish, German and Russian (`en`, `pl`, `de`, `ru`); no hardcoded user-visible text.
- Reuse existing components and assets; keep keyboard, touch and responsive behavior accessible. Keep domain decisions out of UI components.
- Music and SFX are optional user-controlled capabilities with **independent on/off and volume**. No unexpected autoplay; support browser playback restrictions. Audio state must not modify gameplay logic.
- **Do not add or distribute extracted Gothic Remake music, audio, fonts or game assets without adequate usage and redistribution rights.** Noncommercial use is not an automatic license. Existing assets require a provenance audit; see `docs/architecture/audio-assets.md` and Issue #52.

## Coding and verification

1. Read the affected code, relevant architectural docs and task-specific skill before editing. Keep changes small, typed and testable.
2. If existing code conflicts with target architecture, implement an **incremental migration**; do not delete working local flows before the server replacement is ready.
3. Prefer explicit types, pure transformations, server-side validation, parameterized DB operations, migrations and clear errors. Avoid speculative abstractions.
4. Run `pnpm test`, `pnpm lint` and `pnpm build` for relevant code changes when feasible; report commands not run or failures honestly.
5. For DB or API changes, include tests for unauthorized users, malformed input, duplicate requests, concurrent actions, conflict recovery, refresh and rollback.
6. Do not edit generated assets, add secrets, apply production migrations, deploy or modify GitHub issues unless the task authorizes it.
7. Distinguish **implemented**, **approved target**, **proposed balance** and **blocked by licensing** in docs and reports. Do not invent product decisions.

## Where to look

- Architecture: `docs/architecture/README.md`
- Current versus target: `docs/architecture/status.md`
- Domain rules and scoring: `docs/architecture/gameplay.md`
- APIs and persistence: `docs/architecture/backend.md`, `docs/architecture/data-model.md`
- Security: `docs/architecture/security.md`
- Decisions / unanswered questions: `docs/architecture/decisions.md`
- Audio / assets: `docs/architecture/audio-assets.md`
- Skill selection and workflow: `docs/agent/README.md`, `.agents/skills/`
- GitHub backlog: milestone `v1.1.0 - Leaderboard`, especially Issues #27–#51; audio / licensing Issues #52–#54.
