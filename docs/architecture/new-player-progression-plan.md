# New-player progression proposal — issue #48 (2026-11-07)

Status: **implemented locally on 2026-11-08 at the task author’s request**. The original proposal below is retained as planning history. See [implementation, measured deviations and pending acceptance](https://github.com/begiedz/wedges-trial/blob/32b909d/docs/architecture/learning-progression-report.md). Human calibration remains pending. Scope: reduce difficulty spikes while preserving the current lockpick balance. Related: [issue #48](https://github.com/begiedz/wedges-trial/issues/48), [difficulty evidence](https://github.com/begiedz/wedges-trial/blob/32b909d/docs/architecture/lock-validation.md), [performance evidence](https://github.com/begiedz/wedges-trial/blob/32b909d/docs/architecture/lock-benchmarks.md).

## Evidence and version boundary

The checked-out engine uses fixed 4/5/6/7-plate stages at displayed chests 1/6/13/25. Its post-#61 survey contains 1,000 locks at each checkpoint:

| Chest transition | Plates | Mean cross effects per slide | Median verified solution |
| --- | --- | --- | --- |
| 5 → 6 | 4 → 5 | 1.09 → 1.54 (+41%) | 6 → 8 moves (+33%) |
| 12 → 13 | 5 → 6 | 2.08 → 2.72 (+31%) | 10 → 10 moves |
| 24 → 25 | 6 → 7 | 3.35 → 4.11 (+23%) | 12 → 12 moves |

Connection complexity can jump even when solution length stays constant. Adding plates, increasing density and lengthening solutions together is therefore a plausible cause of the difficulty spike. These are structural measurements, not evidence of player failure rates or perceived difficulty.

Issue #48 also reports unpublished `connections-v2` and corrected `connections-v3` work. Its correction requires a nondecreasing structural floor, including a four-plate connected core, six directional dependencies and Tier 3 at chest 18; unrestricted later Beginner rolls were rejected. Those implementations and raw artifacts are absent from this checkout; `progression-floor.md` was also unavailable on the remote default branch when reviewed. Their issue-reported performance is provisional evidence here, not independently verified code or benchmarks. Reconcile that work before implementation rather than recreating it blindly.

The current user instruction narrows this plan to progression. Preserve one starting pick, four invalid moves per pick, 79%/17%/4% drops of 0/1/2 picks, uncapped inventory, carried damage, reset penalties and deterministic ore. Do not adopt the issue's older starting-stock or tier-dependent drop proposals. Saved rulesets retain their own existing resource behavior.

## Recommended player experience

Teach connections before increasing the number of interacting plates. Keep four visible plates for the opening chests, with only one connected pair and the remaining plates independent. Start with a same-direction relationship; introduce an opposite-direction relationship after the player has encountered the first pattern. Randomize identities and starting layouts within those constraints.

Then grow a connected core gradually. Total visible plate count may vary later, but it does not set the difficulty tier. Seven plates with only one connected pair remain structurally Beginner; that topology is eligible only while the progression floor permits it. Later runs retain a minimum structural challenge instead of periodically rolling an opening-level lock.

Preserve the existing difficulty display. Classify actual immutable movement rules on the server and keep the assigned tier stable through moves, resets, refreshes and retries. A graph path describes structural coupling; movement still applies only the selected rule's direct effects.

### Candidate calibration anchors

All chest numbers below are one-based. These are candidate generation settings, not measured output or approved thresholds. The connected core is the largest undirected component. Count directional dependencies from one movement direction, excluding self-effects; inverse rules do not count twice. Reciprocal dependencies are two directional edges but one undirected connection.

| Chest anchor | Eligible total plates | Required core size | Directional dependency budget | Requested shortest-path window | Learning goal |
| ---: | --- | ---: | ---: | --- | --- |
| 1 | 4 | 2 | 1 | 2–4 | Observe one connected pair |
| 3 | 4 | 2 | 1 | 3–4 | Practice the same relationship |
| 5 | 4 | 3 | 2 | 3–5 | Coordinate a third plate |
| 8 | 4–5 | 3 | 3 | 4–6 | Practice a small network |
| 12 | 4–6 | 4 | 4 | 5–7 | Introduce a larger core |
| 15 | 4–6 | 4 | 5 | 5–7 | Add a connection before length |
| 18 | 4–6 | 4 | 6 | 6–8 | Reach the issue's Tier 3 floor |
| 24 | 5–7 | 5 | 8 | 7–9 | Grow the coupled group |
| 30 | 5–7 | 5 | 10 | 8–10 | Consolidate larger networks |
| 50 | 6–7 | 6 | 14 | 9–12 | Established endless play |
| 100+ | 7 | 7 | 18 | 10–16 | Bounded mature challenge |

Between anchors, distribute integer connection additions across chests; add at most one dependency per chest. A core increase uses that chest's new connection to attach one plate. At core increases, hold solution targets and fanout steady, then lengthen solutions on later chests. Stagger rounded length changes rather than letting interpolation increase several axes on the same chest.

Cap the number of other plates affected by one slide at one through chest 5, two through chest 18, and three thereafter. A spanning backbone guarantees the required core; distribute remaining edges within it without exceeding the budget or fanout. Keep other plates isolated during this first calibration pass. Match the existing structural classifier to the required tier floor; if an anchor cannot satisfy it, revise the proposal before accepting generated locks. Do not override the classifier with a cosmetic chest-number label.

When an additional visible plate becomes eligible, introduce it as an isolated plate initially at its target. Keep the connection budget and path window unchanged for that introduction. This lets the player encounter the larger layout before it becomes part of the interacting core. Use gradually changing plate-count weights, with the minimum plate count always sufficient for the required core.

After chest 100, retain a bounded structural envelope and randomize layouts, signs and permitted topologies. Revisit deeper progression after measurement. The old requested minima reach 25 and 35 moves at chests 1,000 and 10,000, but respectively 95.3% and 99.9% of measured locks miss them; endlessly increasing requested length does not establish increasing actual difficulty. A bounded mature challenge is a proposed tradeoff, not a finite-run guarantee.

## Implementation sequence

1. Reconcile the unpublished #48 implementation with this checkout. Separate generation/classification from reward selection so progression can change while each existing resource handler stays intact.
2. Implement a pure chest policy and topology generator with explicit core, edge, fanout and layout bounds. Add fixtures for pairs, chains, disconnected groups, reciprocal links, opposite signs and dense cores. Preserve existing technical and persisted identifiers.
3. Derive the stable tier from actual rules. Verify every generated chest meets its structural floor, including Tier 3 at chest 18 across seeds. Keep a legal construction witness; retain 12 attempts and the 20,000-state solver cap. A missed path-length target remains a reported shortfall; a capped search remains an unknown optimum.
4. Run the paired benchmark and player calibration below, then settle the anchor values. Update gameplay docs, the decision ledger and any affected help in en/pl/de/ru only when the chosen behavior is implemented.
5. Introduce a new generation ruleset/cohort for new runs because easier early locks affect survival and ore comparisons even with unchanged rewards. Preserve old active-run generators, resource handlers, pending rewards, results and exact replays. Rollback changes the new-run default while retaining handlers needed by existing runs. Confirm storage changes from the reconciled implementation; do not assume a migration is required.

## Benchmark and acceptance plan

Extend the survey to every chest 1–50 and late checkpoints 100/1,000/10,000, 300 samples per chest for exploration and 1,000 for the final comparison. Use decorrelated, recorded sample seeds; compare baseline and candidate with the same seed list, runtime and CPU/memory limits. Record source hashes and retain all raw samples and outliers. The existing survey accepts only its fixed checkpoints, so extend and verify that harness first.

Report total plates, tier frequencies, largest core, directional edges, maximum fanout, signs, initial legal-action count, independently verified length percentiles, shortfalls, unknown optima, fallbacks and generation p50/p95/max. Replay every construction witness. Count unknown optima separately from verified-length distributions.

Proposed structural gates: no seed can fall below its chest's core/edge/tier floor; no seed can exceed its fanout cap; tier floors are nondecreasing. Check every adjacent chest, especially 5/6, 12/13, 17/18 and 24/25. Flag any median verified-length increase greater than one move for review; also inspect p95, available legal actions and topology so a flat median cannot conceal a spike. These are proposed review gates, not guarantees of equal perceived difficulty.

Retain existing performance investigation gates: generation and continuation p95 <100 ms, observed max <500 ms, process RSS <2 GiB. The checked-in #61 survey failed the maximum gate (2,043.82 ms); the issue's newer local measurements do not replace a matched rerun. Include authoritative continuation and Preview checks, since pure generation timing excludes transaction, database and transport overhead.

With unchanged resources, repeat fixed-mistake resource scenarios and add explicitly modeled learning profiles. Report survival, damage and inventory at chests 3/6/13/18/25, ore and censored survivors. Use one starting pick and current drops, carry damage, and end before loot when the last pick breaks. At one mistake per chest the existing resource simulation has a median seven credited chests; reaching the later learning stages cannot be assumed. Fixed profiles cannot demonstrate that the new progression improves survival.

Recruit 8–12 first-time players for exploratory sessions on baseline and candidate, assigning each player's first run to one variant to limit learning bias. Record solve time, valid/invalid moves, resets, last reached chest and a short difficulty rating. Inspect the first three chests and each core transition. Treat the sample as qualitative calibration, not statistical proof; use the findings to choose release targets for first-chest completion and early survival. Replenishment stays fixed during this comparison.

Before rollout, require legal witnesses and bounds/inverse tests; resource/reset regressions; stable authoritative tiers through refresh/replay/concurrent continuation; unchanged drop probabilities and ore; saved-ruleset compatibility; and keyboard, touch and four-language checks. Run `pnpm test`, `pnpm lint`, `pnpm check:architecture`, `pnpm check:names` and `pnpm build` after implementation. Keep #48 open until benchmark, human calibration and Preview acceptance are recorded.

The original planning turn performed no candidate benchmark, player session or implementation. The subsequent implementation is recorded in the linked report; no issue mutation, migration or deployment is implied.
