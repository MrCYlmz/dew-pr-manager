import { describe, expect, test } from "bun:test";
import { BUCKETS, bucketFor } from "../public/buckets.js";
import type { Owner, Status } from "../src/types.ts";
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

const STATUS_BUCKET: Partial<Record<Status, string>> = {
  READY_TO_MERGE: "Ready to merge",
  DRAFT: "Drafts",
  STALE: "Rotting",
};
const OWNER_BUCKET: Record<Owner, string> = {
  you: "Waiting on you",
  reviewers: "Waiting on reviewers",
  author: "Waiting on the author",
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

function titleFor(set: ReturnType<typeof setOf>) {
  return bucketFor(set)?.title;
}

describe("bucket list", () => {
  test("lists seven buckets in page order with waiting on the author after waiting on reviewers", () => {
    const titles = [...BUCKETS].sort((a, b) => a.rank - b.rank).map((b) => b.title);
    expect(titles).toEqual([
      "Waiting on you",
      "Ready to merge",
      "Rotting",
      "Waiting on reviewers",
      "Waiting on the author",
      "Drafts",
      "Bot PRs",
    ]);
  });

  test("every bucket has a one-line description", () => {
    for (const bucket of BUCKETS) {
      expect(bucket.desc.trim().length).toBeGreaterThan(0);
      expect(bucket.desc).not.toContain("\n");
    }
  });
});

describe("waiting on the author", () => {
  for (const status of ["CHANGES_REQUESTED", "CI_FAILING", "CONFLICTED"] as const) {
    test(`a single ${status} PR owned by its author lands in waiting on the author`, () => {
      expect(titleFor(setOf(status, "author"))).toBe("Waiting on the author");
    });

    test(`a multi-PR ${status} set owned by its author lands in waiting on the author`, () => {
      expect(titleFor(setOf(status, "author", { size: 3 }))).toBe("Waiting on the author");
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
    expect(titleFor(set)).toBe("Waiting on the author");
  });
});

describe("bucket precedence", () => {
  test("bot PRs beats every status and owner", () => {
    for (const status of STATUSES) {
      for (const owner of OWNERS) {
        expect(titleFor(setOf(status, owner, { bot: true }))).toBe("Bot PRs");
      }
    }
  });

  test("a set with a human member is not a bot PR", () => {
    const members = [
      makeDerived({ key: "acme/a#1", authorIsBot: true, status: "CI_FAILING", owner: "author" }),
      makeDerived({ key: "acme/b#2", authorIsBot: false, status: "CI_FAILING", owner: "author" }),
    ];
    const set = makeChangeSet({ members, status: "CI_FAILING", owner: "author" });
    expect(titleFor(set)).toBe("Waiting on the author");
  });

  for (const [status, title] of Object.entries(STATUS_BUCKET)) {
    for (const owner of OWNERS) {
      test(`${title.toLowerCase()} beats waiting on ${owner === "you" ? "you" : `the ${owner}`}`, () => {
        expect(titleFor(setOf(status as Status, owner))).toBe(title);
      });
    }
  }
});

describe("every change set lands in exactly one bucket", () => {
  test("every combination of status and owner maps to exactly one bucket", () => {
    for (const status of STATUSES) {
      for (const owner of OWNERS) {
        for (const size of [1, 2]) {
          const set = setOf(status, owner, { size });
          const bucket = bucketFor(set);
          expect(bucket).toBeDefined();
          expect(bucket).not.toBeNull();
          expect(BUCKETS.filter((b) => b === bucket)).toHaveLength(1);
          expect(bucket?.title).toBe(STATUS_BUCKET[status] ?? OWNER_BUCKET[owner]);
        }
      }
    }
  });

  test("bucket titles are unique", () => {
    const titles = BUCKETS.map((b) => b.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
