# Product and architecture decisions

This is the **decision ledger**. Do not upgrade a proposal into an invariant without an explicit product decision and updated tests.

## Decided target (accepted)

| Decision | Meaning | Related issues |
| --- | --- | --- |
| Next.js + Vercel | One project, Route Handlers and Vercel-native WebSockets; no dedicated Docker backend | #27–#30 |
| Neon + Drizzle | PostgreSQL for anonymous sessions, authoritative runs and claimed ranking entries | #30–#32 |
| Server authority | Browser sends actions only; server computes transitions and score | #35–#42 |
| No client save | Remove gameplay `localStorage`; restore from server session | #40, #41 |
| Anonymous gameplay | Opaque HttpOnly session cookie; no login or nickname before play | #33, #34 |
| Arcade name entry | Ask nickname only when a finished server-verified run qualifies for TOP 100; no permanent public player profile required | #24, #34, #46 |
| Run-based leaderboard | Rank claimed finished runs; multiple runs may share nickname or anonymous owner | #24, #25 |
| Endless primary mode | Random solvable puzzles, escalating difficulty; ore-based survival ranking, no bounded ranked mode for v1 | #48, #51 |
| Game resources | Ore nuggets and lockpicks only; ore is rank score | #24, #47 |
| Three invalid moves | A pick breaks on exactly three out-of-bounds attempts | #36, #37 |
| Reset fairness | Reset cannot refund spent picks or erase damage/penalties | #37, #49 |
| Deterministic ore (approved and implemented) | deterministic-ore-v1 formula below; chest progression and cumulative invalid moves determine ore | #47, #49 |
| Audio opt-in | Independent music/SFX toggles and volume; no surprise autoplay | #53, #54 |
| Third-party asset rights | Obtain and document sufficient rights before distribution | #52 |

## Open (do not hardcode)

1. **Further reward tuning:** the deterministic ore formula below is approved for `deterministic-ore-v1`; excess-valid-move penalties and future recalibration remain open.
2. **Lockpick replenishment:** predictable grant schedule vs another deterministic mechanic; total sustain/balance is unresolved.
3. **Competitive scoring order (resolved 2026-11-03):** endless ore ranking is approved; see the #51 decision below. A bounded challenge or efficiency ranking would be a separate future product decision.
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

## Approved implementation decision — 2026-11-01

The task author approved deterministic ore: `base = 10 + 5 * (chestNumber - 1)`, `ore = floor(base * max(0.4, 1 - 0.1 * invalidMovesOnChest))`. Implementation uses integer tenths to avoid floating-point floor errors. Ruleset: `deterministic-ore-v1`. All invalid moves survive resets and pick breaks; no excess-valid-move penalty is applied. Lockpick reward probabilities remain the existing behavior pending a separate balancing decision. This approval supersedes open item 1 for this ruleset. The later #51 decision below settles leaderboard ordering; release balance remains open.

## Approved transport direction — 2026-11-01

The task author explicitly requested WebSockets after testing the blocking per-move HTTPS UI. Use Vercel-native WebSockets for gameplay, ordered input buffering and immediate visual prediction with authoritative reconciliation. The server remains responsible for every committed action, resource, reward and final result. Public movement mechanics may be sent to the owner to predict visuals; internal solver paths/seeds remain private. No separate WebSocket hosting service is required by the chosen implementation.

## Approved competitive scoring decision — 2026-11-03 (#51)

The task author selected endless ore ranking. Keep endless as the primary mode; v1 has no bounded ranked challenge, duration cap, or excess-valid-move/optimum penalty. Rank each claimed, server-finished run by **credited ore DESC, opened chests DESC, finished_at ASC, run UUID ASC**. Finish time compares instants, not timestamp strings; UUIDs use PostgreSQL UUID order (canonical lowercase in TypeScript). Names and owner IDs never break ties or deduplicate entries. Zero-ore finished runs qualify while space exists. Abandoned and active runs never qualify.

The pure policy is implemented in `src/server/leaderboard/policy.ts`: it projects a persisted final result, compares ranks and evaluates a snapshot of claimed runs. The policy is not an endpoint or an atomic claim service. Snapshot eligibility reserves nothing. Retain displaced claims (query only TOP 100) so one run cannot reclaim; claim uniqueness and cutoff recheck must share a database transaction under #24/#46. Compare only the same ruleset. The active cohort remains `deterministic-ore-v1`, since this decision changes no gameplay rewards. Any future change to ore, replenishment, difficulty or run limits that affects score comparability requires a new ruleset and separate ranking cohort, rather than silently mixing historic scores.

Retain current random pick replenishment for this cohort; a deterministic replacement and calibration remain open. This ranking measures endless survival and ore accumulation, not equal-puzzle efficiency or freedom from luck. See [competitive ranking](competitive-ranking.md) for sustain analysis, release risks and linked implementation contracts.
