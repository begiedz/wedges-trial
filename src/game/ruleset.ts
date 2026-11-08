/** Existing runs/results keep their original balance. */
export const LEGACY_RULESET_VERSION = "deterministic-ore-v1";
/** One starting pick and halved drops; ore and lock generation are unchanged. */
export const SCARCE_PICKS_RULESET_VERSION = "scarce-picks-v1";
/** Structural learning ramp; retains scarce-picks resources. */
export const LEARNING_RULESET_VERSION = "learning-ramp-v1";
/** Tier-based ore; preserves the learning ramp and scarce-pick balance. */
export const DIFFICULTY_ORE_RULESET_VERSION = "difficulty-ore-v1";
/** Random core membership and independently scrambled extra plates. */
export const ALL_PLATES_RULESET_VERSION = "all-plates-v1";
export const RULESET_VERSION = ALL_PLATES_RULESET_VERSION;

export function usesDifficultyOre(rulesetVersion: string): boolean {
  return (
    rulesetVersion === DIFFICULTY_ORE_RULESET_VERSION ||
    rulesetVersion === ALL_PLATES_RULESET_VERSION
  );
}

/** Shared structural schedule; all-plates-v1 opts into new mixing/membership. */
export function usesLearningProgression(rulesetVersion: string): boolean {
  return (
    rulesetVersion === LEARNING_RULESET_VERSION ||
    usesDifficultyOre(rulesetVersion)
  );
}
