import type { Owner, PullRequestFacts, Status } from "../types.ts";

const WAITING_FOR_A_LOOK: ReadonlySet<Status> = new Set(["NEEDS_REVIEW", "REVIEW_STALE"]);

export function deriveOwner(status: Status, facts: PullRequestFacts, viewerLogin: string): Owner {
  const viewer = viewerLogin.toLowerCase();
  if (WAITING_FOR_A_LOOK.has(status)) {
    const isRequestedReviewer = facts.requestedReviewers.some((r) => r.toLowerCase() === viewer);
    return isRequestedReviewer ? "you" : "reviewers";
  }
  return facts.author.toLowerCase() === viewer ? "you" : "author";
}
