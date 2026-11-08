import type { LockDifficulty, MoveRule } from "@/game/types";

/** Count right-direction dependencies once; inverse rules and self effects add nothing.
 * Undirected components describe coupling, never recursive movement.
 */
export function analyzeConnections(rules: MoveRule[]) {
  const adjacency = new Map<number, Set<number>>();
  let dependencies = 0;
  let maxFanout = 0;
  for (const rule of rules) {
    if (!adjacency.has(rule.sourcePinId))
      adjacency.set(rule.sourcePinId, new Set());
    if (rule.direction !== 1) continue;
    const targets = new Set(
      rule.effects
        .filter((effect) => effect.pinId !== rule.sourcePinId)
        .map((effect) => effect.pinId),
    );
    dependencies += targets.size;
    maxFanout = Math.max(maxFanout, targets.size);
    for (const target of targets) {
      if (!adjacency.has(target)) adjacency.set(target, new Set());
      adjacency.get(rule.sourcePinId)?.add(target);
      adjacency.get(target)?.add(rule.sourcePinId);
    }
  }
  const visited = new Set<number>();
  let coreSize = 0;
  for (const id of adjacency.keys()) {
    if (visited.has(id)) continue;
    const pending = [id];
    let size = 0;
    while (pending.length) {
      const current = pending.pop() as number;
      if (visited.has(current)) continue;
      visited.add(current);
      size++;
      pending.push(...(adjacency.get(current) ?? []));
    }
    coreSize = Math.max(coreSize, size);
  }
  const tier: LockDifficulty =
    coreSize >= 5 && dependencies >= 10
      ? 4
      : coreSize >= 4 && dependencies >= 6
        ? 3
        : coreSize >= 3 || dependencies >= 2
          ? 2
          : 1;
  return { coreSize, dependencies, maxFanout, tier };
}
