import { describe, expect, test } from "bun:test";
import {
  assignSetKeys,
  extractSetLabel,
  groupIntoChangeSets,
  isSpecPR,
  normalizeSpecRule,
} from "../src/domain/changeSets.ts";
import { DEFAULT_SPEC_RULE } from "../src/config.ts";
import { makeDerived, makeFacts } from "./helpers.ts";

describe("isSpecPR", () => {
  test("repo name ending in -openapi", () => {
    expect(isSpecPR(makeFacts({ repoName: "billing-openapi" }))).toBe(true);
  });

  test("a changed file mentioning openapi or swagger", () => {
    expect(isSpecPR(makeFacts({ changedFilePaths: ["docs/swagger.yaml"] }))).toBe(true);
  });

  test("neither signal present", () => {
    expect(isSpecPR(makeFacts({ repoName: "billing", changedFilePaths: ["src/index.ts"] }))).toBe(false);
  });

  test("the user's own words replace the defaults", () => {
    const rule = normalizeSpecRule({ repoSuffixes: ["-contracts"], fileKeywords: ["proto"] });
    expect(isSpecPR(makeFacts({ repoName: "billing-openapi" }), rule)).toBe(false);
    expect(isSpecPR(makeFacts({ repoName: "billing-contracts" }), rule)).toBe(true);
    expect(isSpecPR(makeFacts({ changedFilePaths: ["api/v1/billing.proto"] }), rule)).toBe(true);
    expect(isSpecPR(makeFacts({ changedFilePaths: ["docs/swagger.yaml"] }), rule)).toBe(false);
  });

  test("each half can be switched off on its own", () => {
    const suffixOnly = normalizeSpecRule({ useFileKeywords: false });
    expect(isSpecPR(makeFacts({ changedFilePaths: ["docs/swagger.yaml"] }), suffixOnly)).toBe(false);
    expect(isSpecPR(makeFacts({ repoName: "billing-openapi" }), suffixOnly)).toBe(true);

    const filesOnly = normalizeSpecRule({ useRepoSuffix: false });
    expect(isSpecPR(makeFacts({ repoName: "billing-openapi" }), filesOnly)).toBe(false);
    expect(isSpecPR(makeFacts({ changedFilePaths: ["docs/swagger.yaml"] }), filesOnly)).toBe(true);
  });

  test("both halves off means nothing is a spec PR", () => {
    const off = normalizeSpecRule({ useRepoSuffix: false, useFileKeywords: false });
    expect(isSpecPR(makeFacts({ repoName: "billing-openapi", changedFilePaths: ["openapi.yaml"] }), off)).toBe(false);
  });

  test("matching ignores case", () => {
    const rule = normalizeSpecRule({ repoSuffixes: ["-OpenAPI"] });
    expect(isSpecPR(makeFacts({ repoName: "Billing-openapi" }), rule)).toBe(true);
    expect(isSpecPR(makeFacts({ changedFilePaths: ["API/OpenAPI.yaml"] }))).toBe(true);
  });
});

describe("normalizeSpecRule", () => {
  test("nothing stored means the defaults", () => {
    expect(normalizeSpecRule(undefined)).toEqual(DEFAULT_SPEC_RULE);
    expect(normalizeSpecRule({})).toEqual(DEFAULT_SPEC_RULE);
    expect(normalizeSpecRule("garbage")).toEqual(DEFAULT_SPEC_RULE);
  });

  test("accepts a comma or newline separated string and cleans it", () => {
    expect(normalizeSpecRule({ fileKeywords: " OpenAPI, swagger\n\n proto ,swagger, " }).fileKeywords).toEqual([
      "openapi",
      "swagger",
      "proto",
    ]);
  });

  test("an explicitly empty list stays empty rather than falling back", () => {
    expect(normalizeSpecRule({ repoSuffixes: "" }).repoSuffixes).toEqual([]);
    expect(normalizeSpecRule({ repoSuffixes: [] }).repoSuffixes).toEqual([]);
  });

  test("non-boolean switches fall back to the default", () => {
    expect(normalizeSpecRule({ useRepoSuffix: "no" }).useRepoSuffix).toBe(true);
    expect(normalizeSpecRule({ useRepoSuffix: false }).useRepoSuffix).toBe(false);
  });
});

