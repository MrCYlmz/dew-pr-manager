import { STALE_DAYS } from "../config.ts";
import type { PullRequestFacts, Status } from "../types.ts";

/** FR-2.4: the closed vocabulary, in FR-2.5's exact walk order. */
export const STATUS_PRECEDENCE: Status[] = [
  "DRAFT",
  "CONFLICTED",
  "CI_FAILING",
  "CHANGES_REQUESTED",
  "REVIEW_STALE",
  "READY_TO_MERGE",
  "STALE",
  "NEEDS_REVIEW",
];

/**
 * FR-2.6: "measured from last activity, not from creation" — the latest of the last
 * commit push, the last issue comment, and the last review submission. Falls back to
 * createdAt only if none of those signals exist yet.
 */
export function computeLastActivityAt(facts: PullRequestFacts): string {
  const candidates = [facts.lastCommitAt, facts.lastCommentAt, facts.lastReviewAt].filter(
    (d): d is string => d != null,
  );
  if (candidates.length === 0) return facts.createdAt;
  return candidates.reduce((latest, d) => (d > latest ? d : latest));
}

function latestApproval(facts: PullRequestFacts) {
  const approvals = facts.reviews.filter((r) => r.state === "APPROVED");
  if (approvals.length === 0) return null;
  return approvals.reduce((latest, r) => (r.submittedAt > latest.submittedAt ? r : latest));
}

/** FR-2.7: the newest approval was submitted against a commit older than the current head. */
export function isApprovalStale(facts: PullRequestFacts): boolean {
  const approval = latestApproval(facts);
  if (approval == null) return false;
  return approval.commitSha !== facts.headCommitSha;
}

function isReadyBase(facts: PullRequestFacts): boolean {
  const isApproved = facts.reviewDecision === "APPROVED";
  const mergeableOk = facts.mergeableState === "MERGEABLE";
  const noPendingChecks =
    facts.checkRollupState === "SUCCESS" ||
    facts.checkRollupState === "NEUTRAL" ||
    facts.checkRollupState == null;
  return isApproved && mergeableOk && noPendingChecks;
}

function isStale(facts: PullRequestFacts, now: Date): boolean {
  const lastActivityAt = new Date(computeLastActivityAt(facts)).getTime();
  const ageMs = now.getTime() - lastActivityAt;
  return ageMs > STALE_DAYS * 24 * 60 * 60 * 1000;
}

/** FR-2.5: build every predicate, then report the first match in precedence order. */
export function deriveStatus(facts: PullRequestFacts, now: Date = new Date()): Status {
  const readyBase = isReadyBase(facts);
  const matches: Record<Status, boolean> = {
    DRAFT: facts.isDraft,
    CONFLICTED: facts.mergeableState === "CONFLICTING",
    CI_FAILING: facts.checkRollupState === "FAILURE",
    CHANGES_REQUESTED: facts.reviewDecision === "CHANGES_REQUESTED",
    REVIEW_STALE: readyBase && isApprovalStale(facts),
    READY_TO_MERGE: readyBase,
    STALE: isStale(facts, now),
    NEEDS_REVIEW: true,
  };
  for (const status of STATUS_PRECEDENCE) {
    if (matches[status]) return status;
  }
  // Unreachable: NEEDS_REVIEW is always true, so the loop always returns above.
  return "NEEDS_REVIEW";
}
