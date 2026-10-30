# Audio system and third-party assets

## Functional direction (planned)

- Add optional **music** on/off + volume and **SFX** on/off + independent volume in desktop and mobile menus.
- Browser audio must wait for user activation; handle muted default, blocked autoplay, navigation, visibility and cleanup.
- A single client-side audio manager can persist across route transitions, with lazy-loaded, optimized audio files and no backend dependence for playback.
- Use semantic cues for movement, invalid move, pick break, lock solved, chest/reward, game over. Derive score-affecting cues from **confirmed server events** so retry/rollback doesn't trigger false effects.
- Audio preferences can be kept in a small cookie or appropriate user settings, but never use browser storage for authoritative gameplay state.

## Rights and provenance

**Noncommercial does not mean permission to reuse extracted game assets.** An owned copy of a game/soundtrack does not imply redistribution rights. Before committing, bundling or hosting extracted Gothic Remake music, SFX, fonts, icons or art, document appropriate permissions or obtain a license from relevant rights holders.

Already present in the current repository:

- `src/assets/fonts/BoucherieBlockExtended.otf`
- `public/Cursor.png`
- `src/assets/images/icons/T_Icon_PC_*.png`, `T_Icon_PS_S.png`
- `src/assets/images/icons/T_LockDifficulty_*.png`
- `src/assets/images/icons/items/*`
- `src/assets/images/logo.png`, `src/assets/images/T_TitleLine_Small.png`, `public/wedge.png`

The files exist; their **specific legal provenance is not established** solely by their names. Fonts may have separate licenses. Check both code repository distribution and public website deployment. Favor original or adequately licensed replacements until rights are confirmed.

## Proposed asset manifest

Maintain a table in a future asset-manifest file with: repository path, asset type, author/owner, original source, license/grant evidence, modifications, redistribution approval, attribution and deployment eligibility.

## Never

- Ship extracted audio in repo/public directory based only on a noncommercial disclaimer.
- Interpret a publisher's video/stream policy as a blanket reuse license for game audio/images.
- Add hidden autoplay or remove player's ability to mute sound.

Related: #52 (audit/rights), #53 (player/settings), #54 (SFX). See [THQ Nordic Video Policy](https://thqnordic.com/legal/video-policy) for context, not as a blanket license.
