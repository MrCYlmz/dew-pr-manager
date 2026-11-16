import { describe, expect, test } from "bun:test";
import { isStatePayload, type StatePayload } from "../client/statePayload.ts";
import type { SpecRule } from "../src/types.ts";
import { makeChangeSet, makeDerived } from "./helpers.ts";

const RULE: SpecRule = { useRepoSuffix: true, repoSuffixes: ["-openapi"], useFileKeywords: true, fileKeywords: ["openapi"] };
const pr = makeDerived();

const AFTER_SCAN: StatePayload = {
  meta: { scannedAt: "2026-11-17T09:00:00Z", ranAs: "me", error: null, durationMs: 1200 },
  prs: [pr],
  sets: [makeChangeSet({ members: [pr] })],
  history: [],
  notes: { [pr.key]: { prKey: pr.key, text: "ask about the migration", savedAt: "2026-11-17T08:00:00Z" } },
  links: {},
  specRule: RULE,
  notify: true,
  scanning: false,
  defaults: { notify: true, specRule: RULE },
};

// Before the first scan has finished the server answers with meta null and empty lists.
const FIRST_RUN: StatePayload = {
  ...AFTER_SCAN,
  meta: null,
  prs: [],
  sets: [],
  notes: {},
  scanning: true,
};

function without(field: keyof StatePayload): Record<string, unknown> {
  const { [field]: _dropped, ...rest } = AFTER_SCAN;
  return rest;
}

describe("isStatePayload: valid payloads (S-4 criterion 11)", () => {
  test("a state payload after a scan passes", () => {
    expect(isStatePayload(AFTER_SCAN)).toBe(true);
  });

  test("the first-run payload with meta null passes", () => {
    expect(isStatePayload(FIRST_RUN)).toBe(true);
  });

  test("a payload parsed from the JSON the server sends passes", () => {
    expect(isStatePayload(JSON.parse(JSON.stringify(AFTER_SCAN)))).toBe(true);
  });
});

describe("isStatePayload: bodies that are not a state payload (S-4 criteria 10 and 11)", () => {
  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "Not found"],
    ["a number", 404],
    ["a boolean", true],
    ["an array", [AFTER_SCAN]],
  ])("%s is rejected", (_name, body) => {
    expect(isStatePayload(body)).toBe(false);
  });

  test("an empty object is rejected", () => {
    expect(isStatePayload({})).toBe(false);
  });

  test("an error body from a rejected request is rejected", () => {
    expect(isStatePayload({ error: "a JSON body with a string `text` is required" })).toBe(false);
  });

  test.each<keyof StatePayload>(["meta", "prs", "sets", "history", "notes", "links", "specRule", "notify", "scanning", "defaults"])(
    "a payload missing %s is rejected",
    (field) => {
      expect(isStatePayload(without(field))).toBe(false);
    },
  );

  test.each<[keyof StatePayload, unknown]>([
    ["meta", "2026-11-17T09:00:00Z"],
    ["meta", []],
    ["prs", {}],
    ["prs", null],
    ["sets", {}],
    ["sets", "feature-1"],
    ["history", {}],
    ["history", null],
    ["notes", []],
    ["notes", null],
    ["notes", "ask about the migration"],
    ["links", []],
    ["links", null],
    ["specRule", null],
    ["specRule", []],
    ["specRule", true],
    ["notify", "true"],
    ["notify", 1],
    ["notify", null],
    ["scanning", "false"],
    ["scanning", 0],
    ["defaults", null],
    ["defaults", []],
    ["defaults", true],
  ])("a payload with %s set to %p is rejected", (field, value) => {
    expect(isStatePayload({ ...AFTER_SCAN, [field]: value })).toBe(false);
  });
});

describe("the page reads responses through the check (S-4 criterion 10)", () => {
  const appSource = Bun.file(new URL("../client/app.ts", import.meta.url)).text();

  test("client/app.ts imports isStatePayload from client/statePayload.ts", async () => {
    expect(/import\s*\{[^}]*\bisStatePayload\b[^}]*\}\s*from\s*["']\.\/statePayload\.ts["']/.test(await appSource)).toBe(true);
  });

  test("client/app.ts never assigns a response body straight to the page state", async () => {
    expect((await appSource).match(/appState\s*=\s*await\s+[\w.]+\.json\(\)/g)).toBeNull();
  });
});
