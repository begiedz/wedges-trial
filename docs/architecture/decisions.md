# Product and architecture decisions

This is the **decision ledger**. Do not upgrade a proposal into an invariant without an explicit product decision and updated tests.

## Decided target (accepted)

| Decision | Meaning | Related issues |
| --- | --- | --- |
| Next.js + Vercel | One project, Route Handlers; no required WebSockets or dedicated Docker backend | #27–#30 |
| Neon + Drizzle | PostgreSQL for anonymous sessions, authoritative runs and claimed ranking entries | #30–#32 |
| Server authority | Browser sends actions only; server computes transitions and score | #35–#42 |
| No client save | Remove gameplay `localStorage`; restore from server session | #40, #41 |
| Anonymous gameplay | Opaque HttpOnly session cookie; no login or nickname before play | #33, #34 |
| Arcade name entry | Ask nickname only when a finished server-verified run qualifies for TOP 100; no permanent public player profile required | #24, #34, #46 |
| Run-based leaderboard | Rank claimed finished runs; multiple runs may share nickname or anonymous owner | #24, #25 |
| Endless primary mode | Random solvable puzzles, escalating difficulty | #48, #51 |
| Game resources | Ore nuggets and lockpicks only; ore is rank score | #24, #47 |
| Three invalid moves | A pick breaks on exactly three out-of-bounds attempts | #36, #37 |
| Reset fairness | Reset cannot refund spent picks or erase damage/penalties | #37, #49 |
| Deterministic ore direction | Remove random ore bonuses; base rises by chest, efficiency matters | #47, #49 |
| Audio opt-in | Independent music/SFX toggles and volume; no surprise autoplay | #53, #54 |
| Third-party asset rights | Obtain and document sufficient rights before distribution | #52 |

## Open (do not hardcode)

1. **Exact reward function:** base ore curve, penalties per mistake and extra valid move, minimum floor, rounding. Candidate values in #47 are examples only.
2. **Lockpick replenishment:** predictable grant schedule vs another deterministic mechanic; total sustain/balance is unresolved.
3. **Competitive scoring order:** run-based arcade TOP 100 is accepted, but ranking by ore / endless survival versus efficiency or separate bounded mode remains unresolved (#51). Provisional ordering is ore DESC, opened chests DESC, finished_at ASC, run ID ASC.
4. **Difficulty tiers:** precise chest thresholds, optional milestone chests, minimum shortest-path length and acceptance criteria require calibration (#48, #50).
5. **Solver optimum:** whether reliable optimum is computed for every lock and how to score if budget is exhausted (#50).
6. **Run limits/anti-bot:** rate limit thresholds and possible fairness controls require measurement (#43, #51).
7. **Media assets:** approval of specific Gothic Remake music/SFX/art or replacements (#52–#54).

## Change procedure

- Record a proposed change, relevant options, tradeoffs and tests in an issue/PR.
- Make the product decision explicitly before changing a rule marked *decided*.
- Update this ledger, `AGENTS.md` (only if core rules change), gameplay docs, tests and UI copy together.
- For changed ranking/rewards, decide whether scores require a `rulesetVersion` split to avoid mixing incomparable runs.

## Arcade TOP 100 qualification (accepted)

- Under 100 claimed entries: every valid server-finished run may claim a place. At 100 entries: a run must outrank the current last entry under deterministic ordering.
- Game Over eligibility is a snapshot, not a reservation. On nickname submission the backend must recheck atomically; racing submissions may displace a provisional qualifier.
- No unclaimed run appears in public results. Duplicate submissions for a run are prevented. Names do not establish identity or uniqueness.
- Safe deletion/expiry of old, unqualified run records is allowed after preserving active sessions, claims and required replay windows. Exact TTL remains an implementation decision.
