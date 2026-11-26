# Nickname moderation

New leaderboard claims use only `glin-profanity` 4.0.1 for vocabulary and
profanity detection, resolved by `pnpm-lock.yaml`. There are no project-owned
word lists, runtime downloads, AI models or external moderation requests. The
policy lives in `src/server/leaderboard/nickname-policy.ts` in the server layer.

The Glin `Filter` checks English, Polish, German and Russian together,
independently of UI locale. `checkProfanity().containsProfanity` decides whether
to reject a new nickname directly. Word boundaries are disabled, leetspeak uses
`moderate`, and Glin's Unicode and extra obfuscation transformations remain off.
The application no longer applies a second matcher or duplicates Glin's leetspeak
normalization. Glin may report approximate matches even with `obfuscation: "off"`;
these now trigger rejection too (for example `f.u.c.k`).

Comparison uses Unicode NFKC normalization, lowercase and German `ß` → `ss`.
Glin is also queried using the sharp-s spelling of `ss`. Display names keep their
trimmed original spelling and accents. Existing validation requires 1–24 Unicode
code points and rejects control characters and unpaired surrogates. No censored
substitute is published.

Substring and approximate matching can reject benign names. Coverage depends on
Glin's vocabulary: not all Russian terms or inflections are included, and German
mixed `ss`/`ß` spellings may evade detection. This is not exhaustive moderation
and adds no character allowlist or invisible-character policy. The simplified
scope does not implement every original acceptance criterion in issue #64.

## Dependencies and maintenance

- [glin-profanity](https://www.npmjs.com/package/glin-profanity), upstream
  [glincker/glin-profanity](https://github.com/glincker/glin-profanity), declares
  ISC in the installed 4.0.1 package metadata; its README labels the license MIT.
  This discrepancy is upstream; the project does not relabel or copy its data.

The previous copied LDNOOBW JSON arrays and associated local license copy were
removed when switching to the npm vocabulary provider. To update vocabulary,
upgrade Glin deliberately and review the four-language blocked/allowed fixtures
in `tests/server/leaderboard/nickname-policy.test.ts`. Recheck substring false
positives, Unicode behavior and recovery. Do not add private-package imports or
copy dictionaries back into the repository.

Blocked new submissions return HTTP 400 with `NICKNAME_BLOCKED`. The modal keeps
the typed name editable, announces localized feedback in all four languages and
submits corrections with a new action ID. Uncertain network retries retain the
original action and name. Rejection creates no claim or ranking reservation and
leaves the finished run unchanged; normal request-budget accounting still applies.

Accepted claim identities are checked before the current vocabulary, so retries
of previously accepted names retain their original entry/rank while ownership,
expiry and admission limits remain enforced. Conflicting payload reuse still
fails. Corrections must qualify against the current cutoff in the existing atomic
claim transaction. Existing names are never retroactively changed.

No schema migration, backfill or production deployment is required by the source
change. Rollback can restore the previous application code without changing stored
claims.

Local verification after simplifying to Glin only (2026-11-11): 463 existing tests
passed; 36 PostgreSQL tests were skipped without TEST_DATABASE_URL. No new tests
were added. Lint and production build passed, with the existing CSS `!important`
warning. No deployment was performed.
