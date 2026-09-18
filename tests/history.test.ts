import { describe, expect, test } from "bun:test";
import { capHistory, diffScans, selectRecentHistory } from "../src/domain/history.ts";
import { makeDerived } from "./helpers.ts";
import type { HistoryEvent } from "../src/types.ts";

describe("diffScans", () => {
  test("first-ever scan (no previous) produces no events", () => {
    const current = [makeDerived({ key: "a#1" })];
    expect(diffScans(null, current, "2026-09-18T00:00:00Z")).toEqual([]);
  });

  test("unchanged status produces no event", () => {
    const pr = makeDerived({ key: "a#1", status: "NEEDS_REVIEW" });
    expect(diffScans([pr], [pr], "2026-09-18T00:00:00Z")).toEqual([]);
  });

  test("a status change is a transition event", () => {
    const before = makeDerived({ key: "a#1", status: "NEEDS_REVIEW" });
    const after = makeDerived({ key: "a#1", status: "READY_TO_MERGE" });
    const [event] = diffScans([before], [after], "2026-09-18T00:00:00Z");
    expect(event).toMatchObject({ kind: "transition", from: "NEEDS_REVIEW", to: "READY_TO_MERGE" });
  });

  test("a new PR is an appeared event", () => {
    const after = makeDerived({ key: "a#1", status: "NEEDS_REVIEW" });
    const [event] = diffScans([], [after], "2026-09-18T00:00:00Z");
    expect(event).toMatchObject({ kind: "appeared", from: null, to: "NEEDS_REVIEW" });
  });

  test("a PR missing from the new scan is a vanished event", () => {
    const before = makeDerived({ key: "a#1", status: "READY_TO_MERGE" });
    const [event] = diffScans([before], [], "2026-09-18T00:00:00Z");
    expect(event).toMatchObject({ kind: "vanished", from: "READY_TO_MERGE", to: null });
  });
});

describe("capHistory", () => {
  test("keeps only the most recent N events", () => {
    const events: HistoryEvent[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      at: `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
      prKey: "a#1",
      prTitle: "t",
      prUrl: "u",
      kind: "transition",
      from: "NEEDS_REVIEW",
      to: "STALE",
    }));
    const capped = capHistory(events, 3);
    expect(capped.map((e) => e.id)).toEqual(["7", "8", "9"]);
  });

  test("returns everything when under the cap", () => {
    const events: HistoryEvent[] = [
      { id: "1", at: "2026-09-01T00:00:00Z", prKey: "a#1", prTitle: "t", prUrl: "u", kind: "appeared", from: null, to: "STALE" },
    ];
    expect(capHistory(events, 500)).toEqual(events);
  });
});

describe("selectRecentHistory", () => {
  const events: HistoryEvent[] = [
    { id: "1", at: "2026-09-10T00:00:00Z", prKey: "a#1", prTitle: "t", prUrl: "u", kind: "appeared", from: null, to: "STALE" },
    { id: "2", at: "2026-09-17T12:00:00Z", prKey: "a#1", prTitle: "t", prUrl: "u", kind: "transition", from: "STALE", to: "NEEDS_REVIEW" },
  ];
  const now = new Date("2026-09-18T00:00:00Z");

  test("with a since timestamp, only later events are returned", () => {
    const result = selectRecentHistory(events, "2026-09-15T00:00:00Z", now);
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });

  test("with no since timestamp, falls back to the last 24 hours", () => {
    const result = selectRecentHistory(events, null, now);
    expect(result.map((e) => e.id)).toEqual(["2"]);
  });
});
