import type { DerivedPullRequest, PullRequestFacts } from "../src/types.ts";

export function makeFacts(overrides: Partial<PullRequestFacts> = {}): PullRequestFacts {
  return {
    key: "acme/widgets#1",
    owner: "acme",
    repo: "acme/widgets",
    repoName: "widgets",
    number: 1,
    title: "Add widget",
    url: "https://github.com/acme/widgets/pull/1",
    author: "alice",
    authorIsBot: false,
    headRefName: "feature-1",
    baseRefName: "main",
    isDraft: false,
    mergeableState: "MERGEABLE",
    reviewDecision: "REVIEW_REQUIRED",
    reviews: [],
    requestedReviewers: [],
    headCommitSha: "sha-head",
    checkRollupState: "SUCCESS",
    checks: [],
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    changedFilePaths: ["src/widget.ts"],
    createdAt: "2026-09-10T00:00:00Z",
    lastCommitAt: "2026-09-10T00:00:00Z",
    lastCommentAt: null,
    lastReviewAt: null,
    body: "",
    ...overrides,
  };
}

export function makeDerived(overrides: Partial<DerivedPullRequest> = {}): DerivedPullRequest {
  const facts = makeFacts(overrides);
  return {
    ...facts,
    status: "NEEDS_REVIEW",
    owner: "reviewers",
    lastActivityAt: facts.createdAt,
    isSpecPR: false,
    branchSetKey: facts.headRefName,
    setKey: facts.headRefName,
    manuallyLinked: false,
    mentions: [],
    mergeStep: null,
    ...overrides,
  };
}
