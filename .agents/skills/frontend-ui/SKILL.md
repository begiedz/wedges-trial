---
name: frontend-ui
description: Use for React components, Next.js app routes, navigation, gameplay input, accessibility, responsive styling and UI integration with backend.
---

# Frontend UI skill

Read `AGENTS.md`, `docs/architecture/status.md` and relevant layout/components. Keep current path naming `src/app/[lang]/`, not `[locale]`.

## Procedure

1. Reuse existing patterns in `src/components/game/GameClient.tsx`, `src/components/lock`, `src/components/general` and `src/i18n/`.
2. During migration replace browser-authoritative logic with API calls **only once the server counterpart works**; use server-confirmed DTOs to render.
3. Prevent rapid double submissions; model pending, invalid move, pick break, solved chest, failed run and stale conflict states clearly.
4. Preserve A/D/W/S, arrow keys, manual reset, next chest and touch/click controls; avoid key events inside text inputs.
5. Keep UI accessible and screen-reader friendly; don't rely only on sound/color.
6. Never hardcode copy; update en/pl/de/ru dictionaries.
7. For audio, connect UI to a separate opt-in provider; never call audio from the pure engine.

## Done when

- Gameplay works with keyboard/mobile and returns from refresh using server state.
- No local save path can rewrite trusted server data.
- Loading, retry and Game Over states are tested.
