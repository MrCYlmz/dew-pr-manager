import { describe, expect, test } from "bun:test";
import { STATUS_META, STATUS_ORDER, statusMeta } from "../client/statusMeta.ts";
import type { Status } from "../src/types.ts";

// The closed vocabulary in FR-2.4, in its precedence order (FR-2.5).
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

describe("status meta", () => {
  test("every status in the closed vocabulary has a label, colour and icon", () => {
    for (const status of STATUSES) {
      const meta = STATUS_META[status];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.color.length).toBeGreaterThan(0);
      expect(meta.icon.length).toBeGreaterThan(0);
    }
  });

  test("no meta for a status outside the vocabulary", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual([...STATUSES].sort());
  });

  test("labels are human words, never the raw enum value", () => {
    for (const status of STATUSES) expect(STATUS_META[status].label).not.toBe(status);
  });

  test("every status has its own label and icon, so colour is never the only channel", () => {
    const labels = STATUSES.map((s) => STATUS_META[s].label);
    const icons = STATUSES.map((s) => STATUS_META[s].icon);
    expect(new Set(labels).size).toBe(STATUSES.length);
    expect(new Set(icons).size).toBe(STATUSES.length);
  });

  test("status colours come from the --cls-* tokens", () => {
    for (const status of STATUSES) expect(STATUS_META[status].color).toMatch(/^var\(--cls-[a-z]+\)$/);
  });

  test("statusMeta returns the meta of a known status", () => {
    for (const status of STATUSES) expect(statusMeta(status)).toEqual(STATUS_META[status]);
  });
});

describe("status order", () => {
  test("lists each status exactly once", () => {
    expect(STATUS_ORDER).toHaveLength(STATUSES.length);
    expect([...STATUS_ORDER].sort()).toEqual([...STATUSES].sort());
  });

  test("follows the FR-2 precedence order", () => {
    expect([...STATUS_ORDER]).toEqual(STATUSES);
  });
});

describe("unknown status", () => {
  test("gets the fallback: its own text as label, muted ink colour, alert icon", () => {
    expect(statusMeta("MYSTERY")).toEqual({ label: "MYSTERY", color: "var(--ink-muted)", icon: "alertCircle" });
  });
});
