// A screen with unsaved work registers a check; the app shell runs page changes through it.
type Check = (go: () => void) => void;

let current: Check | null = null;

export const setLeaveGuard = (check: Check | null) => { current = check; };

// Goes now, or once the screen with unsaved work agrees.
export const leaveThen = (go: () => void) => (current ? current(go) : go());
