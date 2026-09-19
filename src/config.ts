/**
 * The one documented place for tunables the spec calls organisation conventions,
 * not end-user preferences (Configuration and onboarding).
 */
import type { SpecRule } from "./types.ts";

/** FR-2.6: STALE is more than this many days with no commit, comment or review. */
export const STALE_DAYS = 7;

/** FR-7.23: automatic rescan interval. */
export const SCAN_INTERVAL_MS = 5 * 60 * 1000;

/** FR-7.24: keep at most this many status-history events. */
export const HISTORY_CAP = 500;

/**
 * FR-4.15: what makes a PR a spec PR until the user says otherwise — a repository name ending
 * in `-openapi`, or a changed file whose name contains `openapi` or `swagger`. This is the one
 * tunable the user may override from the dashboard (persisted in data/settings.json); these
 * values are what "Reset to defaults" restores.
 */
export const DEFAULT_SPEC_RULE: SpecRule = {
  useRepoSuffix: true,
  repoSuffixes: ["-openapi"],
  useFileKeywords: true,
  fileKeywords: ["openapi", "swagger"],
};

/** Concurrency cap for per-PR detail fetches, so a large queue can't trip rate limits. */
export const FETCH_CONCURRENCY = 5;

/** Three optional environment settings, and no more (Configuration and onboarding). */
export const PORT = Number(process.env.PR_MANAGER_PORT) || 4317;
export const NOTIFY_ENABLED = (process.env.PR_MANAGER_NOTIFY ?? "on").toLowerCase() !== "off";
export const ACCOUNT = process.env.PR_MANAGER_ACCOUNT || null;

export const DATA_DIR = "data";