describe("extractSetLabel", () => {
  test("first number in the branch name", () => {
    expect(extractSetLabel("feature/PROJ-482-widgets")).toBe("482");
  });

  test("falls back to the branch name with no number", () => {
    expect(extractSetLabel("feature/widgets")).toBe("feature/widgets");
  });
});

describe("assignSetKeys", () => {
  test("uses the branch name with no manual link", () => {
    const [pr] = assignSetKeys([makeDerived({ headRefName: "feature-1" })], {});
    expect(pr!.setKey).toBe("feature-1");
    expect(pr!.manuallyLinked).toBe(false);
  });

  test("a manual link overrides the branch-name grouping", () => {
    const pr = makeDerived({ key: "acme/widgets#1", headRefName: "feature-1" });
    const [linked] = assignSetKeys([pr], { "acme/widgets#1": "feature-9" });
    expect(linked!.setKey).toBe("feature-9");
    expect(linked!.manuallyLinked).toBe(true);
  });
});

describe("groupIntoChangeSets", () => {
  test("same branch name across repos is one set", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1" }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1" }),
      ],
      {},
    );
    const sets = groupIntoChangeSets(prs);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.members).toHaveLength(2);
  });

  test("spec PRs are step 1, consumers step 2, with no order claimed inside a step", () => {
    const prs = assignSetKeys(
      [
        makeDerived({
          key: "acme/consumer#1",
          headRefName: "feature-1",
          isSpecPR: false,
          createdAt: "2026-09-01T00:00:00Z",
        }),
        makeDerived({
          key: "acme/spec#1",
          headRefName: "feature-1",
          isSpecPR: true,
          createdAt: "2026-09-05T00:00:00Z",
        }),
        makeDerived({
          key: "acme/consumer#2",
          headRefName: "feature-1",
          isSpecPR: false,
          createdAt: "2026-08-01T00:00:00Z",
        }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.mergeOrderKnown).toBe(true);
    expect(set!.members.map((m) => [m.key, m.mergeStep])).toEqual([
      ["acme/spec#1", 1],
      ["acme/consumer#1", 2],
      ["acme/consumer#2", 2],
    ]);
  });

  test("several spec PRs all share step 1", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/b-openapi#7", headRefName: "feature-1", isSpecPR: true }),
        makeDerived({ key: "acme/a-openapi#3", headRefName: "feature-1", isSpecPR: true }),
        makeDerived({ key: "acme/app#9", headRefName: "feature-1", isSpecPR: false }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.members.map((m) => m.mergeStep)).toEqual([1, 1, 2]);
  });

  test("no spec member means merge order is reported unknown", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1", isSpecPR: false }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1", isSpecPR: false }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.mergeOrderKnown).toBe(false);
    expect(set!.members.every((m) => m.mergeStep === null)).toBe(true);
  });

  test("ready-to-merge set only when every member is", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1", status: "READY_TO_MERGE" }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1", status: "NEEDS_REVIEW" }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.status).toBe("NEEDS_REVIEW");
  });

  test("two drafts and a failing spec PR is a failing set", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1", status: "DRAFT" }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1", status: "DRAFT" }),
        makeDerived({ key: "acme/spec#3", headRefName: "feature-1", status: "CI_FAILING" }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.status).toBe("CI_FAILING");
  });

  test("mixed draft and ready-to-merge with nothing else falls back to draft", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1", status: "DRAFT" }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1", status: "READY_TO_MERGE" }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.status).toBe("DRAFT");
  });

  test("set owner is the owner of the member that set its status", () => {
    const prs = assignSetKeys(
      [
        makeDerived({ key: "acme/a#1", headRefName: "feature-1", status: "NEEDS_REVIEW", owner: "reviewers" }),
        makeDerived({ key: "acme/b#2", headRefName: "feature-1", status: "CHANGES_REQUESTED", owner: "author" }),
      ],
      {},
    );
    const [set] = groupIntoChangeSets(prs);
    expect(set!.status).toBe("CHANGES_REQUESTED");
    expect(set!.owner).toBe("author");
  });

  test("hasManualLink is true when any member was manually linked", () => {
    const pr = makeDerived({ key: "acme/a#1", headRefName: "feature-1" });
    const [linked] = assignSetKeys([pr], { "acme/a#1": "feature-9" });
    const [set] = groupIntoChangeSets([linked!]);
    expect(set!.hasManualLink).toBe(true);
  });
});
