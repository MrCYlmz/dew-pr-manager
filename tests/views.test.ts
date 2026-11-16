import { describe, expect, test } from "bun:test";
import { countForView, setMatchesView } from "../client/views.ts";
import { makeChangeSet, makeDerived } from "./helpers.ts";

const VIEWER = "me";

function pr(n: number, author: string, requestedReviewers: string[] = []) {
  return makeDerived({ key: `acme/widgets#${n}`, number: n, author, requestedReviewers, headRefName: `feature-${n}`, setKey: `feature-${n}` });
}

const authoredByViewer = makeChangeSet({ members: [pr(1, VIEWER)] });
const reviewRequestedFromViewer = makeChangeSet({ members: [pr(2, "alice", [VIEWER])] });
const othersOnly = makeChangeSet({ members: [pr(3, "bob", ["carol"])] });
const mixed = makeChangeSet({ members: [pr(4, VIEWER), pr(5, "alice", [VIEWER]), pr(6, "bob")] });
const ALL_SETS = [authoredByViewer, reviewRequestedFromViewer, othersOnly, mixed];

function matching(view: "overview" | "mine" | "review", viewerLogin: string | null) {
  return ALL_SETS.filter((s) => setMatchesView(s, view, viewerLogin));
}

describe("Overview", () => {
  test("shows every set", () => {
    expect(matching("overview", VIEWER)).toEqual(ALL_SETS);
  });

  test("shows every set without a viewer login", () => {
    expect(matching("overview", null)).toEqual(ALL_SETS);
  });

  test("counts every distinct PR", () => {
    expect(countForView({ sets: ALL_SETS }, "overview", VIEWER)).toBe(6);
  });
});

describe("My PRs", () => {
  test("shows the sets with a PR the viewer authored", () => {
    expect(matching("mine", VIEWER)).toEqual([authoredByViewer, mixed]);
  });

  test("a set with PRs from the viewer and others is shown whole and counted whole", () => {
    expect(setMatchesView(mixed, "mine", VIEWER)).toBe(true);
    expect(countForView({ sets: [mixed] }, "mine", VIEWER)).toBe(3);
  });

  test("a review request alone does not put a set on My PRs", () => {
    expect(setMatchesView(reviewRequestedFromViewer, "mine", VIEWER)).toBe(false);
  });

  test("shows nothing without a viewer login", () => {
    expect(matching("mine", null)).toEqual([]);
    expect(countForView({ sets: ALL_SETS }, "mine", null)).toBe(0);
  });

  test("counts the PRs in the matching sets", () => {
    expect(countForView({ sets: ALL_SETS }, "mine", VIEWER)).toBe(4);
  });
});

describe("To review", () => {
  test("shows the sets with a PR where the viewer is a requested reviewer", () => {
    expect(matching("review", VIEWER)).toEqual([reviewRequestedFromViewer, mixed]);
  });

  test("a set with PRs from the viewer and others is shown whole and counted whole", () => {
    expect(setMatchesView(mixed, "review", VIEWER)).toBe(true);
    expect(countForView({ sets: [mixed] }, "review", VIEWER)).toBe(3);
  });

  test("authoring a PR does not put its set on To review", () => {
    expect(setMatchesView(authoredByViewer, "review", VIEWER)).toBe(false);
  });

  test("a review requested from someone else does not match", () => {
    expect(setMatchesView(othersOnly, "review", VIEWER)).toBe(false);
  });

  test("shows nothing without a viewer login", () => {
    expect(matching("review", null)).toEqual([]);
    expect(countForView({ sets: ALL_SETS }, "review", null)).toBe(0);
  });

  test("counts the PRs in the matching sets", () => {
    expect(countForView({ sets: ALL_SETS }, "review", VIEWER)).toBe(4);
  });
});

describe("view count", () => {
  test("a PR listed in two matching sets is counted once", () => {
    const shared = pr(7, VIEWER);
    const sets = [makeChangeSet({ members: [shared] }), makeChangeSet({ members: [shared, pr(8, "alice")] })];
    expect(countForView({ sets }, "overview", VIEWER)).toBe(2);
    expect(countForView({ sets }, "mine", VIEWER)).toBe(2);
  });

  test("no sets count zero", () => {
    expect(countForView({ sets: [] }, "overview", VIEWER)).toBe(0);
  });
});
