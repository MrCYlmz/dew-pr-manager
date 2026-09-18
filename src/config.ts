/**
 * The one documented place for tunables the spec calls organisation conventions,
 * not end-user preferences (Configuration and onboarding).
 */

/** FR-2.6: STALE is more than this many days with no commit, comment or review. */
export const STALE_DAYS = 7;

/** FR-7.23: automatic rescan interval. */
export const SCAN_INTERVAL_MS = 5 * 60 * 1000;

/** FR-7.24: keep at most this many status-history events. */
export const HISTORY_CAP = 500;

/** FR-4.15: a PR is a spec PR when its repository name ends in this suffix... */
export const SPEC_REPO_SUFFIX = "-openapi";

/** ...or when it changes a file whose name contains one of these (case-insensitive). */
export const SPEC_FILE_KEYWORDS = ["openapi", "swagger"];

/**
 * FR-5.15: the organisation's breaking-changes checkbox block. The spec leaves the exact
 * format as an open question, so this assumes a heading containing "breaking change"
 * followed (within BREAKING_CHANGE_SCAN_LINES lines) by "- [ ] Yes" / "- [ ] No" checkbox
 * items. Retune the two regexes below, not the parser, if the org's convention differs.
 */
export const BREAKING_CHANGE_HEADING_RE = /breaking change/i;
export const BREAKING_CHANGE_CHECKBOX_RE = /^\s*-\s*\[( |x|X)\]\s*(yes|no)\b/i;
export const BREAKING_CHANGE_SCAN_LINES = 15;

/** Concurrency cap for per-PR detail fetches, so a large queue can't trip rate limits. */
export const FETCH_CONCURRENCY = 5;

/** Three optional environment settings, and no more (Configuration and onboarding). */
export const PORT = Number(process.env.PR_MANAGER_PORT) || 4317;
export const NOTIFY_ENABLED = (process.env.PR_MANAGER_NOTIFY ?? "on").toLowerCase() !== "off";
export const ACCOUNT = process.env.PR_MANAGER_ACCOUNT || null;

export const DATA_DIR = "data";
