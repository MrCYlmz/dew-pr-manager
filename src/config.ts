import type { SpecRule } from "./types.ts";

export const STALE_DAYS = 7;

export const SCAN_INTERVAL_MS = 5 * 60 * 1000;

export const HISTORY_CAP = 500;

export const DEFAULT_SPEC_RULE: SpecRule = {
  useRepoSuffix: true,
  repoSuffixes: ["-openapi"],
  useFileKeywords: true,
  fileKeywords: ["openapi", "swagger"],
};

export const DEFAULT_NOTIFY = true;
export const FETCH_CONCURRENCY = 5;
export const PORT = Number(process.env.PR_MANAGER_PORT) || 4317;
export const ACCOUNT = process.env.PR_MANAGER_ACCOUNT || null;

export const DATA_DIR = "data";
