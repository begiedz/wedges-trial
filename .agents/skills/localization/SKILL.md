---
name: localization
description: Use for any user-visible text changes, new pages, audio controls, leaderboard labels or error messages across en, pl, de and ru.
---

# Localization skill

Read `AGENTS.md` and current `src/i18n/dictionaries.ts`, `src/i18n/provider.tsx`, `src/i18n/types.ts` and JSON dictionaries.

## Procedure

1. Make keys descriptive and consistent with existing namespaces; don't duplicate nearly identical strings.
2. Update **all four** `src/i18n/dictionaries/{en,pl,de,ru}.json` files for every new visible string.
3. Use English as fallback; preserve player-facing terminology (ore nuggets, lockpicks, chest difficulty).
4. Check number formats, pluralization, long German labels, non-Latin text, empty leaderboard, sound controls and errors.
5. Keep literal error codes in HTTP responses separate from localized presentation strings.
6. Test dictionary parity/usage and visual overflow where practical.

## Done when

- The UI contains no newly hardcoded user-facing strings; all four languages have matching keys.
