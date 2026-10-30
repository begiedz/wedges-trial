---
name: delivery
description: Use when planning an issue, scoping an implementation, refactoring across layers, preparing a PR, or updating agent instructions and architecture decisions.
---

# Delivery and change management skill

Read `AGENTS.md`, `docs/architecture/status.md`, `decisions.md`, `docs/agent/working-agreement.md` and current GitHub issue.

## Procedure

1. Describe current code, target, out-of-scope work and acceptance criteria; avoid creating duplicates of existing issues.
2. Choose an incremental, reviewable change rather than large rewrites. Respect dependencies between DB, server APIs, UI migration and leaderboard.
3. Mark product decisions as approved, proposed or blocked. Ask for a decision if necessary; otherwise implement only approved scope.
4. Update architecture/skill docs when implementation changes what is currently true; don't leave target-only statements implying deployment.
5. Include tests and migration/rollback instructions when changing DB or scoring behavior.
6. Summarize changed files, tests and known limitations. Do not fabricate CI, deployment, issue or approval outcomes.

## Done when

- Another agent can resume the work from the PR/issue and docs without hidden context.
