import { checkSolved } from "@/game/check-solved";
import { MAX_INVALID_MOVES_PER_PICK } from "@/game/constants";
import { generateRules } from "@/game/generate-rules";
import { solveLockDetailed, verifySolution } from "@/game/solver";
import type {
  DifficultyConfig,
  LockMove,
  LockState,
  MoveRule,
  Pin,
  RandomSource,
} from "@/game/types";
import { evaluateRule } from "./movement";

function clonePins(pins: Pin[]): Pin[] {
  return pins.map((pin) => ({ ...pin }));
}

function createSolvedPins(config: DifficultyConfig): Pin[] {
  return Array.from({ length: config.tumblerCount }, (_, id) => ({
    id,
    min: config.minPosition,
    max: config.maxPosition,
    target: config.targetPosition,
    position: config.targetPosition,
  }));
}

function createMixedLock(
  config: DifficultyConfig,
  mixingMoves: number,
  maxSolutionLength: number,
  random: RandomSource,
): { lock: LockState; boundedLock: LockState; boundedSolution: LockMove[] } {
  const solvedPins = createSolvedPins(config);
  const rules = generateRules(config, random);
  let mixedPins = clonePins(solvedPins);
  let boundedPins = mixedPins;
  const mixingPath: LockMove[] = [];
  let boundedPath: LockMove[] = [];
  const visited = new Set([mixedPins.map((pin) => pin.position).join(",")]);

  for (let move = 0; move < mixingMoves; move += 1) {
    const candidates = rules
      .map((rule) => {
        const result = evaluateRule(mixedPins, rule);
        return result.kind === "valid" ? { pins: result.pins, rule } : null;
      })
      .filter(
        (candidate): candidate is { pins: Pin[]; rule: MoveRule } =>
          candidate !== null &&
          !visited.has(candidate.pins.map((pin) => pin.position).join(",")),
      );
    if (candidates.length === 0) {
      break;
    }
    const candidate = candidates[Math.floor(random() * candidates.length)];
    mixedPins = candidate.pins;
    mixingPath.push({
      pinId: candidate.rule.sourcePinId,
      direction: candidate.rule.direction === 1 ? -1 : 1,
    });
    if (move < maxSolutionLength) {
      boundedPins = mixedPins;
      boundedPath = [...mixingPath];
    }
    // Avoid cancelling earlier mixing moves, not just the immediately previous one.
    visited.add(mixedPins.map((pin) => pin.position).join(","));
  }

  if (checkSolved({ pins: mixedPins })) {
    throw new RangeError("Lock configuration has no valid mixing move");
  }

  const lock: LockState = {
    optimalMoves: null,
    pins: mixedPins,
    rules,
    invalidMovesOnCurrentPick: 0,
    maxInvalidMovesPerPick: MAX_INVALID_MOVES_PER_PICK,
    isSolved: false,
    isFailed: false,
  };
  return {
    lock,
    boundedLock: { ...lock, pins: boundedPins },
    boundedSolution: boundedPath.reverse(),
  };
}

export const MAX_GENERATION_ATTEMPTS = 12;

export type GenerationDiagnostics = {
  attempts: number;
  searches: { found: number; budgetExhausted: number };
  outcome: "target-met" | "below-target" | "unverified";
  target: { min: number; max: number };
};

/** Private, ephemeral evidence for tests/benchmarks; never stored or sent in DTOs. */
export function createLockWithDiagnostics(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): {
  lock: LockState;
  diagnostics: GenerationDiagnostics;
  solution: LockMove[];
} {
  const minLength = Math.max(1, config.minSolutionLength ?? 1);
  const maxLength = Math.max(
    1,
    config.maxSolutionLength ?? config.guaranteedSolvableMoves,
  );
  // Longer walks counter shortcuts. Keep an early snapshot whose inverse path
  // satisfies the upper bound if the solver exhausts its search budget.
  const mixingMoves = Math.max(1, config.guaranteedSolvableMoves) * 4;
  const firstCandidate = createMixedLock(
    config,
    mixingMoves,
    maxLength,
    random,
  );
  let bestLock = firstCandidate.boundedLock;
  let bestLength = -1;
  let bestSolution = firstCandidate.boundedSolution;
  const diagnostics: GenerationDiagnostics = {
    attempts: 0,
    searches: { found: 0, budgetExhausted: 0 },
    outcome: "unverified",
    target: { min: minLength, max: maxLength },
  };
  const finish = (lock: LockState, solution: LockMove[]) => {
    if (!verifySolution(lock, solution))
      throw new Error("Generator produced an illegal solution");
    diagnostics.outcome =
      lock.optimalMoves == null
        ? "unverified"
        : lock.optimalMoves >= minLength
          ? "target-met"
          : "below-target";
    return { lock, diagnostics, solution };
  };

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const { lock } =
      attempt === 0
        ? firstCandidate
        : createMixedLock(config, mixingMoves, maxLength, random);
    diagnostics.attempts += 1;
    const search = solveLockDetailed(lock);
    if (search.kind === "unsolvable")
      throw new Error("Constructed lock is unsolvable");
    diagnostics.searches[
      search.kind === "found" ? "found" : "budgetExhausted"
    ] += 1;
    const solution = search.kind === "found" ? search.solution : null;
    if (solution && solution.length >= minLength && minLength <= maxLength) {
      // Following a shortest path preserves shortest distance for its suffix.
      let pins = lock.pins;
      for (const move of solution.slice(
        0,
        Math.max(0, solution.length - maxLength),
      )) {
        const rule = lock.rules.find(
          (rule) =>
            rule.sourcePinId === move.pinId &&
            rule.direction === move.direction,
        );
        if (rule) {
          const result = evaluateRule(pins, rule);
          if (result.kind === "valid") pins = result.pins;
        }
      }
      return finish(
        {
          ...lock,
          pins,
          optimalMoves: Math.min(solution.length, maxLength),
        },
        solution.slice(Math.max(0, solution.length - maxLength)),
      );
    }
    if (
      solution &&
      solution.length <= maxLength &&
      solution.length > bestLength
    ) {
      bestLock = { ...lock, optimalMoves: solution.length };
      bestLength = solution.length;
      bestSolution = solution;
    }
  }

  // Fixed pin ranges can make late targets unreachable. Preserve construction
  // solvability instead of retrying forever or treating BFS exhaustion as failure.
  return finish(bestLock, bestSolution);
}

export function createLock(
  config: DifficultyConfig,
  random: RandomSource = Math.random,
): LockState {
  return createLockWithDiagnostics(config, random).lock;
}
