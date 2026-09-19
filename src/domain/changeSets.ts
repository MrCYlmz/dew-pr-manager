import { DEFAULT_SPEC_RULE } from "../config.ts";
import { STATUS_PRECEDENCE } from "./status.ts";
import type { ChangeSet, DerivedPullRequest, PullRequestFacts, SpecRule, Status } from "../types.ts";

/**
 * Turns whatever the settings file or the settings form holds into a well-formed rule: words
 * may arrive as an array or as one comma/newline-separated string; they are trimmed,
 * lowercased and de-duplicated, empties dropped; anything missing falls back to the default.
 */
export function normalizeSpecRule(input: unknown): SpecRule {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const words = (value: unknown, fallback: string[]): string[] => {
    if (value === undefined) return fallback;
    const parts = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,\n]/) : [];
    const seen = new Set<string>();
    for (const part of parts) {
      if (typeof part !== "string") continue;
      const w = part.trim().toLowerCase();
      if (w) seen.add(w);
    }
    return [...seen];
  };
  const flag = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);
  return {
    useRepoSuffix: flag(src.useRepoSuffix, DEFAULT_SPEC_RULE.useRepoSuffix),
    repoSuffixes: words(src.repoSuffixes, DEFAULT_SPEC_RULE.repoSuffixes),
    useFileKeywords: flag(src.useFileKeywords, DEFAULT_SPEC_RULE.useFileKeywords),
    fileKeywords: words(src.fileKeywords, DEFAULT_SPEC_RULE.fileKeywords),
  };
}

/**
 * FR-4.15: repo name ends in one of the rule's suffixes, or a changed file's name contains
 * one of its words — whichever half the user has switched on. With both halves off (or
 * empty) nothing is a spec PR, and every multi-member set reports its order as unknown.
 */
export function isSpecPR(facts: PullRequestFacts, rule: SpecRule = DEFAULT_SPEC_RULE): boolean {
  if (rule.useRepoSuffix) {
    const repo = facts.repoName.toLowerCase();
    if (rule.repoSuffixes.some((suffix) => repo.endsWith(suffix))) return true;
  }
  if (rule.useFileKeywords && rule.fileKeywords.length > 0) {
    return facts.changedFilePaths.some((path) => {
      const lower = path.toLowerCase();
      return rule.fileKeywords.some((kw) => lower.includes(kw));
    });
  }
  return false;
}

/** Re-derive every PR's spec flag under a rule; the facts it reads are already in the snapshot. */
export function applySpecRule(prs: DerivedPullRequest[], rule: SpecRule): DerivedPullRequest[] {
  return prs.map((pr) => ({ ...pr, isSpecPR: isSpecPR(pr, rule) }));
}

/** FR-4.11: the first number in the branch name, falling back to the branch name itself. */
export function extractSetLabel(branchName: string): string {
  const match = branchName.match(/\d+/);
  return match ? match[0] : branchName;
}

/**
 * FR-6.19-20: setKey is the manual link's target when one exists for this PR, otherwise the
 * head branch name (FR-4.9-10). branchSetKey is always kept so unlinking can fall back to it.
 */
export function assignSetKeys(
  prs: DerivedPullRequest[],
  links: Record<string, string>,
): DerivedPullRequest[] {
  return prs.map((pr) => {
    const target = links[pr.key];
    return {
      ...pr,
      branchSetKey: pr.headRefName,
      setKey: target ?? pr.headRefName,
      manuallyLinked: target != null,
    };
  });
}

/** Neutral, stable display order inside a merge step: repo then number. Not a merge claim. */
function byKey(a: DerivedPullRequest, b: DerivedPullRequest): number {
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

/**
 * FR-4.15: the only ordering the data supports is spec PRs (step 1) before their consumers
 * (step 2). Nothing says how PRs inside one step relate — not age, not size, not repo — so
 * no order is claimed between them. With no spec member there is no step 1 and the order is
 * reported unknown rather than guessed.
 */
function orderMergeOrder(members: DerivedPullRequest[]): {
  ordered: DerivedPullRequest[];
  mergeOrderKnown: boolean;
} {
  const specs = members.filter((m) => m.isSpecPR).sort(byKey);
  const consumers = members.filter((m) => !m.isSpecPR).sort(byKey);
  const mergeOrderKnown = members.length <= 1 || specs.length > 0;
  const step = (n: 1 | 2) => (mergeOrderKnown ? n : null);
  return {
    ordered: [
      ...specs.map((m) => ({ ...m, mergeStep: step(1) })),
      ...consumers.map((m) => ({ ...m, mergeStep: step(2) })),
    ],
    mergeOrderKnown,
  };
}

/**
 * FR-4.13. The spec doesn't say what happens when a set mixes only DRAFT and READY_TO_MERGE
 * members with nothing else (neither "every member" case holds, and both statuses are
 * skipped in the walk) — a draft member still means the set isn't ready, so DRAFT wins that
 * mix rather than leaving the set status undefined.
 */
function computeSetStatus(members: DerivedPullRequest[]): Status {
  if (members.every((m) => m.status === "READY_TO_MERGE")) return "READY_TO_MERGE";
  if (members.every((m) => m.status === "DRAFT")) return "DRAFT";
  for (const status of STATUS_PRECEDENCE) {
    if (status === "READY_TO_MERGE" || status === "DRAFT") continue;
    if (members.some((m) => m.status === status)) return status;
  }
  return "DRAFT";
}

/** FR-4.14: the set's owner is the owner of the (first, in merge order) member that set its status. */
function computeSetOwner(members: DerivedPullRequest[], setStatus: Status) {
  const setter = members.find((m) => m.status === setStatus) ?? members[0]!;
  return setter.owner;
}

/** FR-4.9-10, 4.13-15: group already-keyed PRs into change sets, each in merge-step order. */
export function groupIntoChangeSets(prs: DerivedPullRequest[]): ChangeSet[] {
  const bySetKey = new Map<string, DerivedPullRequest[]>();
  for (const pr of prs) {
    const list = bySetKey.get(pr.setKey);
    if (list) list.push(pr);
    else bySetKey.set(pr.setKey, [pr]);
  }

  const sets: ChangeSet[] = [];
  for (const [key, members] of bySetKey) {
    const { ordered, mergeOrderKnown } = orderMergeOrder(members);
    const status = computeSetStatus(ordered);
    sets.push({
      key,
      label: extractSetLabel(key),
      members: ordered,
      status,
      owner: computeSetOwner(ordered, status),
      mergeOrderKnown,
      hasManualLink: ordered.some((m) => m.manuallyLinked),
    });
  }
  return sets;
}
