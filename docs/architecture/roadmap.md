# Roadmap and GitHub workstream

Repository: https://github.com/begiedz/wedges-trial

## Progress after server transition — 2026-11-01

Implemented: anonymous sessions, gameplay schema/transactions, authoritative run lifecycle, deterministic ore, persisted metrics, browser persistence removal, WebSocket transport and visual prediction. This does not complete the entire leaderboard milestone or every issue touching those layers. See [status](status.md).

Next: ranking storage/query, finished-run qualification and atomic nickname claims, ranking UI, distributed security controls and production verification. Balance/solver calibration and asset rights remain separate work. The issue list below describes workstreams, not an assertion that every item is still unimplemented.

## Milestone: v1.1.0 - Leaderboard

1. **Project contract and feasibility:** #27 (instructions), #28 (generator benchmark), #29 (API contract).
2. **Foundation:** #30 (Neon environments), #31 (schema), #32 (transaction semantics), #33 (anonymous sessions), #34 (post-Game Over nickname claim).
3. **Authoritative engine:** #35 (run start/restore), #36 (moves), #37 (safe reset), #38 (rewards), #39 (Game Over).
4. **Frontend migration:** #40 (GameClient), #41 (remove localStorage).
5. **Ranking:** #24 (SQL ranking), #46 (read, eligibility and claim API), #25 (UI), #7 (dialogs).
6. **Quality and deploy:** #42 (integration testing), #43 (security), #44 (deploy), #45 (operations/docs).
7. **Game-balance work:** #47 (deterministic rewards), #48 (progression), #49 (move metrics), #50 (generator/solver), #51 (ranking design and pure snapshot policy implemented; persistence/API work remains under #24/#46).

## Separate audio/asset backlog

- #52 licensing/provenance audit of existing and proposed assets.
- #53 soundtrack player and menu preferences.
- #54 semantic gameplay SFX.

## Ordering rules

- Avoid building public ranking on unverified client scores.
- Do not prompt nickname on first visit; claim leaderboard placement after a qualifying server-verified Game Over only.
- Rank claimed runs, not one best score per persistent player. Recheck dynamic TOP 100 cutoff atomically at claim time.
- Finalize scoring semantics and verified solver metadata before freezing competitive score formula.
- Keep server persistence as the source of truth; the legacy local save has been removed.
- Do not publish Gothic Remake recordings while clearance is unresolved; the audio player can be built against licensed placeholders.

A milestone tracks deliverables, not automatically a release date. Validate actual issue status in GitHub; this file is a navigation snapshot.
