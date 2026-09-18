import { describe, expect, test } from "bun:test";
import { deriveAlerts } from "../src/domain/alerts.ts";
import { assignSetKeys, groupIntoChangeSets } from "../src/domain/changeSets.ts";
import { makeDerived } from "./helpers.ts";

function setsFor(prs: ReturnType<typeof makeDerived>[]) {
  return groupIntoChangeSets(assignSetKeys(prs, {}));
}

const spec = (overrides: Parameters<typeof makeDerived>[0] = {}) =>
  makeDerived({ key: "acme/spec#1", repo: "acme/spec", number: 1, headRefName: "f1", isSpecPR: true, ...overrides });

const consumer = (overrides: Parameters<typeof makeDerived>[0] = {}) =>
  makeDerived({
    key: "acme/consumer#2",
    repo: "acme/consumer",
    number: 2,
    headRefName: "f1",
    isSpecPR: false,
    ...overrides,
  });

describe("deriveAlerts", () => {
  test("spec PR with no breaking-change block at all", () => {
    const sets = setsFor([spec({ breakingDeclaration: "MISSING" })]);
    const alerts = deriveAlerts(sets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe("missing_block");
    expect(alerts[0]!.prKey).toBe("acme/spec#1");
  });

  test("spec PR with the block but neither box ticked", () => {
    const sets = setsFor([spec({ breakingDeclaration: "UNDECLARED" })]);
    const alerts = deriveAlerts(sets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe("undeclared");
  });

  test("declared not-breaking raises nothing", () => {
    const sets = setsFor([spec({ breakingDeclaration: "NOT_BREAKING", status: "READY_TO_MERGE" })]);
    expect(deriveAlerts(sets)).toHaveLength(0);
  });

  test("breaking spec ready to merge while a consumer isn't", () => {
    const sets = setsFor([
      spec({ breakingDeclaration: "BREAKING", status: "READY_TO_MERGE", createdAt: "2026-09-01T00:00:00Z" }),
      consumer({ status: "NEEDS_REVIEW", createdAt: "2026-09-02T00:00:00Z" }),
    ]);
    const alerts = deriveAlerts(sets);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.kind).toBe("breaking_not_ready");
    expect(alerts[0]!.message).toContain("acme/consumer#2");
  });

  test("breaking spec ready to merge with every consumer also ready raises nothing", () => {
    const sets = setsFor([
      spec({ breakingDeclaration: "BREAKING", status: "READY_TO_MERGE", createdAt: "2026-09-01T00:00:00Z" }),
      consumer({ status: "READY_TO_MERGE", createdAt: "2026-09-02T00:00:00Z" }),
    ]);
    expect(deriveAlerts(sets)).toHaveLength(0);
  });

  test("a breaking spec PR that isn't ready yet raises nothing (only the ready case is urgent)", () => {
    const sets = setsFor([spec({ breakingDeclaration: "BREAKING", status: "NEEDS_REVIEW" })]);
    expect(deriveAlerts(sets)).toHaveLength(0);
  });
});
