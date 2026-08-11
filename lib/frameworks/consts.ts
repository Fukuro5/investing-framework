export const ASSIGNMENT_SOURCES = ["manual", "auto"] as const;

// A framework's groups' target allocation bands must sum to exactly this —
// PLANNING.md §3/§5/§9.
export const REQUIRED_GROUP_ALLOCATION_TOTAL = 100;

// Sentinel <select> value representing "no group" in the assignment UI —
// never a real FrameworkGroup.id, so it can't collide with one.
export const UNCLASSIFIED_ASSIGNMENT_VALUE = "unclassified";
