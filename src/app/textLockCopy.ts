export const textLockCopy = {
  actions: {
    continueRun: "Continue saved run",
    continueToNextChest: "Continue to next chest",
    moveLeft: "Move left",
    moveRight: "Move right",
    newRun: "Start new test run",
    reset: "Reset current lock",
    selectPin: "Select pin",
  },
  labels: {
    chest: "Chest",
    debugUi: "Debug UI",
    invalidMoves: "Invalid moves on current pick",
    left: "left",
    lockpicks: "Lockpicks",
    maxInvalidMoves: "Max invalid moves per pick",
    noValue: "Not started",
    oreNuggets: "Ore nuggets",
    pin: "Pin",
    pinPrefix: "pin",
    position: "Position",
    range: "Range",
    right: "right",
    rules: "Rules",
    selectedPin: "Selected pin",
    solverHint: "Solver path length",
    state: "State",
    target: "Target",
  },
  messages: {
    active:
      "Use the text controls to inspect dependencies, verify valid moves, and reproduce invalid move damage.",
    failed:
      "Run failed. No lockpicks remain, so lock interaction is blocked until a new run starts.",
    idle: "Start a run to inspect the generated lock and test move behavior.",
    invalid:
      "Invalid moves leave every pin in place and only damage the current lockpick.",
    saved: "A previously saved run is available from the last opened chest.",
    solved:
      "Lock solved. Advance to the next chest to generate a harder test lock and save the run.",
  },
  states: {
    active: "Active",
    failed: "Failed",
    solved: "Solved",
  },
  subtitle:
    "Text-first browser harness for validating lock generation, move rules, invalid move damage, and manual reset behavior.",
  title: "Wedge's Trial Lock Harness",
} as const;
