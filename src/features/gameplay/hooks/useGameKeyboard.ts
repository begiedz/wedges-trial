"use client";

import { useEffect } from "react";

type KeyboardControls = {
  enabled: boolean;
  moveLeft: () => void;
  moveRight: () => void;
  selectPreviousPin: () => void;
  selectNextPin: () => void;
  resetLock: () => void;
  showReward: () => void;
};
export function useGameKeyboard({
  enabled,
  moveLeft,
  moveRight,
  selectPreviousPin,
  selectNextPin,
  resetLock,
  showReward,
}: KeyboardControls) {
  useEffect(() => {
    if (!enabled) return;
    const commands: Record<string, () => void> = {
      a: moveLeft,
      arrowleft: moveLeft,
      d: moveRight,
      arrowright: moveRight,
      w: selectPreviousPin,
      arrowup: selectPreviousPin,
      s: selectNextPin,
      arrowdown: selectNextPin,
      r: resetLock,
      n: showReward,
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog]",
        )
      )
        return;
      const command = commands[event.key.toLowerCase()];
      if (command) {
        event.preventDefault();
        command();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    enabled,
    moveLeft,
    moveRight,
    selectPreviousPin,
    selectNextPin,
    resetLock,
    showReward,
  ]);
}
