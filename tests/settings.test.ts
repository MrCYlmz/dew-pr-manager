import { describe, expect, test } from "bun:test";
import { previewSpecMatch, sameSettings, splitWords } from "../client/settings.ts";
import type { SpecRule } from "../src/types.ts";
import { makeFacts } from "./helpers.ts";

const RULE: SpecRule = {
  useRepoSuffix: true,
  repoSuffixes: ["-openapi"],
  useFileKeywords: true,
  fileKeywords: ["openapi", "swagger"],
};

const specRepo = makeFacts({ repoName: "payments-openapi", changedFilePaths: ["README.md"] });
const specFile = makeFacts({ repoName: "payments", changedFilePaths: ["src/app.ts", "api/swagger.yaml"] });
const plain = makeFacts({ repoName: "payments", changedFilePaths: ["src/app.ts"] });

describe("previewSpecMatch", () => {
  test("a repository ending in a suffix is a spec PR", () => {
    expect(previewSpecMatch(specRepo, RULE)).toBe(true);
  });

  test("a changed file containing a keyword makes a spec PR", () => {
    expect(previewSpecMatch(specFile, RULE)).toBe(true);
  });

  test("a PR matching neither half is not a spec PR", () => {
    expect(previewSpecMatch(plain, RULE)).toBe(false);
  });

  test("the suffix must end the repository name", () => {
    expect(previewSpecMatch(makeFacts({ repoName: "openapi-tools", changedFilePaths: [] }), { ...RULE, useFileKeywords: false })).toBe(false);
  });

  test("with the suffix switch off, a matching repository is not a spec PR", () => {
    expect(previewSpecMatch(specRepo, { ...RULE, useRepoSuffix: false })).toBe(false);
  });

  test("with the suffix switch off, a matching file still makes a spec PR", () => {
    expect(previewSpecMatch(specFile, { ...RULE, useRepoSuffix: false })).toBe(true);
  });

  test("with the keyword switch off, a matching file is not a spec PR", () => {
    expect(previewSpecMatch(specFile, { ...RULE, useFileKeywords: false })).toBe(false);
  });

  test("with the keyword switch off, a matching repository still is a spec PR", () => {
    expect(previewSpecMatch(specRepo, { ...RULE, useFileKeywords: false })).toBe(true);
  });

  test("an empty keyword list matches no file", () => {
    expect(previewSpecMatch(specFile, { ...RULE, fileKeywords: [] })).toBe(false);
  });

  test("an empty suffix list matches no repository", () => {
    expect(previewSpecMatch(specRepo, { ...RULE, repoSuffixes: [] })).toBe(false);
  });

  test("with both switches off nothing is a spec PR", () => {
    const off = { ...RULE, useRepoSuffix: false, useFileKeywords: false };
    expect(previewSpecMatch(specRepo, off)).toBe(false);
    expect(previewSpecMatch(specFile, off)).toBe(false);
  });

  test("repository matching ignores case", () => {
    expect(previewSpecMatch(makeFacts({ repoName: "Payments-OpenAPI", changedFilePaths: [] }), RULE)).toBe(true);
  });

  test("file matching ignores case", () => {
    expect(previewSpecMatch(makeFacts({ repoName: "payments", changedFilePaths: ["api/Swagger.YAML"] }), RULE)).toBe(true);
  });
});

describe("splitWords", () => {
  test("splits on commas and new lines", () => {
    expect(splitWords("openapi,swagger\nschema")).toEqual(["openapi", "swagger", "schema"]);
  });

  test("trims and lower-cases each word", () => {
    expect(splitWords("  OpenAPI , Swagger \n Schema ")).toEqual(["openapi", "swagger", "schema"]);
  });

  test("drops empty words", () => {
    expect(splitWords(",openapi,, \n\n,swagger,")).toEqual(["openapi", "swagger"]);
  });

  test("drops duplicates, keeping the first", () => {
    expect(splitWords("openapi, swagger, OPENAPI")).toEqual(["openapi", "swagger"]);
  });

  test("empty text is no words", () => {
    expect(splitWords("")).toEqual([]);
    expect(splitWords(" , \n ")).toEqual([]);
  });
});

describe("sameSettings", () => {
  const saved = { theme: "auto", notify: true, specRule: RULE };

  test("equal settings are unchanged", () => {
    expect(sameSettings(saved, { theme: "auto", notify: true, specRule: { ...RULE, repoSuffixes: ["-openapi"] } })).toBe(true);
  });

  test("a different theme is a change", () => {
    expect(sameSettings(saved, { ...saved, theme: "dark" })).toBe(false);
  });

  test("a different notification switch is a change", () => {
    expect(sameSettings(saved, { ...saved, notify: false })).toBe(false);
  });

  test("a spec-rule switch is a change", () => {
    expect(sameSettings(saved, { ...saved, specRule: { ...RULE, useRepoSuffix: false } })).toBe(false);
    expect(sameSettings(saved, { ...saved, specRule: { ...RULE, useFileKeywords: false } })).toBe(false);
  });

  test("a different word list is a change", () => {
    expect(sameSettings(saved, { ...saved, specRule: { ...RULE, fileKeywords: ["openapi"] } })).toBe(false);
    expect(sameSettings(saved, { ...saved, specRule: { ...RULE, repoSuffixes: ["-openapi", "-spec"] } })).toBe(false);
  });
});
