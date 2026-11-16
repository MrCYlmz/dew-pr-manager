import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from "bun:test";
import type { Snapshot } from "../src/store.ts";
import type { AppState, Bucket, HistoryEvent, PullRequestFacts } from "../src/types.ts";
import { makeFacts } from "./helpers.ts";

const VIEWER = "viewer";
const BUCKET_KEYS: Bucket[] = ["you", "ready", "rotting", "reviewers", "author", "draft", "bot"];

const store: {
  snapshot: Snapshot | null;
  links: Record<string, string>;
  history: HistoryEvent[];
  specRule: unknown;
} = { snapshot: null, links: {}, history: [], specRule: null };

let collect: () => Promise<{ viewerLogin: string; prs: PullRequestFacts[] }>;

mock.module("../src/github.ts", () => ({
  collectOpenPullRequests: () => collect(),
}));

mock.module("../src/store.ts", () => ({
  readLinks: async () => store.links,
  readNotes: async () => ({}),
  readHistory: async () => store.history,
  writeHistory: async (events: HistoryEvent[]) => {
    store.history = events;
  },
  readSnapshot: async () => store.snapshot,
  writeSnapshot: async (snapshot: Snapshot) => {
    store.snapshot = snapshot;
  },
  readSpecRuleSetting: async () => store.specRule,
  readNotifySetting: async () => false,
}));

const { regroup, runScan } = await import("../src/scan.ts");

function pr(number: number, overrides: Partial<PullRequestFacts>): PullRequestFacts {
  return makeFacts({
    key: `acme/api#${number}`,
    repo: "acme/api",
    repoName: "api",
    number,
    url: `https://github.com/acme/api/pull/${number}`,
    headRefName: `feature-${number}`,
    createdAt: "2026-09-10T00:00:00Z",
    lastCommitAt: "2026-09-10T00:00:00Z",
    ...overrides,
  });
}

const ON_REVIEW_AUTHOR_MUST_ACT = pr(1, {
  author: "alice",
  requestedReviewers: [VIEWER],
  reviewDecision: "CHANGES_REQUESTED",
});
const ON_REVIEW_WAITING_FOR_YOU = pr(2, { author: "alice", requestedReviewers: [VIEWER] });
const MINE_WAITING_FOR_REVIEWERS = pr(3, { author: VIEWER, requestedReviewers: ["bob"] });
const MINE_READY = pr(4, {
  author: VIEWER,
  reviewDecision: "APPROVED",
  reviews: [{ author: "bob", state: "APPROVED", submittedAt: "2026-09-10T00:00:00Z", commitSha: "sha-head" }],
});
const MINE_DRAFT = pr(5, { author: VIEWER, isDraft: true });
const BOT_ON_REVIEW = pr(6, { author: "dependabot[bot]", authorIsBot: true, requestedReviewers: [VIEWER] });
const MINE_ROTTING = pr(7, {
  author: VIEWER,
  createdAt: "2026-08-01T00:00:00Z",
  lastCommitAt: "2026-08-01T00:00:00Z",
});
const MULTI_AUTHOR_MUST_ACT = [
  pr(8, { author: "alice", requestedReviewers: [VIEWER], headRefName: "feature-8", checkRollupState: "FAILURE" }),
  makeFacts({
    key: "acme/web#9",
    repo: "acme/web",
    repoName: "web",
    number: 9,
    author: "alice",
    requestedReviewers: [VIEWER],
    headRefName: "feature-8",
    checkRollupState: "FAILURE",
    createdAt: "2026-09-10T00:00:00Z",
    lastCommitAt: "2026-09-10T00:00:00Z",
  }),
];

const ALL_PRS = [
  ON_REVIEW_AUTHOR_MUST_ACT,
  ON_REVIEW_WAITING_FOR_YOU,
  MINE_WAITING_FOR_REVIEWERS,
  MINE_READY,
  MINE_DRAFT,
  BOT_ON_REVIEW,
  MINE_ROTTING,
  ...MULTI_AUTHOR_MUST_ACT,
];

const EXPECTED_BUCKETS: Record<string, Bucket> = {
  "feature-1": "author",
  "feature-2": "you",
  "feature-3": "reviewers",
  "feature-4": "ready",
  "feature-5": "draft",
  "feature-6": "bot",
  "feature-7": "rotting",
  "feature-8": "author",
};

function bucketsBySet(state: AppState | null): Record<string, Bucket> {
  return Object.fromEntries((state?.sets ?? []).map((set) => [set.key, set.bucket]));
}

beforeEach(() => {
  setSystemTime(new Date("2026-09-12T00:00:00Z"));
  store.snapshot = null;
  store.links = {};
  store.history = [];
  store.specRule = null;
  collect = async () => ({ viewerLogin: VIEWER, prs: ALL_PRS });
});

afterEach(() => {
  setSystemTime();
});

describe("bucket after a scan", () => {
  test("every change set carries the bucket the spec's precedence names", async () => {
    const state = await runScan();
    expect(state.sets).toHaveLength(Object.keys(EXPECTED_BUCKETS).length);
    expect(bucketsBySet(state)).toEqual(EXPECTED_BUCKETS);
  });

  test("a PR you review whose author must act is in waiting on the author, as a single PR and in a multi-PR set", async () => {
    const state = await runScan();
    const single = state.sets.find((set) => set.key === "feature-1");
    const multi = state.sets.find((set) => set.key === "feature-8");
    expect(single?.members).toHaveLength(1);
    expect(single?.bucket).toBe("author");
    expect(multi?.members).toHaveLength(2);
    expect(multi?.bucket).toBe("author");
  });

  test("every change set has a bucket from the closed set of keys", async () => {
    const state = await runScan();
    for (const set of state.sets) {
      expect(BUCKET_KEYS).toContain(set.bucket);
    }
  });

  test("a failed scan keeps the last good sets with their buckets", async () => {
    await runScan();
    collect = async () => {
      throw new Error("gh failed");
    };
    const state = await runScan();
    expect(state.meta.error).toBe("gh failed");
    expect(bucketsBySet(state)).toEqual(EXPECTED_BUCKETS);
  });
});

describe("bucket after a regroup", () => {
  test("regroup without changes keeps every set's bucket", async () => {
    await runScan();
    const state = await regroup();
    expect(bucketsBySet(state)).toEqual(EXPECTED_BUCKETS);
  });

  test("a manual link moves the set into the bucket of its new combined status and owner", async () => {
    await runScan();
    store.links = { [MINE_READY.key]: "feature-3" };
    const state = await regroup();
    const { "feature-4": _ready, ...rest } = EXPECTED_BUCKETS;
    expect(bucketsBySet(state)).toEqual({ ...rest, "feature-3": "reviewers" });
  });

  test("a spec rule edit leaves every set with its bucket", async () => {
    await runScan();
    store.specRule = { useRepoSuffix: true, repoSuffixes: ["web"], useFileKeywords: false, fileKeywords: [] };
    const state = await regroup();
    expect(state?.sets.find((set) => set.key === "feature-8")?.members[0]?.isSpecPR).toBe(true);
    expect(bucketsBySet(state)).toEqual(EXPECTED_BUCKETS);
  });
});
