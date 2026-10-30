# Roadmap and GitHub workstream

Repository: https://github.com/begiedz/wedges-trial

## Milestone: v1.1.0 - Leaderboard

1. **Project contract and feasibility:** #27 (instructions), #28 (generator benchmark), #29 (API contract).
2. **Foundation:** #30 (Neon environments), #31 (schema), #32 (transaction semantics), #33 (anonymous sessions), #34 (nickname).
3. **Authoritative engine:** #35 (run start/restore), #36 (moves), #37 (safe reset), #38 (rewards), #39 (Game Over).
4. **Frontend migration:** #40 (GameClient), #41 (remove localStorage).
5. **Ranking:** #24 (SQL ranking), #46 (read API), #25 (UI), #7 (dialogs).
6. **Quality and deploy:** #42 (integration testing), #43 (security), #44 (deploy), #45 (operations/docs).
7. **Game-balance work:** #47 (deterministic rewards), #48 (progression), #49 (move metrics), #50 (generator/solver), #51 (ranking design).

## Separate audio/asset backlog

- #52 licensing/provenance audit of existing and proposed assets.
- #53 soundtrack player and menu preferences.
- #54 semantic gameplay SFX.

## Ordering rules

- Avoid building public ranking on unverified client scores.
- Finalize scoring semantics and verified solver metadata before freezing competitive score formula.
- Implement server persistence and action endpoints before deleting legacy local save.
- Do not publish Gothic Remake recordings while clearance is unresolved; the audio player can be built against licensed placeholders.

A milestone tracks deliverables, not automatically a release date. Validate actual issue status in GitHub; this file is a navigation snapshot.
