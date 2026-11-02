export const START_NEW_RUN_EVENT = "wedges-trial:start-new-run";

/** The navbar requests a UI confirmation; it never starts or abandons a run itself. */
export function requestNewRun() {
  window.dispatchEvent(new Event(START_NEW_RUN_EVENT));
}
export function onNewRunRequested(handler: () => void) {
  window.addEventListener(START_NEW_RUN_EVENT, handler);
  return () => window.removeEventListener(START_NEW_RUN_EVENT, handler);
}
