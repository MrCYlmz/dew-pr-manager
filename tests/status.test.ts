import { describe, expect, test } from "bun:test";
import { computeLastActivityAt, deriveStatus, isApprovalStale } from "../src/domain/status.ts";
import { makeFacts } from "./helpers.ts";

const NOW = new Date("2026-09-18T00:00:00Z");

describe("deriveStatus precedence", () => {
  test("draft beats everything else", () => {
    const facts = makeFacts({ isDraft: true, mergeableState: "CONFLICTING" });
    expect(deriveStatus(facts, NOW)).toBe("DRAFT");
  });

  test("conflicted beats CI failing", () => {
    const facts = makeFacts({ mergeableState: "CONFLICTING", checkRollupState: "FAILURE" });
    expect(deriveStatus(facts, NOW)).toBe("CONFLICTED");
  });

  test("CI failing beats changes requested", () => {
    const facts = makeFacts({ checkRollupState: "FAILURE", reviewDecision: "CHANGES_REQUESTED" });
    expect(deriveStatus(facts, NOW)).toBe("CI_FAILING");
  });

  test("changes requested reported as-is", () => {
    const facts = makeFacts({ reviewDecision: "CHANGES_REQUESTED" });
    expect(deriveStatus(facts, NOW)).toBe("CHANGES_REQUESTED");
  });

  test("approved + mergeable + no pending checks is ready to merge", () => {
    const facts = makeFacts({
      reviewDecision: "APPROVED",
      reviews: [{ author: "bob", state: "APPROVED", submittedAt: "2026-09-11T00:00:00Z", commitSha: "sha-head" }],
    });
    expect(deriveStatus(facts, NOW)).toBe("READY_TO_MERGE");
  });

  test("approval predating the current head commit is review-stale, not ready", () => {
    const facts = makeFacts({
      reviewDecision: "APPROVED",
      headCommitSha: "sha-2",
      reviews: [{ author: "bob", state: "APPROVED", submittedAt: "2026-09-11T00:00:00Z", commitSha: "sha-1" }],
    });
    expect(isApprovalStale(facts)).toBe(true);
    expect(deriveStatus(facts, NOW)).toBe("REVIEW_STALE");
  });

  test("a later re-approval against the new head clears review-stale", () => {
    const facts = makeFacts({
      reviewDecision: "APPROVED",
      headCommitSha: "sha-2",
      reviews: [
        { author: "bob", state: "APPROVED", submittedAt: "2026-09-11T00:00:00Z", commitSha: "sha-1" },
        { author: "bob", state: "APPROVED", submittedAt: "2026-09-12T00:00:00Z", commitSha: "sha-2" },
      ],
    });
    expect(deriveStatus(facts, NOW)).toBe("READY_TO_MERGE");
  });

  test("pending checks block ready-to-merge and fall through to needs-review", () => {
    const facts = makeFacts({
      reviewDecision: "APPROVED",
      checkRollupState: "PENDING",
      lastCommitAt: "2026-09-17T00:00:00Z",
    });
    expect(deriveStatus(facts, NOW)).toBe("NEEDS_REVIEW");
  });

  test("more than 7 days since last activity is stale", () => {
    const facts = makeFacts({ lastCommitAt: "2026-09-01T00:00:00Z" });
    expect(deriveStatus(facts, NOW)).toBe("STALE");
  });

  test("ready-to-merge outranks staleness", () => {
    const facts = makeFacts({
      reviewDecision: "APPROVED",
      lastCommitAt: "2026-09-01T00:00:00Z",
      reviews: [{ author: "bob", state: "APPROVED", submittedAt: "2026-09-01T00:00:00Z", commitSha: "sha-head" }],
    });
    expect(deriveStatus(facts, NOW)).toBe("READY_TO_MERGE");
  });

  test("no matching signal falls back to needs-review", () => {
    const facts = makeFacts({ lastCommitAt: "2026-09-17T00:00:00Z" });
    expect(deriveStatus(facts, NOW)).toBe("NEEDS_REVIEW");
  });
});

describe("computeLastActivityAt", () => {
  test("picks the latest of commit, comment and review", () => {
    const facts = makeFacts({
      createdAt: "2026-09-01T00:00:00Z",
      lastCommitAt: "2026-09-05T00:00:00Z",
      lastCommentAt: "2026-09-12T00:00:00Z",
      lastReviewAt: "2026-09-08T00:00:00Z",
    });
    expect(computeLastActivityAt(facts)).toBe("2026-09-12T00:00:00Z");
  });

  test("falls back to createdAt with no other signals", () => {
    const facts = makeFacts({ createdAt: "2026-09-01T00:00:00Z", lastCommitAt: null });
    expect(computeLastActivityAt(facts)).toBe("2026-09-01T00:00:00Z");
  });
});
