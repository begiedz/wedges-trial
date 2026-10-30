# Wedge's Trial — portable agent documentation kit

This directory is a **ready-to-copy overlay** for the existing `begiedz/wedges-trial` repository, designed to be **LLM/tool agnostic**. It consists only of Markdown and portable Agent Skills. No game source files, third-party fonts, images or audio are included.

## Installation

1. Extract the archive. **Copy its contents** into the *root of the repository*, keeping the hidden `.agents`, `.cursor`, and `.github` folders.
2. Replace the existing `AGENTS.md`; the existing `CLAUDE.md` becomes a slightly more descriptive compatibility pointer. Review the diff before committing.
3. **Do not replace** the project's root `README.md`; the package contains `README_AGENT_PACKAGE.md` and new architecture/agent docs instead.
4. Keep `.github/workflows/test.yml` intact; merging the new Copilot instructions into `.github/` does not replace the workflow.
5. Commit the documentation, then tackle issue #27 and the backend/gameplay tasks incrementally. **This package does not implement backend, DB or audio.**

Example from inside a local checkout (after extracting next to it):

```sh
cp -R ../wedges-trial-agent-kit/. ./
git status --short
git diff -- AGENTS.md CLAUDE.md
```

For Windows, copy the contents via Explorer or an equivalent recursive copy command, including hidden directories.

## Navigation

- `AGENTS.md` — one canonical policy for all supported agent systems.
- `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/project.mdc` — **thin optional compatibility adapters**, no duplicated rules.
- `.agents/skills/*/SKILL.md` — open Agent Skills format: `name`, `description`, task-specific guidance and checks.
- `docs/architecture/` — product and technical design, current status, decisions, constraints, security, licensing.
- `docs/agent/` — skill registry, workflows, change checklist, issue/PR template.

Agent Skills discovery is **tool dependent**. Agents that do not automatically load `.agents/skills/` can still follow the same Markdown documents manually or via `AGENTS.md` references. The kit does not depend on a proprietary skill loader.

## Critical separation

- **CURRENT:** Next.js/React game runs client-side with `localStorage`; no Neon-backed authoritative endpoints yet.
- **DECIDED TARGET:** Vercel Functions, Neon PostgreSQL, Drizzle, secure anonymous cookies, server-side moves/score, global ranking.
- **DESIGN DIRECTION (not numeric contract):** deterministic ore, mistakes/efficiency, balanced progression; evaluate through tests/simulation.
- **BLOCKED UNTIL PERMISSION:** distributing music/SFX/other extracted game assets unless adequate licenses are documented.

See `docs/architecture/status.md` and `docs/architecture/decisions.md` before generating code.

## Compatibility and maintenance

`AGENTS.md` is plain Markdown and recognized by several agent tools. The adapters exist because some products prefer native filenames. Keep everything centralized in `AGENTS.md`, with longer detail in docs and skills. **Never edit adapters to establish different rules.**

Before publishing a new version of this kit, verify paths against `master`, update statuses, run a link/metadata check, and ensure no unlicensed game resources or secrets are included.

Official specifications: [Agent Skills](https://agentskills.io/), [GitHub Copilot custom instructions](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions), [Cursor rules](https://cursor.com/docs/rules).
