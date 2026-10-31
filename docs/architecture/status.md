# Current state versus target state

> Checked against GitHub repository `begiedz/wedges-trial` on 2026-10-30, default branch `master`. Revalidate when implementation changes. Paths below describe current code, not assumptions about completed Issues.

| Topic | CURRENT on master | TARGET (planned) |
| --- | --- | --- |
| App | Next.js 16.2.9, React 19.2.4, TypeScript, pnpm | Retain same app |
| Pages | `src/app/[lang]/`, `src/proxy.ts` | Retain localized routes |
| Game | `GameClient.tsx` calls `applyMove`, `createRun`, `openSolvedChest` locally | Server invokes pure engine via trusted service |
| Persistence | `src/game/persistence.ts`, `localStorage` save only on chest continuation | Neon persistence after every accepted state transition |
| Database | None configured | Neon PostgreSQL, Drizzle schema and migrations |
| API | No authoritative gameplay endpoints; v1 wire contract and shared DTOs defined in #29 ([contract](api-contract.md)) | Next.js Route Handlers over HTTPS |
| Player identity | No server identity | Anonymous player + Secure HttpOnly cookie and nickname |
| Leaderboard | No trusted public leaderboard | Best finished run per player, TOP 100 (subject to scoring decisions) |
| Rewards | `rewards.ts` randomly awards ore and picks | Deterministic ore; pick replenishment to be decided |
| Difficulty | `progressDifficulty.ts` grows pin count, density and solution targets | Calibrated levels, measured difficulty, consistent UI bands |
| Reset | `resetLock.ts` restores initial lock incl. pick damage (exploit) | Reset positions without erasing durability/penalties |
| Audio | No implemented playback manager | Optional music/SFX and separate controls, licensed audio only |
| Art | Custom font, cursor, icons present in `src/assets` and `public` | Audit origin and distribution rights |

## Known current entrypoints

- UI/controller: `src/components/game/GameClient.tsx`
- Engine: `src/game/{types,applyMove,createLock,generateRules,solver,progressDifficulty,rewards,createRun,resetLock}.ts`
- Localization: `src/i18n/dictionaries/{en,pl,de,ru}.json`, provider and types
- UI components: `src/components/general/`, `src/components/lock/`, `src/components/lock-debug/`
- Tests: `tests/*.test.ts` (Vitest)
- Existing CI: `.github/workflows/test.yml`
- Assets: `src/assets/`, `public/`

## Migration guardrails

- When adding backend APIs, first cover the existing domain rules with tests.
- Build server storage and gameplay APIs before deleting client-side save/restore; switch the UI only when replacement behavior works.
- Do not seed public leaderboard data from editable old browser saves.
- Do not assume preview deployments share production data; keep DB environments isolated.
- Historical code may legitimately contain behavior now slated for removal; document discrepancies rather than rewriting scope silently.
