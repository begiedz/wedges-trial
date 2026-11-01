# Wedge’s Trial

An endless browser lockpicking puzzle inspired by Gothic Remake’s lock mechanics and [Fingers Challenge](https://fingerschallenge.com).

Open a chest, collect its ore, and face a harder lock. Connected tumblers turn each move into a small logic puzzle: shifting one pin can move several others. Your goal is to gather as many **ore nuggets** as possible before your last lockpick breaks.

## Project status

Gameplay now runs on an authoritative server with Neon PostgreSQL persistence. Anonymous sessions resume committed moves, damage and resources. Vercel-native WebSockets provide ordered input with immediate visual prediction; the server confirms rewards and results. Browser gameplay saves have been removed.

The global leaderboard, TOP 100 qualification and nickname claims remain planned. Development database/HTTPS flows and local native WebSockets have been verified; this does not establish production readiness. See [implementation status](docs/architecture/status.md) and [server setup](docs/architecture/server-setup.md).

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

### Server persistence

Every accepted move and lifecycle action is persisted atomically. Refresh restores the last committed state, including partial pick damage and scoring penalties. Reset preserves damage and spent resources. The anonymous HttpOnly cookie owns the run; clearing it or letting it expire loses access. No old local save is imported.

## Run locally

Use **Node.js 22** (the version used by CI) and **pnpm 10.18.3** (pinned in `package.json`).

```bash
git clone https://github.com/begiedz/wedges-trial.git
cd wedges-trial
pnpm install --frozen-lockfile
cp .env.example .env
# Configure development database URLs, then:
pnpm db:migrate
# Set APP_ORIGIN=http://localhost:3000 in .env.local
pnpm dev:ws
```

Open [localhost:3000/en/game](http://localhost:3000/en/game) to play, or [localhost:3000/en](http://localhost:3000/en) for the home page.

Gameplay requires PostgreSQL. Direct and pooled URLs must reference the same development Neon branch/database. No Docker service is needed. The [setup guide](docs/architecture/server-setup.md) explains environment precedence, migrations, Vercel CLI linking and troubleshooting. Plain pnpm dev supports HTTP fallback; native WebSocket testing requires pnpm dev:ws.

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
| `pnpm dev` | Start Next.js with HTTP gameplay fallback |
| `pnpm dev:ws` | Start Vercel CLI for native WebSocket development |
| `pnpm db:generate` | Generate reviewable Drizzle migrations after schema changes |
| `pnpm db:migrate` | Apply committed migrations to the configured database |
| `pnpm test` | Run the Vitest suite |
| `pnpm exec tsc --noEmit` | Check TypeScript types |
| `pnpm lint` | Check formatting, imports and lint rules with Biome |
| `pnpm format` | Apply formatting across the repository |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve an existing production build locally |

The app uses `next/font/google` for Noto Serif and a local heading font. A fresh build may need network access to fetch the Google font.

### Tests and quality checks

Tests cover pin dependencies, valid and invalid moves, pick damage and breakage, generated lock solvability, difficulty progression, solver behavior, server persistence, authorization, idempotency, concurrency, rollback and reset behavior. WebSocket tests cover burst input, prediction and reconnect/replay. Set TEST_DATABASE_URL explicitly to enable the isolated-schema PostgreSQL suite; otherwise it is skipped. React tests cover reward claims, duplicate inputs, dialog interactions, keyboard handling and restart flows.

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
  game/                 Pure puzzle engine, progression and reward functions
  api/                  HTTP and WebSocket wire types
  app/api/              Gameplay HTTP handlers and socket upgrade
  client/game/          Ordered transport, prediction and reconciliation
  server/               Validation, authoritative service and Drizzle persistence
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

### Server architecture and remaining work

One Next.js application on Vercel owns run transitions through Route Handlers and native WebSockets, backed by Neon PostgreSQL and Drizzle. Anonymous cookies authorize actions; the client sends intent with action IDs and expected versions. Transactions persist state and replay responses together. Public movement rules support rendering prediction; resources and final outcomes remain server-confirmed.

Ore follows the approved deterministic formula: base 10, +5 per later chest, minus 10 percentage points per invalid move, with a 40% floor. Pick replenishment retains its previous random behavior pending a separate balance decision. See [gameplay](docs/architecture/gameplay.md) and the [decision ledger](docs/architecture/decisions.md).

The [v1.1.0 roadmap](docs/architecture/roadmap.md) tracks remaining ranking storage/APIs/UI, distributed rate limits, deployment checks, difficulty calibration and solver evidence. Only qualifying verified finished runs will be allowed to claim a nickname for the planned arcade TOP 100. Audio playback and independent music/SFX controls remain planned; asset licensing requires an audit.

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
