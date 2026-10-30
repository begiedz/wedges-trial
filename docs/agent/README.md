# Agent working guide (model agnostic)

## Routing

1. Read **root `AGENTS.md`** for stable requirements and constraints.
2. Read **`docs/architecture/status.md`** to distinguish current code from planned functionality.
3. Pick exactly the skills relevant to your work from the registry below; open their `SKILL.md` files.
4. Read the appropriate architecture page and affected source/test files.
5. Do small changes and follow `working-agreement.md` before finalizing.

Skills follow the open `SKILL.md` format (frontmatter with `name` and `description`). They are usable as ordinary markdown if a given tool has no native skill discovery. They do **not** rely on branded prompts, proprietary APIs or special model capabilities.

## Skill registry

| Area | Skill | Architecture |
| --- | --- | --- |
| Puzzle generation, move rules, progression | [game-engine](../../.agents/skills/game-engine/SKILL.md) | [gameplay](../architecture/gameplay.md) |
| Route Handlers, sessions, actions | [backend-api](../../.agents/skills/backend-api/SKILL.md) | [backend](../architecture/backend.md) |
| Drizzle, Neon, transactions | [database](../../.agents/skills/database/SKILL.md) | [data-model](../architecture/data-model.md) |
| React UI, route handling, controls | [frontend-ui](../../.agents/skills/frontend-ui/SKILL.md) | [architecture](../architecture/README.md) |
| Dictionaries, translations | [localization](../../.agents/skills/localization/SKILL.md) | [gameplay](../architecture/gameplay.md) |
| Unit/integration/performance tests | [testing-quality](../../.agents/skills/testing-quality/SKILL.md) | [security](../architecture/security.md) |
| Audio, assets, licensing | [audio-assets](../../.agents/skills/audio-assets/SKILL.md) | [audio/assets](../architecture/audio-assets.md) |
| Refactoring, scope control, PR workflow | [delivery](../../.agents/skills/delivery/SKILL.md) | [roadmap](../architecture/roadmap.md) |

## Responsibility, not persona

Skills prescribe *how to do work*, not an agent's identity or a specific language model. Multiple agents may collaborate, but each change should have an explicit scope and owner; hand off results as code, tests, notes and unresolved questions instead of assuming shared memory.
