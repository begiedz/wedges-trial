# Roadmap and GitHub workstream

Repository: https://github.com/begiedz/wedges-trial

## Current focus — 2026-11-09

Gameplay, anonymous ownership, qualifying nickname claims and the public TOP 1000 screen are implemented. See [current status](status.md) for verification limits. Simplification retires benchmark infrastructure, frozen ranking traversal and per-move response history. Frontend components remain unchanged.

Remaining: deployed gameplay/recovery and production checks, proportionate abuse controls, human balance calibration and asset rights. Expiry deadlines, compact terminal storage and cohort retirement remain separate decisions. The issue list below is historical workstream navigation, not live issue status or an instruction to recreate retired measurement features.

## Milestone: v1.0.0 - Leaderboard

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
- Rank claimed runs, not one best score per persistent player. Recheck dynamic TOP 1000 cutoff atomically at claim time.
- Finalize scoring semantics and verified solver metadata before freezing competitive score formula.
- Keep server persistence as the source of truth; the legacy local save has been removed.
- Do not publish Gothic Remake recordings while clearance is unresolved; the audio player can be built against licensed placeholders.

A milestone tracks deliverables, not automatically a release date. Validate actual issue status in GitHub; this file is a navigation snapshot.
