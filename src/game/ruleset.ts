/** Existing runs/results keep their original balance. */
export const LEGACY_RULESET_VERSION = "deterministic-ore-v1";
/** One starting pick and halved drops; ore and lock generation are unchanged. */
export const SCARCE_PICKS_RULESET_VERSION = "scarce-picks-v1";
/** Structural learning ramp; retains scarce-picks resources. */
export const LEARNING_RULESET_VERSION = "learning-ramp-v1";
/** Defaults may change without removing handlers for saved cohorts. */
export const RULESET_VERSION = LEARNING_RULESET_VERSION;
