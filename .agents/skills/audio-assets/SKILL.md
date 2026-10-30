---
name: audio-assets
description: Use when adding music playback, sound effect cues, audio settings, game-derived fonts, cursors, icons or any third-party media assets and licensing audits.
---

# Audio and assets skill

Read `docs/architecture/audio-assets.md`, `security.md` and issues #52–#54 before coding or adding assets.

## Procedure

1. Separate **player and controls** from actual **media files**; develop playback with original/licensed placeholders first.
2. Do not commit, embed or stream extracted Gothic Remake media without sufficient rights to use and redistribute in a web game. Noncommercial status and attribution are not automatic permission.
3. Audit current and proposed fonts, cursor, UI icons, logo and game SFX individually. Keep provenance, license and restrictions in an asset manifest.
4. Implement opt-in music, SFX volume and mute separately; handle browser autoplay, cleanup and duplicate playback during navigation.
5. Play gameplay cues only for confirmed actions; avoid duplicating sounds on retries and renders.
6. Optimize file sizes and support reduced-motion/muted experiences; check usability without audio.

## Done when

- Licensing is documented, users retain mute control, and UI/sound tests pass.
