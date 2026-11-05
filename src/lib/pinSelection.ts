export function getNextPinId(
  pins: readonly { id: number }[],
  selectedPinId: number | null,
  offset: number,
): number | null {
  if (pins.length === 0) {
    return null;
  }

  const currentIndex = pins.findIndex((pin) => pin.id === selectedPinId);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (safeIndex + offset + pins.length) % pins.length;

  return pins[nextIndex]?.id ?? null;
}
