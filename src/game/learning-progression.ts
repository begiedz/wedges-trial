import {
  DEFAULT_MAX_POSITION,
  DEFAULT_MIN_POSITION,
  DEFAULT_TARGET_POSITION,
} from "@/game/constants";
import type { DifficultyConfig, RandomSource } from "@/game/types";

// One-based anchors: chest, core, edges, maximum plates, minimum/maximum path.
const ANCHORS = [
  [1, 2, 1, 4, 2, 4],
  [3, 2, 1, 4, 3, 4],
  [5, 3, 2, 4, 3, 5],
  [8, 3, 3, 5, 4, 6],
  [12, 4, 4, 6, 5, 7],
  [15, 4, 5, 6, 5, 7],
  [18, 4, 6, 6, 6, 8],
  [24, 5, 8, 7, 7, 9],
  [30, 5, 10, 7, 8, 10],
  [50, 6, 14, 7, 9, 12],
  [100, 7, 18, 7, 10, 16],
] as const;

/** Structural changes happen at integer edge milestones. Length increases wait
 * until a later chest when a connection is added, so challenges do not coincide.
 */
export function getLearningProgression(
  chestIndex: number,
  random: RandomSource = Math.random,
): DifficultyConfig {
  const displayedChest = Math.max(1, Math.floor(chestIndex) + 1);
  const chest = Math.min(100, displayedChest);
  const upper = ANCHORS.findIndex((anchor) => anchor[0] >= chest);
  const right = ANCHORS[upper];
  const left = ANCHORS[Math.max(0, upper - 1)];
  const progress =
    right[0] === left[0] ? 1 : (chest - left[0]) / (right[0] - left[0]);
  const interpolate = (column: 2 | 4 | 5) =>
    Math.floor(left[column] + (right[column] - left[column]) * progress);
  const dependencies = interpolate(2);
  // Grow the core only when the next anchor's edge budget is reached.
  const coreSize = dependencies === right[2] ? right[1] : left[1];
  const previousValue = (column: 2 | 4 | 5) =>
    right[0] === left[0]
      ? left[column]
      : Math.floor(
          left[column] +
            (right[column] - left[column]) *
              ((chest - 1 - left[0]) / (right[0] - left[0])),
        );
  const connectionAdded =
    displayedChest === chest && dependencies > previousValue(2);
  const minSolutionLength = connectionAdded ? previousValue(4) : interpolate(4);
  const maxSolutionLength = connectionAdded ? previousValue(5) : interpolate(5);
  const minPlates = Math.max(4, coreSize);
  // A continuous uniform draw gives overlapping count probabilities. Eligibility
  // expands continuously; integer plate counts do not all jump at an anchor.
  const plateCeiling = left[3] + (right[3] - left[3]) * progress;
  const plateCount = Math.min(
    7,
    minPlates + Math.floor(random() * (plateCeiling - minPlates + 1)),
  );
  // Avoid the generator bias toward the longest attainable path in a window.
  // Early chests sample an exact target; bounded retries still report shortfalls.
  // Keep mature targets unchanged rather than forcing expensive exact late paths.
  const target =
    coreSize < 7
      ? minSolutionLength +
        Math.floor(random() * (maxSolutionLength - minSolutionLength + 1))
      : undefined;
  return {
    plateCount,
    minPosition: DEFAULT_MIN_POSITION,
    maxPosition: DEFAULT_MAX_POSITION,
    targetPosition: DEFAULT_TARGET_POSITION,
    dependencyDensity: 0,
    guaranteedSolvableMoves: maxSolutionLength,
    solutionLengthRange: [minSolutionLength, maxSolutionLength],
    minSolutionLength: target ?? minSolutionLength,
    maxSolutionLength: target ?? maxSolutionLength,
    topology: {
      coreSize,
      dependencies,
      maxFanout: chest <= 5 ? 1 : chest <= 18 ? 2 : 3,
      sameDirectionOnly: chest <= 3,
    },
  };
}
