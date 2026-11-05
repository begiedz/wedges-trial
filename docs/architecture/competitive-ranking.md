# Competitive ranking contract (#51)

Approved by the task author on 2026-11-03: endless remains primary and TOP 100 ranks ore accumulation. This defines scoring and qualification, not a deployed leaderboard. `src/server/leaderboard/policy.ts` implements the pure policy; claims, SQL ordering, public reads and UI remain under #24, #34 and #46.

## Scoring and eligibility

1. Use the immutable server-finished run, after the final pick breaks. Only credited ore counts. Pending loot, browser predictions and submitted scores never count. Abandonment does not qualify.
2. Order by ore DESC, opened chests DESC, finish instant ASC, run UUID ASC. PostgreSQL queries must use these exact tie breakers. Canonical lowercase UUID strings give the same final ordering in the policy. Do not use nickname, claim time, owner identity, move count or guessed optimum to break ties.
3. Compare only one ruleset cohort, currently deterministic-ore-v1. Preserve the approved integer ore formula and existing pick replenishment. This decision introduces no efficiency penalty, run cap, new resource or bounded ranked challenge.
4. Count claimed runs only. With 0–99 claims, any valid finished run may claim, including zero ore. At capacity it must strictly outrank the 100th. A UUID resolves otherwise identical results. Multiple runs from one owner and duplicate nicknames are allowed; a run can claim only once.
5. Eligibility is a snapshot. Before accepting a nickname, authenticate the live owning session, validate name/origin and recheck cutoff atomically with insertion. A provisional qualifier may lose eligibility. Keep displaced claims and query TOP 100 rather than delete claims and allow resubmission. Never accept a caller-provided list of claims or result as trusted input to the policy.

The pure policy expects unique, persisted claimed-run projections and rejects inconsistent final results, unsafe score counters and unsupported candidate rulesets. Its snapshot calculation does not implement authorization, concurrency control, idempotency or storage. Those guarantees require the service transaction and database constraints.

## Sustainability and automation assessment

A perfect solver spends no picks. Starting with three, it can continue indefinitely even if replenishment were removed. Current random rewards grant 0/1/2 picks with probabilities 0.58/0.34/0.08, an expected 0.5 picks per credited chest. Ignoring end-of-run truncation and boundary effects, three invalid moves consume one pick, so roughly 1.5 invalid moves per chest balances the expected grant. This expectation is not a finite-run guarantee or a calibrated survival distribution. Random grants affect survival and therefore ranking fairness; deterministic replenishment remains a separate balancing decision.

With n perfect chests credited, total ore is `10n + 5n(n-1)/2`, growing quadratically without a designed cap. Even the 40% mistake floor remains positive and grows with chest number. An efficiency penalty alone does not force a run to end. Players may intentionally break their remaining picks to finish and submit; unfinished runs take no public slot. Earlier finish time is only a tie breaker, not a speed score.

Public movement rules allow automated solving. Server authority prevents forged scores but cannot establish human play. Connection-level throttling limits bursts, not persistent or multi-session bots. A bounded challenge would cap score duration, but would still permit solvers and is not part of the selected v1 mode. Optimum-based ranking also depends on reliable shortest paths, which capped solver searches do not guarantee.

Before competitive release, measure generation/solver costs and fallback rates across early and late chests (#48/#50), long-run score/pick distributions, and distributed abuse limits/monitoring (#43). Choose measured controls separately; do not claim this policy solves automation or that random sustain is competitively calibrated. Numeric overflow is an operational risk for arbitrarily long runs: unsafe final counters fail qualification rather than silently round a competitive score; runtime storage bounds need their own measured handling.

## Metrics, expiry and version boundaries

Retain server-recorded ore, opened chests, total/per-chest moves, invalid moves and broken picks. Valid moves can be derived as moves minus invalid moves. Do not persist or rank “extra moves” without a verified optimum; null solver output proves no optimum. Resets preserve penalties and continuation preserves partial pick damage.

No new claim TTL or automatic deletion is introduced. Existing 30-day anonymous session expiry limits authenticated access; qualification does not extend it or reserve a place. Safe retention remains open: preserve active ownership, retry records, claimed-run references and one-claim history. A future claim-expiry policy must be explicit in the API/UI before enforcement.

Keep deterministic-ore-v1 as the comparison cohort. Future score-affecting reward, replenishment, difficulty or run-limit changes require a version review, a new cohort for incomparable runs and an explicit rollout; never rewrite historical results. This policy needs no SQL migration or data backfill. Rollback removes the unused policy and documentation; it does not alter stored gameplay or rewards.

## Linked issue alignment and verification

| Issue | Contract for subsequent implementation |
| --- | --- |
| #24 | Replace provisional ordering with the approved order above; use ruleset-scoped TOP 100, retained claims, unique run ID and atomic recheck. Test real concurrent claims, 0/99/100/101 entries, pagination and replay. |
| #34 | Keep anonymous first visit, nickname only after qualifying Game Over; localize lost-qualification, expired-session and network states. Names are nonunique labels. |
| #46 | Public reads return claimed runs from one cohort with stable snapshot pagination; private eligibility reserves nothing; claim accepts nickname/action ID only and enforces ownership, origin and transaction guarantees. |
| #47 | deterministic-ore-v1 remains approved; no excess-valid-move penalty. Random pick replacement remains open and would require cohort review. |

This table aligns local implementation guidance with the linked backlog without editing those GitHub issues. `tests/server/leaderboard/policy.test.ts` covers ordering, chronological timestamp comparison, cutoff sizes, ties, duplicate claims, multiple runs per owner, invalid states, ruleset isolation and a changed-cutoff recheck. Existing engine tests cover deterministic ore, preserved damage/penalties and reward-once transitions. Database claim races and API/UI tests remain required by #24/#34/#46; pure tests are not evidence of atomic claims or deployment.
