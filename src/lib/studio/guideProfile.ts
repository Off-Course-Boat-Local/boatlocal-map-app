// Shared, dependency-free constant — imported from both the client-side
// profile form (for the visible character counter) and the server action
// that persists it (for the hard truncation), so the two can never disagree
// about where the limit actually is.

/** PRD §6.2: "write welcome message (≈160 chars)". */
export const GUIDE_WELCOME_MAX_LENGTH = 160;
