import { SPEC_FILE_KEYWORDS, SPEC_REPO_SUFFIX } from "../config.ts";
import { STATUS_PRECEDENCE } from "./status.ts";
import type { ChangeSet, DerivedPullRequest, PullRequestFacts, Status } from "../types.ts";

/** FR-4.15: repo name ends in -openapi, or a changed file's name contains openapi/swagger. */
export function isSpecPR(facts: PullRequestFacts): boolean {
  if (facts.repoName.endsWith(SPEC_REPO_SUFFIX)) return true;
  return facts.changedFilePaths.some((path) =>
    SPEC_FILE_KEYWORDS.some((kw) => path.toLowerCase().includes(kw)),
  );
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

function byCreatedAtAsc(a: DerivedPullRequest, b: DerivedPullRequest): number {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/** FR-4.15: spec PRs merge first (oldest first), then consumers (oldest first). */
function orderMergeOrder(members: DerivedPullRequest[]): {
  ordered: DerivedPullRequest[];
  mergeOrderKnown: boolean;
} {
  const specs = members.filter((m) => m.isSpecPR).sort(byCreatedAtAsc);
  const consumers = members.filter((m) => !m.isSpecPR).sort(byCreatedAtAsc);
  return {
    ordered: [...specs, ...consumers],
    mergeOrderKnown: members.length <= 1 || specs.length > 0,
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

/** FR-4.9-10, 4.13-15: group already-keyed PRs into change sets, each in merge order. */
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
