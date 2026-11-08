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

## GitHub Issue Implementation

When implementing a GitHub Issue:

1. Read the complete issue, including requirements, dependencies, checklists, Acceptance Criteria, and Definition of Done.

2. Analyze the affected codebase and relevant documentation.

3. Map every requirement and acceptance criterion to implementation tasks and verification methods.

4. Execute the complete approved scope incrementally. Do not stop after planning.

5. Follow project architecture and coding conventions. Preserve existing functionality and invariants.

6. Add or update tests for affected behavior.

7. Execute applicable quality checks using the testing-quality skill.

8. Review the original issue against the final changes.

## Acceptance Criteria Verification

For every acceptance criterion, provide:

- Criterion
- Status: PASS / FAIL / NOT VERIFIED
- Evidence: code changes, tests, or verification results

Never mark a criterion as PASS without evidence.

Do not declare the issue complete while mandatory criteria
remain failed or unverified.

Report blockers, limitations, and unexecuted checks honestly.


## Done when

- Another agent can resume the work from the PR/issue and docs without hidden context.
