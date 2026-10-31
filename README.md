# Wedge’s Trial

An endless browser lockpicking puzzle inspired by Gothic Remake’s lock mechanics and [Fingers Challenge](https://fingerschallenge.com).

Open a chest, collect its ore, and face a harder lock. Connected tumblers turn each move into a small logic puzzle: shifting one pin can move several others. Your goal is to gather as many **ore nuggets** as possible before your last lockpick breaks.

## Project status

The playable version runs entirely in the browser. It includes generated solvable locks, endless progression, chest rewards, Game Over and restart dialogs, local checkpoints, keyboard and touch controls, and four languages.

The project is preparing to move to a server-authoritative architecture:

| Area | Available now | Planned |
| --- | --- | --- |
| Gameplay | Pure TypeScript engine executed locally | Server-validated actions through Next.js Route Handlers |
| Persistence | Browser `localStorage` checkpoints | Neon PostgreSQL with Drizzle ORM |
| Identity | No account or server session required | Anonymous sessions for runs; nickname only after a qualifying Game Over |
| API | Documented contract and shared DTOs | Authenticated, versioned, retry-safe endpoints |
| Ranking | Ore total displayed for the current run | Arcade TOP 100 of claimed, verified finished runs |
| Rewards | Random ore and occasional lockpicks | Deterministic rewards; balance still under discussion |

**The API contract is defined; the backend and global leaderboard are not implemented.** Local scores are unverified and will not be imported into competitive rankings. See [current versus target architecture](docs/architecture/status.md) for migration details.

## How to play

1. Select a tumbler by clicking or tapping it.
2. Turn it left or right. Its pin—and pins on connected tumblers—may move.
3. Align every pin with its target to open the chest.
4. Choose **Take all** to collect the reward and advance to the next lock.
5. Keep going until you run out of lockpicks.

A move is invalid when any affected pin would leave its allowed range. Invalid moves leave every pin in place and damage the current lockpick. **Exactly three invalid moves on that pick break it.** Breaking a pick does not reset the lock. The run ends when the last pick breaks.

Manual reset restores the current lock’s starting layout. Starting a new run during an active trial requires confirmation; starting after Game Over does not.

### Controls

| Input | Action |
| --- | --- |
| Click / tap a tumbler | Select it |
| `A` / `←` | Turn the selected tumbler left |
| `D` / `→` | Turn the selected tumbler right |
| `W` / `↑` | Select the previous tumbler |
| `S` / `↓` | Select the next tumbler |
| `R` | Reset the current lock |
| `N` | Reopen a dismissed chest reward dialog |
| `Space` in the reward dialog | Take all and advance |
| `Esc` in the reward dialog | Close it without collecting |

Visible buttons provide the same gameplay actions on desktop and mobile. Gameplay shortcuts are blocked while a dialog is open.

### Local saves

Claiming a chest reward saves a checkpoint containing the next chest and updated resources. Opening the game again resumes that checkpoint automatically. Individual pin moves are not saved, so refreshing during a chest returns to the checkpoint rather than the last move. Starting over or losing the run clears the saved checkpoint.

Saves belong to the current browser and origin; they do not sync between devices. This local flow remains available until server persistence replaces it.

## Run locally

Use **Node.js 22** (the version used by CI) and **pnpm 10.18.3** (pinned in `package.json`).

```bash
git clone https://github.com/begiedz/wedges-trial.git
cd wedges-trial
pnpm install --frozen-lockfile
pnpm dev
```

Open [localhost:3000/en/game](http://localhost:3000/en/game) to play, or [localhost:3000/en](http://localhost:3000/en) for the home page.

The current local game needs no database, account, or environment secrets. `.env.example` contains database placeholders for the planned backend; adding connection strings alone does not enable server persistence. Keep credentials out of source control and client-exposed variables.

### Languages and routes

English (`en`), Polish (`pl`), German (`de`), and Russian (`ru`) use the same route structure:

| Route | Purpose |
| --- | --- |
| `/{lang}` | Home and introduction |
| `/{lang}/game` | Play the trial |
| `/{lang}/how-to-play` | Gameplay rules and controls |
| `/{lang}/about` | Project background and inspiration |
| `/{lang}/debug` | Development lock harness |
| `/{lang}/solver` | Development solver information page |

Unprefixed page requests use browser language negotiation with English as the default fallback. The language menu switches between localized routes. The debug and solver pages return 404 in production builds.

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm test` | Run the Vitest suite |
| `pnpm exec tsc --noEmit` | Check TypeScript types |
| `pnpm lint` | Check formatting, imports and lint rules with Biome |
| `pnpm format` | Apply formatting across the repository |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve an existing production build locally |

The app uses `next/font/google` for Noto Serif and a local heading font. A fresh build may need network access to fetch the Google font.

### Tests and quality checks

Tests cover pin dependencies, valid and invalid moves, pick damage and breakage, generated lock solvability, difficulty progression, solver behavior, persistence and reset behavior. React tests cover reward claims, duplicate inputs, dialog interactions, keyboard handling and restart flows.

Run tests, type checking, lint and a production build before submitting relevant code changes. The GitHub Actions workflow currently runs `pnpm test` for pushes and pull requests targeting `development` and `master`; it does not yet run the other checks.

There are existing repository-wide Biome formatting/import errors. If a full lint run fails, distinguish those from errors introduced by your change and check the files you touched separately.

## Codebase and architecture

The current stack is **Next.js 16, React 19, strict TypeScript, Radix/shadcn UI, Tailwind CSS 4, Biome and Vitest**, managed with pnpm. The game renders with React and CSS rather than Canvas.

```text
src/
  app/[lang]/           Localized pages and layouts
  app/globals.css       Shared theme tokens and base styling
  components/game/      Game screen, session hook and dialogs
  components/lock/      Tumbler and pin visualization
  components/general/   Reusable UI and site navigation
  components/ui/        shadcn/Radix primitives
  components/lock-debug/ Development inspection tools
  game/                 Pure puzzle engine, progression and local persistence
  api/contracts.ts      Target API request/response types (no endpoints)
  i18n/                 Dictionaries, locale types and React provider
  assets/               Fonts and images
  proxy.ts              Locale routing

tests/                  Engine and React regression tests
docs/architecture/      Current state, target design and API contract
docs/agent/             Contribution workflow and agent documentation
```

### Puzzle generation

Locks start from a solved configuration. The generator creates symmetric move rules, then mixes the pins using legal moves. Reversing those moves provides a solution by construction. Difficulty grows through tumbler count, dependency density and solution-length targets.

The solver uses a bounded search. Exhausting its budget does not prove a lock unsolvable or establish an optimal solution. Difficulty calibration and scoring against verified solutions remain active work.

### Planned backend

The chosen target is one Next.js application on **Vercel**, using Route Handlers over HTTPS and **Neon PostgreSQL + Drizzle** for persistence. The browser will submit action intent; the server will own state, resources, rewards, run finalization and ranking. Players start anonymously without choosing a name. Following Game Over, only a server-qualified TOP 100 result prompts for a nickname; an accepted claim adds the verified run (not a permanent player profile) to the public ranking. A nickname is not authentication.

The [v1 API contract](docs/architecture/api-contract.md) defines run creation and reads, moves, reset, reward claiming, abandonment, leaderboard reads, ownership, error codes, versions and duplicate-action handling. [Shared DTOs](src/api/contracts.ts) describe the wire shapes but do not provide runtime validation or server guarantees.

## Roadmap and known limitations

The next major workstream is the [v1.1.0 leaderboard roadmap](docs/architecture/roadmap.md): database and session foundations, authoritative gameplay, client migration, verified ranking and deployment checks. Reward formulas, lockpick replenishment and some competitive scoring decisions remain open; see the [decision ledger](docs/architecture/decisions.md).

Known gameplay gaps include manual reset clearing partial pick damage and an offset between difficulty display bands and generator indexing. These are tracked in the [gameplay architecture notes](docs/architecture/gameplay.md). The current local implementation should not be treated as a competitive scoring system.

Audio playback and separate music/SFX controls are planned, not implemented.

## Contributing

Start with [AGENTS.md](AGENTS.md), the [architecture overview](docs/architecture/README.md) and the [working agreement](docs/agent/working-agreement.md). Keep changes focused and document whether they affect the current game or the target architecture.

- Keep domain logic independent of React, network and database code.
- Reuse existing UI components and theme tokens.
- Put user-facing text in all four dictionaries; use English as fallback.
- Read the version-matched Next.js guides in `node_modules/next/dist/docs/` before changing framework-specific behavior.
- Preserve working local flows until their server replacements are ready.
- Add regression coverage for changed behavior and report verification results honestly.

## Credits and asset usage

Created by [Dariusz Begiedza](https://begiedz.dev). Inspired by the Gothic series, Gothic Remake’s lockpicking mechanics, and Fingers Challenge.

This is a noncommercial fan project with no official affiliation with THQ Nordic or Piranha Bytes. Third-party names and assets remain subject to their owners’ rights. Noncommercial status and attribution do not grant redistribution permission; see the [asset provenance and licensing notes](docs/architecture/audio-assets.md) before adding or redistributing media.
