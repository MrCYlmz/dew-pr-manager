import { describe, expect, test } from "bun:test";
import { assignMentions, extractMentionedKeys } from "../src/domain/references.ts";
import { makeDerived } from "./helpers.ts";

const known = new Set(["acme/widgets#1", "acme/widgets#7", "acme/widgets-openapi#45", "acme/billing#3"]);
const self = { key: "acme/widgets#1", repo: "acme/widgets", body: "" };

describe("extractMentionedKeys", () => {
  test("qualified owner/repo#N", () => {
    expect(extractMentionedKeys({ ...self, body: "Spec: acme/widgets-openapi#45" }, known)).toEqual([
      "acme/widgets-openapi#45",
    ]);
  });

  test("bare #N resolves against the mentioning PR's own repo", () => {
    expect(extractMentionedKeys({ ...self, body: "Depends on #7" }, known)).toEqual(["acme/widgets#7"]);
  });

  test("a full pull request URL", () => {
    expect(
      extractMentionedKeys({ ...self, body: "See https://github.com/acme/billing/pull/3 for context" }, known),
    ).toEqual(["acme/billing#3"]);
  });

  test("a qualified reference is not also read as a bare one", () => {
    expect(extractMentionedKeys({ ...self, body: "Blocked by acme/billing#7" }, known)).toEqual([]);
  });

  test("unknown PRs, issue numbers and the PR itself are dropped", () => {
    const body = "Closes #99, supersedes #1, relates to other/repo#2 and https://github.com/x/y/pull/8";
    expect(extractMentionedKeys({ ...self, body }, known)).toEqual([]);
  });

  test("deduplicates, keeping first-appearance order", () => {
    const body = "#7 first, then acme/widgets-openapi#45, then #7 again and acme/widgets#7 once more";
    expect(extractMentionedKeys({ ...self, body }, known)).toEqual(["acme/widgets#7", "acme/widgets-openapi#45"]);
  });

  test("leading zeros and surrounding punctuation", () => {
    expect(extractMentionedKeys({ ...self, body: "(see #007)." }, known)).toEqual(["acme/widgets#7"]);
  });

  test("does not match inside a word or a path", () => {
    expect(extractMentionedKeys({ ...self, body: "color #7 is fine but src/acme/widgets#7 and abc#7 are not" }, known))
      .toEqual(["acme/widgets#7"]);
  });

  test("empty description", () => {
    expect(extractMentionedKeys(self, known)).toEqual([]);
  });
});

describe("assignMentions", () => {
  test("resolves against the scan itself", () => {
    const prs = assignMentions([
      makeDerived({ key: "acme/widgets#1", number: 1, body: "Spec: acme/widgets-openapi#45, plus #2" }),
      makeDerived({ key: "acme/widgets#2", number: 2, body: "" }),
      makeDerived({ key: "acme/widgets-openapi#45", repo: "acme/widgets-openapi", repoName: "widgets-openapi", number: 45, body: "Consumed by acme/widgets#1" }),
    ]);
    expect(prs.map((p) => p.mentions)).toEqual([["acme/widgets-openapi#45", "acme/widgets#2"], [], ["acme/widgets#1"]]);
  });
});
