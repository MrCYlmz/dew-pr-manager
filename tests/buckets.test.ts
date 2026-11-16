import { describe, expect, test } from "bun:test";
import { deriveBucket } from "../src/domain/buckets.ts";
import type { Bucket, Owner, Status } from "../src/types.ts";
import { makeChangeSet, makeDerived } from "./helpers.ts";

const STATUSES: Status[] = [
  "DRAFT",
  "CONFLICTED",
  "CI_FAILING",
  "CHANGES_REQUESTED",
  "REVIEW_STALE",
  "READY_TO_MERGE",
  "STALE",
  "NEEDS_REVIEW",
];
const OWNERS: Owner[] = ["you", "author", "reviewers"];
const BUCKET_KEYS: Bucket[] = ["you", "ready", "rotting", "reviewers", "author", "draft", "bot"];

const STATUS_BUCKET: Partial<Record<Status, Bucket>> = {
  READY_TO_MERGE: "ready",
  DRAFT: "draft",
  STALE: "rotting",
};
const OWNER_BUCKET: Record<Owner, Bucket> = {
  you: "you",
  reviewers: "reviewers",
  author: "author",
};

function setOf(status: Status, owner: Owner, { bot = false, size = 1 } = {}) {
  const members = Array.from({ length: size }, (_, i) =>
    makeDerived({
      key: `acme/repo-${i}#7`,
      repo: `acme/repo-${i}`,
      repoName: `repo-${i}`,
      number: 7,
      headRefName: "feature-7",
      setKey: "feature-7",
      author: bot ? "dependabot[bot]" : "alice",
      authorIsBot: bot,
      status,
      owner,
    }),
  );
  return makeChangeSet({ members, status, owner });
}

describe("waiting on the author", () => {
  for (const status of ["CHANGES_REQUESTED", "CI_FAILING", "CONFLICTED"] as const) {
    test(`a single ${status} PR owned by its author lands in waiting on the author`, () => {
      expect(deriveBucket(setOf(status, "author"))).toBe("author");
    });

    test(`a multi-PR ${status} set owned by its author lands in waiting on the author`, () => {
      expect(deriveBucket(setOf(status, "author", { size: 3 }))).toBe("author");
    });
  }

  test("a PR you are asked to review whose author must act lands in waiting on the author", () => {
    const pr = makeDerived({
      author: "alice",
      requestedReviewers: ["viewer"],
      status: "CHANGES_REQUESTED",
      owner: "author",
    });
    const set = makeChangeSet({ members: [pr], status: "CHANGES_REQUESTED", owner: "author" });
    expect(deriveBucket(set)).toBe("author");
  });
});

describe("waiting on you and waiting on reviewers", () => {
  test("a set you must act on lands in waiting on you", () => {
    expect(deriveBucket(setOf("NEEDS_REVIEW", "you"))).toBe("you");
    expect(deriveBucket(setOf("CI_FAILING", "you"))).toBe("you");
  });

  test("a set waiting for a look by others lands in waiting on reviewers", () => {
    expect(deriveBucket(setOf("NEEDS_REVIEW", "reviewers"))).toBe("reviewers");
    expect(deriveBucket(setOf("REVIEW_STALE", "reviewers"))).toBe("reviewers");
  });
});

describe("bucket precedence", () => {
  for (const status of STATUSES) {
    for (const owner of OWNERS) {
      test(`bot PRs beats ${status} owned by ${owner}`, () => {
        expect(deriveBucket(setOf(status, owner, { bot: true }))).toBe("bot");
        expect(deriveBucket(setOf(status, owner, { bot: true, size: 2 }))).toBe("bot");
      });
    }
  }

  test("a set with a human member is not a bot PR", () => {
    const members = [
      makeDerived({ key: "acme/a#1", author: "dependabot[bot]", authorIsBot: true, status: "CI_FAILING", owner: "author" }),
      makeDerived({ key: "acme/b#2", authorIsBot: false, status: "CI_FAILING", owner: "author" }),
    ];
    const set = makeChangeSet({ members, status: "CI_FAILING", owner: "author" });
    expect(deriveBucket(set)).toBe("author");
  });

  test("a mixed set that is ready to merge lands in ready to merge, not bot PRs", () => {
    const members = [
      makeDerived({ key: "acme/a#1", author: "dependabot[bot]", authorIsBot: true, status: "READY_TO_MERGE", owner: "you" }),
      makeDerived({ key: "acme/b#2", authorIsBot: false, status: "READY_TO_MERGE", owner: "you" }),
    ];
    const set = makeChangeSet({ members, status: "READY_TO_MERGE", owner: "you" });
    expect(deriveBucket(set)).toBe("ready");
  });

  for (const [status, bucket] of Object.entries(STATUS_BUCKET)) {
    for (const owner of OWNERS) {
      test(`${bucket} beats waiting on ${owner}`, () => {
        expect(deriveBucket(setOf(status as Status, owner))).toBe(bucket);
      });
    }
  }
});

describe("every change set lands in exactly one bucket", () => {
  test("every combination of status and owner, with and without bot members, maps to the bucket the spec's precedence names", () => {
    for (const status of STATUSES) {
      for (const owner of OWNERS) {
        for (const bot of [false, true]) {
          for (const size of [1, 2]) {
            const expected = bot ? "bot" : (STATUS_BUCKET[status] ?? OWNER_BUCKET[owner]);
            const bucket = deriveBucket(setOf(status, owner, { bot, size }));
            expect(BUCKET_KEYS).toContain(bucket);
            expect(bucket).toBe(expected);
          }
        }
      }
    }
  });

  test("the bucket follows the set's status and owner, not a member's", () => {
    const members = [
      makeDerived({ key: "acme/a#1", status: "READY_TO_MERGE", owner: "you" }),
      makeDerived({ key: "acme/b#2", status: "CI_FAILING", owner: "author" }),
    ];
    const set = makeChangeSet({ members, status: "CI_FAILING", owner: "author" });
    expect(deriveBucket(set)).toBe("author");
  });
});
