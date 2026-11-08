# Competitive ranking contract (#51)

Approved by the task author on 2026-11-03: endless remains primary and ranks ore accumulation. On 2026-11-05 the task author expanded capacity from 100 to 1000 claimed runs and requested paginated browsing. This defines scoring and qualification, not a deployed leaderboard. `src/server/leaderboard/policy.ts` implements the pure policy; SQL ordering/storage (#31) and authenticated atomic eligibility/claims (#33) are implemented; post-Game Over nickname entry is implemented under #34; public reads and ranking UI remain under #24/#46.

## Scoring and eligibility

1. Use the immutable server-finished run, after the final pick breaks. Only credited ore counts. Pending loot, browser predictions and submitted scores never count. Abandonment does not qualify.
2. Order by ore DESC, opened chests DESC, finish instant ASC, run UUID ASC. PostgreSQL queries must use these exact tie breakers. Canonical lowercase UUID strings give the same final ordering in the policy. Do not use nickname, claim time, owner identity, move count or guessed optimum to break ties.
3. Use the single main ranking under `difficulty-ore-v1`; existing results retain their original ruleset. Apply tier bases 2/5/10/20 with the existing cumulative mistake penalty and pick replenishment. This decision introduces no efficiency penalty, run cap, new resource or bounded ranked challenge.
4. Count claimed runs only. With 0–999 claims, any valid finished run may claim, including zero ore. At capacity it must strictly outrank the 1000th. A UUID resolves otherwise identical results. Multiple runs from one owner and duplicate nicknames are allowed; a run can claim only once.
5. Eligibility is a snapshot. Before accepting a nickname, authenticate the live owning session, validate name/origin and recheck cutoff atomically with insertion. A provisional qualifier may lose eligibility. Keep displaced claims and query TOP 1000 rather than delete claims and allow resubmission. Never accept a caller-provided list of claims or result as trusted input to the policy.

The pure policy expects unique, persisted claimed-run projections and rejects inconsistent final results, unsafe score counters and unsupported candidate rulesets. Its snapshot calculation does not implement authorization, concurrency control, idempotency or storage. Those guarantees require the service transaction and database constraints.

## Sustainability and automation assessment

A perfect solver spends no picks. Starting with one, it can continue indefinitely even if replenishment were removed. Current random rewards grant 0/1/2 picks with probabilities 0.79/0.17/0.04, an expected 0.25 picks per credited chest. Ignoring end-of-run truncation and boundary effects, four invalid moves consume one pick, so roughly 1 invalid move per chest balances the expected grant. This expectation is not a finite-run guarantee or a calibrated survival distribution. Random grants affect survival and therefore ranking fairness; deterministic replenishment remains a separate balancing decision.

For historical chest-based cohorts, with n perfect chests credited, total ore is `10n + 5n(n-1)/2`, growing quadratically without a designed cap. Even the 40% mistake floor remains positive and grows with chest number. An efficiency penalty alone does not force a run to end. Players may intentionally break their remaining picks to finish and submit; unfinished runs take no public slot. Earlier finish time is only a tie breaker, not a speed score.

Public movement rules allow automated solving. Server authority prevents forged scores but cannot establish human play. Connection-level throttling limits bursts, not persistent or multi-session bots. A bounded challenge would cap score duration, but would still permit solvers and is not part of the selected v1 mode. Optimum-based ranking also depends on reliable shortest paths, which capped solver searches do not guarantee.

Before competitive release, measure generation/solver costs and fallback rates across early and late chests (#48/#50), long-run score/pick distributions, and distributed abuse limits/monitoring (#43). Choose measured controls separately; do not claim this policy solves automation or that random sustain is competitively calibrated. Numeric overflow is an operational risk for arbitrarily long runs: unsafe final counters fail qualification rather than silently round a competitive score; runtime storage bounds need their own measured handling.

## Metrics, expiry and version boundaries

Retain server-recorded ore, opened chests, total/per-chest moves, invalid moves and broken picks. Valid moves can be derived as moves minus invalid moves. Do not persist or rank “extra moves” without a verified optimum; null solver output proves no optimum. Resets preserve penalties and continuation preserves partial pick damage.

No new claim TTL or automatic deletion is introduced. Existing 30-day anonymous session expiry limits authenticated access; qualification does not extend it or reserve a place. The conservative manual retention policy under #31 preserves active runs, live-session retry/submission access, claimed-run references and one-claim history. A future claim-expiry policy must be explicit in the API/UI before enforcement.

The main ranking uses `difficulty-ore-v1`; old results/claims/replays are preserved separately under `learning-ramp-v1`, `scarce-picks-v1` and `deterministic-ore-v1`. Tier-based ore is bounded at 20 per chest (8 at the 40% mistake floor for Tier 4); perfect endless runs still have no designed end, so cumulative ore remains unbounded. Future score-affecting reward, replenishment, difficulty or run-limit changes require a version review, a new cohort for incomparable runs and an explicit rollout; never rewrite historical results. This pre-release change needs no SQL migration or data backfill. Rollback switches new-run/ranking defaults while retaining all handlers needed by saved runs; see decisions.md.

## Linked issue alignment and verification

| Issue | Contract for subsequent implementation |
| --- | --- |
| #24 | Replace provisional ordering with the approved order above; use ruleset-scoped TOP 1000, retained claims, unique run ID and atomic recheck. Test real concurrent claims, 0/99/100/999/1000/1001 entries, pagination and replay. |
| #34 | Keep anonymous first visit, nickname only after qualifying Game Over; localize lost-qualification, expired-session and network states. Names are nonunique labels. |
| #46 | Public reads return claimed runs from one cohort with stable snapshot pagination; private eligibility reserves nothing; claim accepts nickname/action ID only and enforces ownership, origin and transaction guarantees. |
| #47 | deterministic-ore-v1 remains approved; no excess-valid-move penalty. Random pick replacement remains open and would require cohort review. |

This table aligns local implementation guidance with the linked backlog without editing those GitHub issues. `tests/server/leaderboard/policy.test.ts` covers ordering, chronological timestamp comparison, cutoff sizes, ties, duplicate claims, multiple runs per owner, invalid states, ruleset isolation and a changed-cutoff recheck. Existing engine tests cover deterministic ore, preserved damage/penalties and reward-once transitions. Real PostgreSQL/API tests under #33 now cover ownership, expiry/revocation, snapshot cutoff loss, concurrent claims, exact replay and rollback. Public pagination/UI tests remain #24/#34/#46; local tests do not establish deployment.
