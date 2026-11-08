/** Existing runs/results keep their original balance. */
export const LEGACY_RULESET_VERSION = "deterministic-ore-v1";
/** One starting pick and halved drops; ore and lock generation are unchanged. */
export const SCARCE_PICKS_RULESET_VERSION = "scarce-picks-v1";
/** Structural learning ramp; retains scarce-picks resources. */
export const LEARNING_RULESET_VERSION = "learning-ramp-v1";
/** Tier-based ore; preserves the learning ramp and scarce-pick balance. */
export const DIFFICULTY_ORE_RULESET_VERSION = "difficulty-ore-v1";
export const RULESET_VERSION = DIFFICULTY_ORE_RULESET_VERSION;

/** Both cohorts use the same generator, including its RNG consumption. */
export function usesLearningProgression(rulesetVersion: string): boolean {
  return (
    rulesetVersion === LEARNING_RULESET_VERSION ||
    rulesetVersion === DIFFICULTY_ORE_RULESET_VERSION
  );
}
