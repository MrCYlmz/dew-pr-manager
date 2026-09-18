import type { Owner, PullRequestFacts, Status } from "../types.ts";

const WAITING_FOR_A_LOOK: ReadonlySet<Status> = new Set(["NEEDS_REVIEW", "REVIEW_STALE"]);

/**
 * FR-3.9: a healthy PR waiting for a look (NEEDS_REVIEW or REVIEW_STALE) is owned by the
 * viewer when they're a requested reviewer, otherwise by `reviewers`. Every other status is
 * owned by the viewer if they authored it, otherwise by `author`.
 */
export function deriveOwner(status: Status, facts: PullRequestFacts, viewerLogin: string): Owner {
  const viewer = viewerLogin.toLowerCase();
  if (WAITING_FOR_A_LOOK.has(status)) {
    const isRequestedReviewer = facts.requestedReviewers.some((r) => r.toLowerCase() === viewer);
    return isRequestedReviewer ? "you" : "reviewers";
  }
  return facts.author.toLowerCase() === viewer ? "you" : "author";
}
