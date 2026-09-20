import { DEFAULT_SPEC_RULE } from "../config.ts";
import { STATUS_PRECEDENCE } from "./status.ts";
import type { ChangeSet, DerivedPullRequest, PullRequestFacts, SpecRule, Status } from "../types.ts";

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

export function applySpecRule(prs: DerivedPullRequest[], rule: SpecRule): DerivedPullRequest[] {
  return prs.map((pr) => ({ ...pr, isSpecPR: isSpecPR(pr, rule) }));
}

export function extractSetLabel(branchName: string): string {
  const match = branchName.match(/\d+/);
  return match ? match[0] : branchName;
}

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

function byKey(a: DerivedPullRequest, b: DerivedPullRequest): number {
  return a.key.localeCompare(b.key, undefined, { numeric: true });
}

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

function computeSetStatus(members: DerivedPullRequest[]): Status {
  if (members.every((m) => m.status === "READY_TO_MERGE")) return "READY_TO_MERGE";
  if (members.every((m) => m.status === "DRAFT")) return "DRAFT";
  for (const status of STATUS_PRECEDENCE) {
    if (status === "READY_TO_MERGE" || status === "DRAFT") continue;
    if (members.some((m) => m.status === status)) return status;
  }
  return "DRAFT";
}

function computeSetOwner(members: DerivedPullRequest[], setStatus: Status) {
  const setter = members.find((m) => m.status === setStatus) ?? members[0]!;
  return setter.owner;
}

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
