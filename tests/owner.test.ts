import { describe, expect, test } from "bun:test";
import { deriveOwner } from "../src/domain/owner.ts";
import { makeFacts } from "./helpers.ts";

describe("deriveOwner", () => {
  test("needs-review is owned by you when you're a requested reviewer", () => {
    const facts = makeFacts({ author: "alice", requestedReviewers: ["viewer"] });
    expect(deriveOwner("NEEDS_REVIEW", facts, "viewer")).toBe("you");
  });

  test("needs-review is owned by reviewers when you're not requested", () => {
    const facts = makeFacts({ author: "alice", requestedReviewers: ["bob"] });
    expect(deriveOwner("NEEDS_REVIEW", facts, "viewer")).toBe("reviewers");
  });

  test("review-stale follows the same waiting-for-a-look rule as needs-review", () => {
    const facts = makeFacts({ author: "alice", requestedReviewers: ["viewer"] });
    expect(deriveOwner("REVIEW_STALE", facts, "viewer")).toBe("you");
  });

  test("blocked statuses are owned by you when you authored the PR", () => {
    const facts = makeFacts({ author: "viewer" });
    expect(deriveOwner("CHANGES_REQUESTED", facts, "viewer")).toBe("you");
    expect(deriveOwner("CONFLICTED", facts, "viewer")).toBe("you");
    expect(deriveOwner("STALE", facts, "viewer")).toBe("you");
  });

  test("blocked statuses are owned by the author when someone else wrote the PR", () => {
    const facts = makeFacts({ author: "alice" });
    expect(deriveOwner("CI_FAILING", facts, "viewer")).toBe("author");
  });

  test("ready-to-merge follows the blocked-status rule, not reviewers", () => {
    const facts = makeFacts({ author: "alice" });
    expect(deriveOwner("READY_TO_MERGE", facts, "viewer")).toBe("author");
    expect(deriveOwner("READY_TO_MERGE", makeFacts({ author: "viewer" }), "viewer")).toBe("you");
  });

  test("login comparison is case-insensitive", () => {
    const facts = makeFacts({ author: "Alice" });
    expect(deriveOwner("STALE", facts, "alice")).toBe("you");
  });
});
